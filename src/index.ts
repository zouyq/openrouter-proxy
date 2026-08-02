import { Hono } from "hono";
import type { Context } from "hono";
import { ADMIN_HTML } from "./admin-ui.js";
import {
  ensureStreamUsageOption, extractUsage, isStreamRequest, parseSseUsage, proxyRaw,
} from "./openrouter-client.js";
import {
  LOAD_BALANCE_STRATEGIES, USAGE_SYNC_INTERVAL_PRESETS, addKey, addKeys, deleteKey, getPoolConfig,
  getPoolStats, hasStaleUsage, isQuotaExhaustedError, listKeys, markExhausted, pickBestKey,
  probeDeprecatedKeys, probeExhaustedKeys, reactivateKey, recordKeyCall, recordModelUsage,
  recordNetworkFailure, recordSuccess, resetRequestCounts, setCooldown, setPoolConfig, syncAllUsage,
  syncKeyUsage, type KeyCallMeta, type LoadBalanceStrategy, type PoolConfig,
} from "./key-pool.js";

type Env = { DB: D1Database; API_TOKEN?: string; ADMIN_KEY?: string; AUTH_KEY?: string };
const app = new Hono<{ Bindings: Env }>();
const DEFAULT_COOLDOWN = 60, MAX_COOLDOWN = 3600;
const now = () => Math.floor(Date.now() / 1000);

function bearer(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  return match?.[1]?.trim() || request.headers.get("x-api-key")?.trim() || null;
}
function adminToken(request: Request) { return request.headers.get("x-admin-key")?.trim() || bearer(request); }
function apiSecret(env: Env) { return (env.API_TOKEN || env.AUTH_KEY || "").trim(); }
function adminSecret(env: Env) { return (env.ADMIN_KEY || env.AUTH_KEY || "").trim(); }
function isAdminPath(path: string) {
  return path === "/api/auth" || path === "/api/keys" || path.startsWith("/api/keys/") || path === "/api/settings" || path === "/api/stats";
}
function meta(request: Request): Omit<KeyCallMeta, "endpoint" | "status"> {
  const cf = request.cf as { colo?: string; country?: string } | undefined;
  return { clientIp: request.headers.get("cf-connecting-ip") || "", colo: cf?.colo || "", country: cf?.country || "", userAgent: request.headers.get("user-agent") || "" };
}
function requestedModel(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const model = (body as { model?: unknown }).model;
  return typeof model === "string" ? model.trim().slice(0, 160) : "";
}
function retryAfter(header: string | null) {
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(MAX_COOLDOWN, seconds) : DEFAULT_COOLDOWN;
}
function jsonError(message: string, status: 400|401|500|503) { return { error: { message, type: status === 503 ? "service_unavailable" : "proxy_error" } }; }
function splitKeys(body: { apiKey?: string; apiKeys?: string[]; keys?: string[] }) {
  return [...(body.apiKeys || []), ...(body.keys || []), ...(body.apiKey ? body.apiKey.split(/[\n,;]+/) : [])].map(String).map(x => x.trim()).filter(Boolean);
}

app.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method === "GET" && (path === "/" || path === "/admin")) return next();
  if (isAdminPath(path)) {
    const secret = adminSecret(c.env);
    if (!secret) return c.json(jsonError("Admin service unavailable", 503), 503);
    if (adminToken(c.req.raw) !== secret) return c.json({ error: "Unauthorized" }, 401);
    return next();
  }
  const secret = apiSecret(c.env);
  if (!secret || bearer(c.req.raw) !== secret) return c.json(jsonError("Unauthorized", 401), 401);
  return next();
});

app.get("/", c => c.text("ok"));
app.get("/admin", c => c.html(ADMIN_HTML));
app.all("/api/auth", c => c.json({ ok: true }));

