-- Aggregate model/token usage for admin analytics.
CREATE TABLE IF NOT EXISTS model_usage (
  model TEXT PRIMARY KEY,
  requested_model TEXT NOT NULL DEFAULT '',
  calls INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  last_used_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_model_usage_tokens ON model_usage(total_tokens DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_calls ON model_usage(calls DESC);

-- Per-key last resolved model / token snapshot for pool list.
ALTER TABLE keys ADD COLUMN last_model TEXT NOT NULL DEFAULT '';
ALTER TABLE keys ADD COLUMN last_prompt_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE keys ADD COLUMN last_completion_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE keys ADD COLUMN last_total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE keys ADD COLUMN prompt_tokens_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE keys ADD COLUMN completion_tokens_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE keys ADD COLUMN total_tokens_total INTEGER NOT NULL DEFAULT 0;
