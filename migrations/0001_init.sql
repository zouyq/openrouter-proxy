CREATE TABLE IF NOT EXISTS keys (
  api_key TEXT PRIMARY KEY,
  mask TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT NOT NULL DEFAULT '',
  credit_limit REAL NOT NULL DEFAULT 0,
  credit_usage REAL NOT NULL DEFAULT 0,
  credit_remaining REAL NOT NULL DEFAULT 0,
  limit_reset TEXT NOT NULL DEFAULT '',
  request_count INTEGER NOT NULL DEFAULT 0,
  consecutive_network_failures INTEGER NOT NULL DEFAULT 0,
  cooldown_until INTEGER NOT NULL DEFAULT 0,
  quota_reset_at INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER NOT NULL DEFAULT 0,
  credit_synced_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  last_error_type TEXT NOT NULL DEFAULT 'none',
  last_sync_error TEXT NOT NULL DEFAULT '',
  plan_name TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  added_at INTEGER NOT NULL DEFAULT 0,
  status_changed_at INTEGER NOT NULL DEFAULT 0,
  deprecated_at INTEGER NOT NULL DEFAULT 0,
  last_call_at INTEGER NOT NULL DEFAULT 0,
  last_call_endpoint TEXT NOT NULL DEFAULT '',
  last_call_status TEXT NOT NULL DEFAULT '',
  last_client_ip TEXT NOT NULL DEFAULT '',
  last_colo TEXT NOT NULL DEFAULT '',
  last_country TEXT NOT NULL DEFAULT '',
  last_user_agent TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_keys_pick ON keys(status, cooldown_until, credit_remaining);
CREATE INDEX IF NOT EXISTS idx_keys_quota_reset ON keys(status, quota_reset_at);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  strategy TEXT NOT NULL DEFAULT 'most_remaining',
  rr_index INTEGER NOT NULL DEFAULT 0,
  usage_sync_interval_secs INTEGER NOT NULL DEFAULT 86400,
  last_sync_started_at INTEGER NOT NULL DEFAULT 0,
  sync_lock_until INTEGER NOT NULL DEFAULT 0,
  max_network_failures INTEGER NOT NULL DEFAULT 5,
  quota_probe_lead_secs INTEGER NOT NULL DEFAULT 3600
);

INSERT OR IGNORE INTO settings (id) VALUES (1);
