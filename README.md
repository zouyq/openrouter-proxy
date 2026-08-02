# OpenRouter Proxy

An OpenAI-compatible [OpenRouter](https://openrouter.ai) proxy for Cloudflare Workers. It keeps a D1 pool of `sk-or-...` keys, balances requests, records USD usage, and provides a small admin console.

Example deployment: `https://openrouter-proxy.zyqcf.workers.dev`

[中文文档](README.zh-CN.md)

## Features

- OpenAI-compatible `/v1/*` and `/api/v1/*` forwarding, including streaming chat completions.
- D1 multi-key pool with `most_remaining`, `least_requests`, `round_robin`, and `lru` strategies.
- Separate `API_TOKEN` (clients) and `ADMIN_KEY` (console/API), with legacy `AUTH_KEY` fallback.
- `402`/credit errors exhaust a key; `429` applies a per-key cooldown; repeated network/auth failures deprecate it.
- Hourly cron probes deprecated/exhausted keys and performs a soft usage sync at UTC 00:00.
- `/v1/key` returns aggregate pool usage only—never an upstream key or stored secret.

## Deploy

```bash
npm install
npx wrangler d1 create openrouter-proxy-db
# Replace database_id = "PLACEHOLDER" in wrangler.toml with the returned ID.
npx wrangler d1 migrations apply openrouter-proxy-db --remote
npx wrangler secret put API_TOKEN
npx wrangler secret put ADMIN_KEY
npm run deploy
```

For local work, copy `.dev.vars.example` to `.dev.vars` and change both values. Do not commit it.

Open `https://YOUR-WORKER/admin`, sign in with `ADMIN_KEY`, then add one or more `sk-or-...` keys. Keys are validated/synced against `GET /api/v1/key` when added where possible.

## Client usage

Use your Worker URL plus `/v1` as the OpenAI base URL. The client key is `API_TOKEN`, not an OpenRouter pool key.

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.PROXY_API_TOKEN,
  baseURL: "https://YOUR-WORKER.workers.dev/v1",
});

const completion = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

```bash
curl https://YOUR-WORKER.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'
```

## Pool behavior

Credits are USD floating-point values from OpenRouter. A key reporting no limit (`limit` null/0 and no remaining value) is treated as unlimited and remains selectable. Non-stream responses debit `usage.cost` (or `usage.total_cost`) locally; stream responses are reconciled by later sync.

Keys exhausted by `402` or credit/quota messages are locked until their OpenRouter reset period (daily, weekly, monthly, or next month fallback). A `429` uses `Retry-After` or a 60-second cooldown. Repeated `401`, `403`, network, or 5xx failures eventually mark a key deprecated; cron probes it again.

## Admin API

All `/api/*` admin routes require `x-admin-key: ADMIN_KEY` (Bearer also works). `/api/v1/*` is explicitly a client proxy route, not an admin route.

- `GET/POST/DELETE /api/keys`
- `POST /api/keys/sync`
- `POST /api/keys/reactivate`
- `GET/PUT /api/settings`
- `GET /api/stats`
