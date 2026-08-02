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
  for (const name of ["http-referer", "x-title"]) {
    const value = initHeaders?.get(name);
    if (value) headers.set(name === "http-referer" ? "HTTP-Referer" : "X-Title", value);
  }
  return fetch(`${BASE}${path}`, { method, headers, body: body ?? undefined });
}

export function extractCost(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const usage = (data as { usage?: Record<string, unknown> }).usage;
  if (!usage) return null;
  const value = usage.cost ?? usage.total_cost;
  const cost = Number(value);
  return Number.isFinite(cost) && cost >= 0 ? cost : null;
}

export function isStreamRequest(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { stream?: unknown }).stream === true;
}
