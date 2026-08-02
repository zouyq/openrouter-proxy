# OpenRouter Proxy

部署在 Cloudflare Workers 上的 OpenAI 兼容 OpenRouter 代理。它在 D1 中管理多个 `sk-or-...` 密钥，按策略负载均衡并提供管理控制台。

[English](README.md)

## 功能

- 转发 OpenAI 兼容的 `/v1/*` 和 `/api/v1/*`，包括流式 chat completions。
- D1 多密钥池：`most_remaining`、`least_requests`、`round_robin`、`lru`。
- `API_TOKEN` 仅供客户端，`ADMIN_KEY` 仅供管理台；旧部署可用 `AUTH_KEY` 兜底。
- `402`/额度错误使密钥耗尽；`429` 进入冷却；连续网络或鉴权失败会弃用密钥。
- 每小时 Cron 探测耗尽/弃用密钥，UTC 00:00 进行软额度同步。
- `/v1/key` 只返回汇总池状态，绝不返回某个上游密钥或保存的 secret。

## 部署

```bash
npm install
npx wrangler d1 create openrouter-proxy-db
# 将 wrangler.toml 中的 database_id = "PLACEHOLDER" 改为创建结果。
npx wrangler d1 migrations apply openrouter-proxy-db --remote
npx wrangler secret put API_TOKEN
npx wrangler secret put ADMIN_KEY
npm run deploy
```

本地开发时复制 `.dev.vars.example` 为 `.dev.vars` 并修改两个值；不要提交该文件。

访问 `https://你的 Worker/admin`，使用 `ADMIN_KEY` 登录并添加 `sk-or-...` 密钥。添加时会尽量调用 OpenRouter `/api/v1/key` 同步余额。

## OpenAI SDK

将 Worker URL 加 `/v1` 作为 `baseURL`。SDK 的 `apiKey` 应使用代理的 `API_TOKEN`，不能使用池内 OpenRouter 密钥。

```ts
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.PROXY_API_TOKEN,
  baseURL: "https://YOUR-WORKER.workers.dev/v1",
});
```

```bash
curl https://YOUR-WORKER.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}'
```

## 密钥池行为

金额以 OpenRouter 返回的美元浮点数保存。`limit` 为 null/0 且没有 `limit_remaining` 的密钥被视为不限额，可持续选择。非流式响应使用 `usage.cost`（或 `usage.total_cost`）本地扣费；流式请求由后续同步校准。

当收到 `402`、余额不足或配额耗尽信息时，密钥会锁定至对应的 daily/weekly/monthly 重置时间；无法判断时锁定到下月 UTC 1 日。`429` 使用 `Retry-After`，缺失时默认冷却 60 秒。`401`、`403`、网络与 5xx 连续达到阈值后会被标为 deprecated，Cron 会继续探测恢复。

## 管理 API

`/api/*` 的管理端路由需要 `x-admin-key: ADMIN_KEY`（也支持 Bearer）；`/api/v1/*` 始终是客户端代理路径，不会被误当成管理接口。

- `GET/POST/DELETE /api/keys`
- `POST /api/keys/sync`
- `POST /api/keys/reactivate`
- `GET/PUT /api/settings`
- `GET /api/stats`