app.get("/api/keys", async c => {
  if (c.req.query("refresh") === "1" || await hasStaleUsage(c.env.DB)) c.executionCtx.waitUntil(syncAllUsage(c.env.DB));
  return c.json({ keys: await listKeys(c.env.DB), settings: await getPoolConfig(c.env.DB), usageSyncIntervalPresets: USAGE_SYNC_INTERVAL_PRESETS });
});
app.post("/api/keys", async c => {
  try {
    const body = await c.req.json<{ apiKey?: string; apiKeys?: string[]; keys?: string[]; note?: string }>();
    const keys = splitKeys(body); if (!keys.length) return c.json({ error: "Missing keys" }, 400);
    if (keys.length === 1) return c.json({ success: true, key: await addKey(c.env.DB, keys[0], body.note || ""), keys: await listKeys(c.env.DB) });
    const result = await addKeys(c.env.DB, keys, body.note || ""); return c.json({ success: true, ...result, keys: await listKeys(c.env.DB) });
  } catch (e) { return c.json({ error: String(e) }, 500); }
});
app.delete("/api/keys", async c => {
  try { const { apiKey } = await c.req.json<{apiKey?:string}>(); if (!apiKey) return c.json({error:"Missing apiKey"},400); await deleteKey(c.env.DB, apiKey); return c.json({success:true}); }
  catch(e) { return c.json({error:String(e)},500); }
});
app.post("/api/keys/sync", async (c) => {
  try {
    const body: { apiKey?: string; force?: boolean } = await c.req.json<{ apiKey?: string; force?: boolean }>().catch(() => ({}));
    if (body.apiKey) {
      const key = await syncKeyUsage(c.env.DB, body.apiKey, { force: body.force });
      return c.json({
        success: true,
        synced: key.skipped ? 0 : 1,
        skipped: key.skipped ? 1 : 0,
        key,
        keys: await listKeys(c.env.DB),
        settings: await getPoolConfig(c.env.DB),
      });
    }
    const result = await syncAllUsage(c.env.DB, { force: body.force });
    return c.json({
      success: true,
      ...result,
      keys: await listKeys(c.env.DB),
      settings: await getPoolConfig(c.env.DB),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
app.post("/api/keys/reactivate", async (c) => {
  try {
    const { apiKey } = await c.req.json<{ apiKey?: string }>();
    if (!apiKey) return c.json({ error: "Missing apiKey" }, 400);
    const key = await reactivateKey(c.env.DB, apiKey);
    return c.json({ success: true, key, keys: await listKeys(c.env.DB) });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
app.get("/api/settings", async (c) =>
  c.json({
    settings: await getPoolConfig(c.env.DB),
    strategies: LOAD_BALANCE_STRATEGIES,
    usageSyncIntervalPresets: USAGE_SYNC_INTERVAL_PRESETS,
  })
);
app.put("/api/settings", async (c) => {
  try {
    const body = await c.req.json<Partial<PoolConfig> & { resetCounters?: boolean }>();
    if (body.strategy && !LOAD_BALANCE_STRATEGIES.includes(body.strategy as LoadBalanceStrategy)) {
      return c.json({ error: "Invalid strategy" }, 400);
    }
    const settings = await setPoolConfig(c.env.DB, body);
    if (body.resetCounters) await resetRequestCounts(c.env.DB);
    return c.json({
      success: true,
      settings,
      keys: await listKeys(c.env.DB),
      usageSyncIntervalPresets: USAGE_SYNC_INTERVAL_PRESETS,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
app.get("/api/stats", async c => c.json({stats:await getPoolStats(c.env.DB)}));

async function aggregateKeyView(db: D1Database) {
  const keys = await listKeys(db);
  const limited = keys.filter(k => k.creditLimit > 0);
  return { data: { limit: limited.reduce((n,k)=>n+k.creditLimit,0), limit_remaining: limited.reduce((n,k)=>n+k.creditRemaining,0), usage: keys.reduce((n,k)=>n+k.creditUsage,0), label: "OpenRouter proxy pool", key_count: keys.length, unlimited_keys: keys.filter(k=>k.creditLimit===0).length } };
}
app.get("/v1/key", async c => c.json(await aggregateKeyView(c.env.DB)));
app.get("/api/v1/key", async c => c.json(await aggregateKeyView(c.env.DB)));

/** Client may call /v1/* (OpenAI SDK style); OpenRouter hosts APIs under /api/v1/*. */
function toUpstreamPath(pathname: string, search: string): string {
  let path = pathname;
  if (path === "/v1" || path.startsWith("/v1/")) path = `/api${path}`;
  return `${path}${search}`;
}

function filterUpstreamHeaders(headers: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of headers.entries()) {
    const key = k.toLowerCase();
    // Strip hop-by-hop / length encodings so Workers can stream SSE cleanly.
    if (["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"].includes(key)) {
      continue;
    }
    out.set(k, v);
  }
  return out;
}

async function handleProxy(c: Context<{ Bindings: Env }>) {
  const request = c.req.raw;
  const url = new URL(request.url);
  const upstreamPath = toUpstreamPath(url.pathname, url.search);
  const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);
  let bodyBuffer = hasBody ? await request.arrayBuffer() : null;
  let parsed: unknown = null;
  if (bodyBuffer && bodyBuffer.byteLength) {
    try { parsed = JSON.parse(new TextDecoder().decode(bodyBuffer)); } catch { /* opaque body is still forwarded */ }
  }
  const stream = isStreamRequest(parsed);
  if (stream && parsed) {
    const ensured = ensureStreamUsageOption(parsed);
    if (ensured.buffer) {
      parsed = ensured.body;
      bodyBuffer = ensured.buffer;
    }
  }
  const reqModel = requestedModel(parsed);
  const tried = new Set<string>();
  const callMeta = meta(request);
  while (true) {
    const apiKey = await pickBestKey(c.env.DB, tried);
    if (!apiKey) {
      return c.json(jsonError("No available OpenRouter keys in the pool", 503), 503);
    }
    tried.add(apiKey);
    let upstream: Response;
    try {
      upstream = await proxyRaw(upstreamPath, request.method, apiKey, bodyBuffer, request.headers);
    } catch (e) {
      await recordNetworkFailure(c.env.DB, apiKey, String(e));
      await recordKeyCall(c.env.DB, apiKey, { endpoint: url.pathname, status: "network_error", ...callMeta });
      continue;
    }
    const errorText = upstream.ok ? "" : await upstream.clone().text();
    if (isQuotaExhaustedError(upstream.status, errorText)) {
      await markExhausted(c.env.DB, apiKey, errorText);
      await recordKeyCall(c.env.DB, apiKey, { endpoint: url.pathname, status: "quota", ...callMeta });
      continue;
    }
    if (upstream.status === 429) {
      await setCooldown(c.env.DB, apiKey, now() + retryAfter(upstream.headers.get("retry-after")));
      await recordKeyCall(c.env.DB, apiKey, { endpoint: url.pathname, status: "429", ...callMeta });
      continue;
    }
    if ([401, 403].includes(upstream.status) || upstream.status >= 500) {
      await recordNetworkFailure(
        c.env.DB,
        apiKey,
        `upstream ${upstream.status}`,
        upstream.status === 401 || upstream.status === 403 ? "auth" : "network"
      );
      await recordKeyCall(c.env.DB, apiKey, { endpoint: url.pathname, status: String(upstream.status), ...callMeta });
      continue;
    }
    await recordKeyCall(c.env.DB, apiKey, { endpoint: url.pathname, status: String(upstream.status), ...callMeta });
    const headers = filterUpstreamHeaders(upstream.headers);

    if (stream) {
      if (upstream.ok && upstream.body) {
        const [clientSide, statsSide] = upstream.body.tee();
        c.executionCtx.waitUntil((async () => {
          try {
            const usage = await parseSseUsage(statsSide);
            if (usage && (usage.model || usage.totalTokens || usage.cost != null)) {
              await recordModelUsage(c.env.DB, apiKey, {
                model: usage.model,
                requestedModel: reqModel,
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                cost: usage.cost,
              });
            }
            await recordSuccess(c.env.DB, apiKey, usage?.cost ?? null);
          } catch (e) {
            console.error("[stream usage]", e);
            try { await recordSuccess(c.env.DB, apiKey, null); } catch { /* ignore */ }
          }
        })());
        return new Response(clientSide, { status: upstream.status, headers });
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    const raw = await upstream.text();
    let data: unknown = null;
    try { data = JSON.parse(raw); } catch { /* preserve non-JSON responses */ }
    const usage = extractUsage(data);
    // Some catalog endpoints (e.g. /models) may return 200 even with a bad key.
    // Only treat paid/completion-style successes as proof the key is healthy.
    const cost = usage?.cost ?? null;
    if (upstream.ok && (cost != null || !["GET", "HEAD"].includes(request.method))) {
      await recordSuccess(c.env.DB, apiKey, cost);
    }
    if (upstream.ok && usage && (usage.model || usage.totalTokens || cost != null)) {
      await recordModelUsage(c.env.DB, apiKey, {
        model: usage.model,
        requestedModel: reqModel,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        cost,
      });
    }
    return new Response(raw, { status: upstream.status, headers });
  }
}
app.all("/v1/*", handleProxy);
app.all("/api/v1/*", handleProxy);
app.all("/v1", handleProxy);
app.all("/api/v1", handleProxy);

async function scheduled(controller: ScheduledController, env: Env) {
  try {
    const [deprecated, exhausted] = await Promise.all([probeDeprecatedKeys(env.DB), probeExhaustedKeys(env.DB)]);
    console.log("[scheduled]", { deprecated, exhausted });
    if (new Date(controller.scheduledTime).getUTCHours() === 0) console.log("[scheduled] sync", await syncAllUsage(env.DB));
  } catch (e) { console.error("[scheduled] failed", e); }
}
export default { fetch: app.fetch, scheduled };
