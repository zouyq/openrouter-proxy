export const BASE = "https://openrouter.ai";

export type KeySnapshot = {
  limit: number | null;
  remaining: number | null;
  usage: number;
  limitReset: string;
  label: string;
};

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Reads the per-key OpenRouter credit state without exposing it to clients. */
export async function queryKey(apiKey: string): Promise<KeySnapshot> {
  const response = await fetch(`${BASE}/api/v1/key`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`OpenRouter key query failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const payload = (await response.json()) as { data?: Record<string, unknown> };
  const data = payload.data ?? {};
  return {
    limit: finiteOrNull(data.limit),
    remaining: finiteOrNull(data.limit_remaining),
    usage: finiteOrNull(data.usage) ?? 0,
    limitReset: typeof data.limit_reset === "string" ? data.limit_reset : "",
    label: typeof data.label === "string" ? data.label : "",
  };
}

/** Forwards an API call while always replacing client Authorization with a pool key. */
export async function proxyRaw(
  path: string,
  method: string,
  apiKey: string,
  body?: ArrayBuffer | null,
  initHeaders?: Headers
): Promise<Response> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (initHeaders?.get("content-type")) headers.set("Content-Type", initHeaders.get("content-type")!);
  // Prefer client Accept (e.g. text/event-stream) so upstream streaming framing stays consistent.
  const accept = initHeaders?.get("accept");
  if (accept) headers.set("Accept", accept);
  else headers.set("Accept", "application/json");
  for (const name of ["http-referer", "x-title", "x-openrouter-title"]) {
    const value = initHeaders?.get(name);
    if (!value) continue;
    if (name === "http-referer") headers.set("HTTP-Referer", value);
    else if (name === "x-title" || name === "x-openrouter-title") headers.set("X-Title", value);
  }
  // Do not forward accept-encoding: let the runtime negotiate; avoids gzip/SSE mismatches.
  return fetch(`${BASE}${path}`, { method, headers, body: body ?? undefined });
}

export function extractCost(data: unknown): number | null {
  const usage = extractUsage(data);
  return usage?.cost ?? null;
}

export type UsageExtract = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number | null;
};

/** Pull model + token/cost fields from OpenRouter chat/completions payloads. */
export function extractUsage(data: unknown): UsageExtract | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const usage = obj.usage && typeof obj.usage === "object" ? (obj.usage as Record<string, unknown>) : null;
  const model = typeof obj.model === "string" ? obj.model.trim() : "";
  const promptTokens = Math.max(0, Math.floor(Number(usage?.prompt_tokens ?? usage?.input_tokens) || 0));
  const completionTokens = Math.max(
    0,
    Math.floor(Number(usage?.completion_tokens ?? usage?.output_tokens) || 0)
  );
  let totalTokens = Math.max(0, Math.floor(Number(usage?.total_tokens) || 0));
  if (!totalTokens) totalTokens = promptTokens + completionTokens;
  const costRaw = usage?.cost ?? usage?.total_cost ?? obj.total_cost;
  const costNum = Number(costRaw);
  const cost = Number.isFinite(costNum) && costNum >= 0 ? costNum : null;
  if (!model && !promptTokens && !completionTokens && !totalTokens && cost == null) return null;
  return { model, promptTokens, completionTokens, totalTokens, cost };
}

/** Ensure streaming requests ask OpenRouter for a final usage chunk. */
export function ensureStreamUsageOption(body: unknown): { body: unknown; buffer: ArrayBuffer | null } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { body, buffer: null };
  }
  const obj = { ...(body as Record<string, unknown>) };
  if (obj.stream !== true) return { body, buffer: null };
  const existing =
    obj.stream_options && typeof obj.stream_options === "object" && !Array.isArray(obj.stream_options)
      ? { ...(obj.stream_options as Record<string, unknown>) }
      : {};
  obj.stream_options = { ...existing, include_usage: true };
  const encoded = new TextEncoder().encode(JSON.stringify(obj));
  return {
    body: obj,
    buffer: encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer,
  };
}

export function isStreamRequest(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { stream?: unknown }).stream === true;
}

function mergeUsage(best: UsageExtract | null, usage: UsageExtract): UsageExtract {
  if (!best) return usage;
  if (
    usage.totalTokens > (best.totalTokens || 0) ||
    usage.promptTokens > (best.promptTokens || 0) ||
    usage.completionTokens > (best.completionTokens || 0) ||
    (usage.model && !best.model)
  ) {
    return {
      model: usage.model || best.model || "",
      promptTokens: Math.max(usage.promptTokens, best.promptTokens || 0),
      completionTokens: Math.max(usage.completionTokens, best.completionTokens || 0),
      totalTokens: Math.max(usage.totalTokens, best.totalTokens || 0),
      cost: usage.cost != null ? usage.cost : best.cost,
    };
  }
  return best;
}

/** Read an SSE body and return the best usage/model snapshot found in data chunks. */
export async function parseSseUsage(stream: ReadableStream<Uint8Array> | null): Promise<UsageExtract | null> {
  if (!stream) return null;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let best: UsageExtract | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const usage = extractUsage(parsed);
          if (!usage) continue;
          best = mergeUsage(best, usage);
        } catch {
          /* ignore partial/non-json SSE lines */
        }
      }
    }
  } catch {
    return best;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
  return best;
}
