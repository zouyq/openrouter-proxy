/**
 * Embedded admin console at GET /admin.
 * Management APIs require ADMIN_KEY; shell is public.
 */

const CSS = `
  :root {
    --bg: #f4f5f7;
    --surface: #ffffff;
    --line: #e4e7ec;
    --text: #111827;
    --muted: #6b7280;
    --accent: #ea580c;
    --accent-2: #c2410c;
    --soft: #fff7ed;
    --ok: #047857;
    --ok-bg: #d1fae5;
    --warn: #b45309;
    --warn-bg: #ffedd5;
    --bad: #b91c1c;
    --bad-bg: #fee2e2;
    --violet: #6d28d9;
    --violet-bg: #ede9fe;
    --shadow: 0 1px 2px rgba(17,24,39,.04), 0 14px 36px rgba(17,24,39,.06);
    --radius: 16px;
    --font: "Manrope", "Segoe UI", sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; color: var(--text); font-family: var(--font);
    background:
      radial-gradient(900px 420px at 0% -10%, #ffedd5 0%, transparent 55%),
      radial-gradient(700px 360px at 100% 0%, #e0e7ff 0%, transparent 50%),
      var(--bg);
  }
  .shell { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 80px; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
  .eyebrow {
    font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    color: var(--accent); margin-bottom: 4px;
  }
  h1 { margin: 0; font-size: 28px; letter-spacing: -.03em; }
  h2 { margin: 0; font-size: 16px; }
  .card {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 18px; margin-bottom: 14px;
  }
  .login-card { max-width: 420px; margin: 12vh auto 0; padding: 28px; }
  .login-card h1 { font-size: 24px; margin-bottom: 8px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  input[type=text], input[type=password], input[type=number], select {
    flex: 1; min-width: 160px; border: 1px solid var(--line); border-radius: 12px;
    padding: 12px 13px; font: inherit; background: #f9fafb; color: var(--text);
  }
  input:focus, select:focus, textarea:focus {
    outline: 2px solid rgba(234,88,12,.18); border-color: var(--accent);
  }
  button {
    border: 0; border-radius: 12px; padding: 11px 14px; font: inherit; font-weight: 700;
    cursor: pointer; background: var(--accent); color: #fff;
  }
  button:hover { background: var(--accent-2); }
  button:disabled { opacity: .55; cursor: not-allowed; }
  button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  button.soft { background: var(--soft); color: var(--accent); }
  button.danger { background: var(--bad-bg); color: var(--bad); }
  .msg { min-height: 18px; margin-top: 10px; font-size: 13px; }
  .msg.ok { color: var(--ok); } .msg.err { color: var(--bad); }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin-bottom: 14px; }
  .stat {
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    padding: 14px 16px; box-shadow: var(--shadow);
  }
  .stat .k { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .stat .v { font-size: 26px; font-weight: 800; margin-top: 6px; letter-spacing: -.03em; }
  .stat .h { color: var(--muted); font-size: 12px; margin-top: 4px; }
  .section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .strategies { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
  .strategy {
    border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; cursor: pointer;
    background: #f9fafb; transition: border-color .15s, background .15s, box-shadow .15s;
  }
  .strategy:hover { border-color: #fdba74; }
  .strategy.active {
    border-color: var(--accent); background: var(--soft);
    box-shadow: inset 0 0 0 1px rgba(234,88,12,.16);
  }
  .strategy .title { font-weight: 800; margin-bottom: 4px; }
  .strategy .desc { color: var(--muted); font-size: 12px; line-height: 1.45; }
  .sync-block { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .chip {
    border: 1px solid var(--line); background: #f9fafb; border-radius: 999px;
    padding: 6px 12px; font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .chip.active { border-color: var(--accent); background: var(--soft); color: var(--accent); }
  .keys { display: grid; gap: 10px; }
  .key {
    border: 1px solid var(--line); border-radius: 14px; padding: 14px;
    display: grid; grid-template-columns: 1.15fr 1.1fr auto; gap: 14px; align-items: center;
    background: linear-gradient(180deg, #fff, #fbfcfe);
  }
  .key-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  code {
    font-family: var(--mono); font-size: 12px; background: #eef2f7;
    padding: 3px 7px; border-radius: 8px;
  }
  .badge {
    display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px;
    font-size: 12px; font-weight: 800;
  }
  .badge.active { background: var(--ok-bg); color: var(--ok); }
  .badge.exhausted { background: var(--bad-bg); color: var(--bad); }
  .badge.deprecated { background: var(--violet-bg); color: var(--violet); }
  .badge.cooling { background: var(--warn-bg); color: var(--warn); }
  .field-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 12px; }
  .field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  .field input {
    width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px;
    font: inherit; background: #fff;
  }
  .meta { color: var(--muted); font-size: 12px; line-height: 1.5; }
  .bar { height: 8px; border-radius: 999px; background: #e5e7eb; overflow: hidden; margin: 8px 0 6px; }
  .bar > i { display: block; height: 100%; background: linear-gradient(90deg, #ea580c, #fb923c); }
  .bar.low > i { background: linear-gradient(90deg, #b45309, #f59e0b); }
  .bar.empty > i { width: 100% !important; background: #fca5a5; opacity: .75; }
  .actions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
  .empty { text-align: center; color: var(--muted); padding: 28px 8px; }
  .toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }
  textarea {
    width: 100%; min-height: 96px; border: 1px solid var(--line); border-radius: 12px;
    padding: 12px 13px; font: inherit; font-family: var(--mono); font-size: 12px;
    background: #f9fafb; color: var(--text); resize: vertical;
  }
  .add-form { display: grid; gap: 10px; }
  .charts { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  .chart-card {
    border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: #f9fafb;
  }
  .chart-card h3 { margin: 0 0 4px; font-size: 14px; }
  .chart-card .meta { margin-bottom: 8px; }
  .chart-wrap { position: relative; height: 220px; }
  .lang-bar { display: flex; justify-content: flex-end; margin-bottom: 10px; }
  .lang-switch {
    display: inline-flex; border: 1px solid var(--line); border-radius: 999px;
    overflow: hidden; background: #fff;
  }
  .lang-switch button {
    border: 0; border-radius: 0; background: transparent; color: var(--muted);
    padding: 6px 12px; font-size: 12px; font-weight: 800;
  }
  .lang-switch button.active { background: var(--soft); color: var(--accent); }
  .collapse-toggle { cursor: pointer; user-select: none; }
  .collapse-toggle .chevron {
    color: var(--muted); font-size: 12px; transition: transform .18s ease; display: inline-block;
  }
  .collapse-toggle.open .chevron { transform: rotate(180deg); }
  .collapse-body { display: none; }
  .collapse-body.open { display: block; }
  @media (max-width: 900px) {
    .stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .strategies { grid-template-columns: 1fr; }
    .key { grid-template-columns: 1fr; }
    .actions { justify-content: flex-start; }
    .field-grid { grid-template-columns: 1fr 1fr; }
    .charts { grid-template-columns: 1fr; }
  }
`;

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OpenRouter Proxy</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>${CSS}</style>
</head>
<body>
<div class="shell">
  <div class="lang-bar">
    <div class="lang-switch" role="group" aria-label="Language">
      <button type="button" class="lang-btn" data-lang="en" onclick="setLang('en')">EN</button>
      <button type="button" class="lang-btn" data-lang="zh" onclick="setLang('zh')">中文</button>
    </div>
  </div>

  <div id="loginView">
    <div class="card login-card">
      <div class="eyebrow" data-i18n="brand">OpenRouter Proxy</div>
      <h1 data-i18n="console">Console</h1>
      <p class="meta" style="margin:0 0 16px" data-i18n="login_hint">Sign in with ADMIN_KEY. Stored only in this browser.</p>
      <form class="row" onsubmit="login(); return false;">
        <input id="authInput" type="password" data-i18n-placeholder="password" placeholder="Password" autocomplete="current-password" />
        <button type="submit" id="loginBtn" data-i18n="sign_in">Sign in</button>
      </form>
      <div class="msg" id="loginMsg"></div>
    </div>
  </div>

  <div id="appView" style="display:none">
    <div class="top">
      <div>
        <div class="eyebrow" data-i18n="brand">OpenRouter Proxy</div>
        <h1 data-i18n="key_pool">Key pool</h1>
      </div>
      <button class="ghost" onclick="logout()" data-i18n="sign_out">Sign out</button>
    </div>

    <div class="stats" id="stats"></div>

    <div class="card">
      <div class="section-head collapse-toggle" id="analyticsToggle" onclick="toggleAnalytics()">
        <div>
          <h2><span data-i18n="analytics">Analytics</span> <span class="chevron">▼</span></h2>
          <div class="meta" style="margin-top:4px" data-i18n="analytics_desc">Click to expand pool charts. Collapsed by default.</div>
        </div>
      </div>
      <div class="collapse-body" id="analyticsBody">
        <div class="charts">
          <div class="chart-card">
            <h3 data-i18n="chart_credits">Credits · used / remaining</h3>
            <div class="meta" data-i18n="chart_credits_desc">Aggregate USD across limited keys</div>
            <div class="chart-wrap"><canvas id="chartCredits"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_status">Upstream · status</h3>
            <div class="meta" data-i18n="chart_status_desc">Key health distribution</div>
            <div class="chart-wrap"><canvas id="chartStatus"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_fails">Upstream · failures</h3>
            <div class="meta" data-i18n="chart_fails_desc">Consecutive network/auth failure buckets</div>
            <div class="chart-wrap"><canvas id="chartFails"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_remaining">Upstream · remaining</h3>
            <div class="meta" data-i18n="chart_remaining_desc">USD left per key</div>
            <div class="chart-wrap"><canvas id="chartRemaining"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_picks">Upstream · picks</h3>
            <div class="meta" data-i18n="chart_picks_desc">Proxy selection count per key</div>
            <div class="chart-wrap"><canvas id="chartPicks"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_endpoint">Upstream · last endpoint</h3>
            <div class="meta" data-i18n="chart_endpoint_desc">Last called API path per key</div>
            <div class="chart-wrap"><canvas id="chartEndpoint"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_result">Upstream · last result</h3>
            <div class="meta" data-i18n="chart_result_desc">ok / quota / 429 / auth / error</div>
            <div class="chart-wrap"><canvas id="chartResult"></canvas></div>
          </div>
          <div class="chart-card">
            <h3 data-i18n="chart_geo">Upstream · country / colo</h3>
            <div class="meta" data-i18n="chart_geo_desc">Client edge location of last call</div>
            <div class="chart-wrap"><canvas id="chartGeo"></canvas></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <div>
          <h2 data-i18n="load_balancing">Load balancing</h2>
          <div class="meta" style="margin-top:4px" data-i18n="load_balancing_desc">How healthy keys are chosen for each request.</div>
        </div>
        <button class="soft" id="saveSettingsBtn" onclick="saveSettings()" data-i18n="save_settings">Save settings</button>
      </div>
      <div class="strategies" id="strategies"></div>
      <div class="sync-block">
        <h2 style="font-size:15px;margin:0 0 4px" data-i18n="sync_interval">Credit sync interval</h2>
        <div class="meta" data-i18n="sync_interval_desc">Minimum age before soft /api/v1/key sync. Pool sync runs one-by-one with gaps.</div>
        <div class="chips" id="syncIntervalChips"></div>
      </div>
      <div class="sync-block">
        <h2 style="font-size:15px;margin:0 0 4px" data-i18n="failure_costs">Failure controls</h2>
        <div class="meta" data-i18n="failure_costs_desc">402 parks the key until reset; 429 cools down; repeated 401/5xx deprecate. Admin Enable can revive early after sync.</div>
        <div class="field-grid">
          <div class="field"><label data-i18n="max_failures">Max network failures</label><input id="maxFailures" type="number" min="1" max="100" /></div>
          <div class="field"><label data-i18n="quota_lead">Quota probe lead (sec)</label><input id="quotaLead" type="number" min="0" /></div>
        </div>
      </div>
      <div class="toolbar">
        <button class="ghost" onclick="resetCounters()" data-i18n="reset_counters">Reset request counters</button>
      </div>
      <div class="msg" id="settingsMsg"></div>
    </div>

    <div class="card">
      <div class="section-head">
        <div>
          <h2 data-i18n="add_keys">Add keys</h2>
          <div class="meta" style="margin-top:4px" data-i18n="add_keys_desc">One sk-or-... per line, or comma / JSON array.</div>
        </div>
      </div>
      <form class="add-form" onsubmit="addKey(); return false;">
        <textarea id="keyInput" data-i18n-placeholder="key_placeholder" placeholder="sk-or-...&#10;sk-or-..." autocomplete="off" spellcheck="false"></textarea>
        <div class="row">
          <input id="noteInput" type="text" data-i18n-placeholder="note_placeholder" placeholder="Note (optional)" autocomplete="off" spellcheck="false" />
          <button type="submit" data-i18n="add">Add</button>
        </div>
      </form>
      <div class="msg" id="addMsg"></div>
    </div>

    <div class="card">
      <div class="section-head">
        <h2 data-i18n="pool">Pool</h2>
        <div class="row">
          <button class="ghost" id="refreshBtn" onclick="loadKeys(false)" data-i18n="refresh">Refresh</button>
          <button class="soft" id="syncBtn" onclick="syncUsage(false)" data-i18n="sync_usage">Sync usage</button>
          <button class="ghost" id="forceSyncBtn" onclick="syncUsage(true)" data-i18n="force_sync">Force sync</button>
        </div>
      </div>
      <div class="keys" id="keys"></div>
      <div class="empty" id="empty" style="display:none" data-i18n="no_keys">No keys yet.</div>
      <div class="msg" id="listMsg"></div>
    </div>
  </div>
</div>

<script>
const ADMIN_STORAGE = "openrouterProxyAdminKey";
const LANG_STORAGE = "openrouterProxyLang";
const STRATEGY_IDS = ["most_remaining", "least_requests", "round_robin", "lru"];
const CHART_COLORS = ["#ea580c", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b", "#14b8a6", "#e11d48"];

var I18N = {
  en: {
    brand: "OpenRouter Proxy", console: "Console", key_pool: "Key pool",
    sign_in: "Sign in", sign_out: "Sign out", password: "Password",
    login_hint: "Sign in with ADMIN_KEY. Stored only in this browser.",
    analytics: "Analytics", analytics_desc: "Click to expand pool charts. Collapsed by default.",
    chart_credits: "Credits · used / remaining", chart_credits_desc: "Aggregate USD across limited keys",
    chart_status: "Upstream · status", chart_status_desc: "Key health distribution",
    chart_fails: "Upstream · failures", chart_fails_desc: "Consecutive network/auth failure buckets",
    chart_remaining: "Upstream · remaining", chart_remaining_desc: "USD left per key",
    chart_picks: "Upstream · picks", chart_picks_desc: "Proxy selection count per key",
    chart_endpoint: "Upstream · last endpoint", chart_endpoint_desc: "Last called API path per key",
    chart_result: "Upstream · last result", chart_result_desc: "ok / quota / 429 / auth / error",
    chart_geo: "Upstream · country / colo", chart_geo_desc: "Client edge location of last call",
    load_balancing: "Load balancing", load_balancing_desc: "How healthy keys are chosen for each request.",
    save_settings: "Save settings",
    sync_interval: "Credit sync interval",
    sync_interval_desc: "Minimum age before soft /api/v1/key sync. Pool sync runs one-by-one with gaps.",
    failure_costs: "Failure controls",
    failure_costs_desc: "402 parks the key until reset; 429 cools down; repeated 401/5xx deprecate. Admin Enable can revive early after sync.",
    max_failures: "Max network failures", quota_lead: "Quota probe lead (sec)",
    reset_counters: "Reset request counters",
    add_keys: "Add keys", add_keys_desc: "One sk-or-... per line, or comma / JSON array.",
    key_placeholder: "sk-or-...\\nsk-or-...", note_placeholder: "Note (optional)", add: "Add",
    pool: "Pool", refresh: "Refresh", sync_usage: "Sync usage", force_sync: "Force sync", no_keys: "No keys yet.",
    unavailable: "Unavailable", invalid_credentials: "Invalid credentials", enter_password: "Enter password",
    sign_in_failed: "Sign in failed",
    stat_keys: "Keys", stat_healthy: "Healthy", stat_remaining: "Remaining", stat_requests: "Requests",
    stat_dep_exh: "dep {d} · exh {e}", stat_ready: "ready", stat_credits: "USD", stat_picks: "proxy picks",
    stat_unlimited: "{n} unlimited",
    strategy_most_remaining_title: "Most remaining",
    strategy_most_remaining_desc: "Prefer higher remaining USD balance.",
    strategy_least_requests_title: "Least requests",
    strategy_least_requests_desc: "Fewest proxy picks first; ties break on remaining.",
    strategy_round_robin_title: "Round robin",
    strategy_round_robin_desc: "Rotate healthy keys in order.",
    strategy_lru_title: "LRU",
    strategy_lru_desc: "Least recently used healthy key.",
    no_note: "No note", added: "added", picks: "picks", net_fails: "net fails", err: "err",
    reset: "reset", last_used: "last used", synced: "synced", last_call: "last call",
    usage: "Usage", enable: "Enable", delete: "Delete", used: "used", limit: "limit", unlimited: "unlimited",
    saving: "Saving...", saved: "Saved: {s} · sync ≥ {i}", resetting: "Resetting...",
    counters_reset: "Counters reset", confirm_reset: "Reset proxy request counters for all keys?",
    key_enabled: "Key enabled", enter_keys: "Enter one or more keys", adding: "Adding {n}...",
    added_n: "Added {n}", skipped_n: ", skipped {n}", confirm_delete: "Delete this key?",
    force_syncing: "Force syncing...", syncing_stale: "Syncing stale keys...",
    synced_summary: "Synced {s}, skipped {k} (interval ≥ {i})", syncing: "Syncing...",
    updated: "Updated {v}", chart_used: "Used", chart_remaining_lbl: "Remaining", none: "none",
    chart_fails_0: "0 fails", chart_fails_12: "1-2", chart_fails_3: "3+",
    ago_s: "{n}s ago", ago_m: "{n}m ago", ago_h: "{n}h ago", ago_d: "{n}d ago"
  },
  zh: {
    brand: "OpenRouter Proxy", console: "控制台", key_pool: "Key 池",
    sign_in: "登录", sign_out: "退出", password: "密码",
    login_hint: "使用 ADMIN_KEY 登录，仅保存在本浏览器。",
    analytics: "统计分析", analytics_desc: "点击展开图表。默认折叠以节省空间。",
    chart_credits: "额度 · 已用 / 剩余", chart_credits_desc: "有限额 Key 的美元额度汇总",
    chart_status: "上游 · 状态", chart_status_desc: "Key 健康状态分布",
    chart_fails: "上游 · 失败", chart_fails_desc: "连续网络/鉴权失败分桶",
    chart_remaining: "上游 · 剩余", chart_remaining_desc: "各 Key 剩余美元",
    chart_picks: "上游 · 选用", chart_picks_desc: "各 Key 被代理选用次数",
    chart_endpoint: "上游 · 最近接口", chart_endpoint_desc: "各 Key 最近调用的 API 路径",
    chart_result: "上游 · 最近结果", chart_result_desc: "成功 / 额度 / 429 / 鉴权 / 错误",
    chart_geo: "上游 · 国家 / colo", chart_geo_desc: "最近一次调用的客户端边缘位置",
    load_balancing: "负载均衡", load_balancing_desc: "健康 Key 的请求调度策略。",
    save_settings: "保存设置",
    sync_interval: "额度同步间隔",
    sync_interval_desc: "达到空闲时长后才可软同步 /api/v1/key。池同步逐个执行并留间隔。",
    failure_costs: "失败控制",
    failure_costs_desc: "402 本周期停用；429 冷却；反复 401/5xx 废弃。管理后台「启用」可在同步后提前恢复。",
    max_failures: "最大网络失败次数", quota_lead: "额度探测提前量（秒）",
    reset_counters: "重置请求计数",
    add_keys: "添加 Key", add_keys_desc: "每行一个 sk-or-...，或逗号 / JSON 数组。",
    key_placeholder: "sk-or-...\\nsk-or-...", note_placeholder: "备注（可选）", add: "添加",
    pool: "Key 池", refresh: "刷新", sync_usage: "同步额度", force_sync: "强制同步", no_keys: "暂无 Key。",
    unavailable: "服务不可用", invalid_credentials: "密码错误", enter_password: "请输入密码",
    sign_in_failed: "登录失败",
    stat_keys: "Keys", stat_healthy: "健康", stat_remaining: "剩余", stat_requests: "请求",
    stat_dep_exh: "废弃 {d} · 耗尽 {e}", stat_ready: "可用", stat_credits: "美元", stat_picks: "代理选用",
    stat_unlimited: "{n} 个无限额",
    strategy_most_remaining_title: "剩余最多",
    strategy_most_remaining_desc: "优先剩余美元更多的 Key。",
    strategy_least_requests_title: "请求最少",
    strategy_least_requests_desc: "选用次数更少优先；并列看剩余额度。",
    strategy_round_robin_title: "轮询",
    strategy_round_robin_desc: "按顺序轮转健康 Key。",
    strategy_lru_title: "最久未用",
    strategy_lru_desc: "优先最久未使用的健康 Key。",
    no_note: "无备注", added: "添加于", picks: "选用", net_fails: "网络失败", err: "错误",
    reset: "重置", last_used: "上次使用", synced: "已同步", last_call: "最近调用",
    usage: "额度", enable: "启用", delete: "删除", used: "已用", limit: "限额", unlimited: "无限额",
    saving: "保存中...", saved: "已保存：{s} · 同步 ≥ {i}", resetting: "重置中...",
    counters_reset: "计数已重置", confirm_reset: "确定重置所有 Key 的代理请求计数？",
    key_enabled: "Key 已启用", enter_keys: "请输入一个或多个 Key", adding: "正在添加 {n} 个...",
    added_n: "已添加 {n}", skipped_n: "，跳过 {n}", confirm_delete: "确定删除这个 Key？",
    force_syncing: "强制同步中...", syncing_stale: "正在同步过期 Key...",
    synced_summary: "已同步 {s}，跳过 {k}（间隔 ≥ {i}）", syncing: "同步中...",
    updated: "已更新 {v}", chart_used: "已用", chart_remaining_lbl: "剩余", none: "无",
    chart_fails_0: "0 次", chart_fails_12: "1-2", chart_fails_3: "3+",
    ago_s: "{n} 秒前", ago_m: "{n} 分钟前", ago_h: "{n} 小时前", ago_d: "{n} 天前"
  }
};

var latestKeys = [];
var selectedStrategy = "most_remaining";
var selectedSyncInterval = 86400;
var syncIntervalPresets = [900, 1800, 3600, 10800, 21600, 43200, 86400];
var chartInstances = {};
var analyticsOpen = false;
var currentLang = detectLang();

function detectLang() {
  var saved = localStorage.getItem(LANG_STORAGE);
  if (saved === "en" || saved === "zh") return saved;
  return ((navigator.language || "en").toLowerCase().indexOf("zh") === 0) ? "zh" : "en";
}
function t(key, vars) {
  var table = I18N[currentLang] || I18N.en;
  var text = table[key] || I18N.en[key] || key;
  if (vars) Object.keys(vars).forEach(function (k) { text = text.split("{" + k + "}").join(String(vars[k])); });
  return text;
}
function applyI18n() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
  });
  var loginBtn = document.getElementById("loginBtn");
  if (loginBtn && !loginBtn.disabled) loginBtn.textContent = t("sign_in");
  renderStrategies();
  renderSyncIntervalChips();
  renderStats(latestKeys || []);
  if ((latestKeys || []).length) renderKeys(latestKeys);
  if (analyticsOpen) loadStats();
}
function setLang(lang) {
  if (lang !== "en" && lang !== "zh") return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE, lang);
  applyI18n();
}
function toggleAnalytics() {
  analyticsOpen = !analyticsOpen;
  var body = document.getElementById("analyticsBody");
  var head = document.getElementById("analyticsToggle");
  if (body) body.classList.toggle("open", analyticsOpen);
  if (head) head.classList.toggle("open", analyticsOpen);
  if (analyticsOpen) {
    loadStats().then(function () {
      setTimeout(function () {
        Object.keys(chartInstances).forEach(function (id) {
          if (chartInstances[id] && chartInstances[id].resize) chartInstances[id].resize();
        });
      }, 60);
    });
  }
}

function formatInterval(secs) {
  if (secs < 3600) return Math.round(secs / 60) + "m";
  if (secs < 86400) return Math.round(secs / 3600) + "h";
  return Math.round(secs / 86400) + "d";
}
function timeAgo(secs) {
  if (!secs) return "-";
  var diff = Math.floor(Date.now() / 1000) - secs;
  if (diff < 60) return t("ago_s", { n: diff });
  if (diff < 3600) return t("ago_m", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("ago_h", { n: Math.floor(diff / 3600) });
  return t("ago_d", { n: Math.floor(diff / 86400) });
}
function money(v) { return "$" + Number(v || 0).toFixed(4); }
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function adminSecret() { return (localStorage.getItem(ADMIN_STORAGE) || "").trim(); }
function api(path, options) {
  var secret = adminSecret();
  var headers = Object.assign({}, (options && options.headers) || {});
  if (secret) {
    headers["x-admin-key"] = secret;
    headers["Authorization"] = "Bearer " + secret;
  }
  if (options && options.body) headers["Content-Type"] = "application/json";
  return fetch(path, Object.assign({}, options, { headers: headers }));
}
async function handle(res) {
  if (res.status === 401 || res.status === 503) {
    localStorage.removeItem(ADMIN_STORAGE);
    showLogin();
    setMsg("loginMsg", res.status === 503 ? t("unavailable") : t("invalid_credentials"), true);
    throw new Error("unauthorized");
  }
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}
function setMsg(id, text, isErr) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.className = "msg " + (isErr ? "err" : "ok");
}
function showLogin() {
  document.getElementById("loginView").style.display = "";
  document.getElementById("appView").style.display = "none";
}
function showApp() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("appView").style.display = "";
}
function setLoginBusy(busy) {
  var btn = document.getElementById("loginBtn");
  var input = document.getElementById("authInput");
  if (btn) { btn.disabled = !!busy; btn.textContent = busy ? "..." : t("sign_in"); }
  if (input) input.disabled = !!busy;
}
function login() {
  var value = document.getElementById("authInput").value.trim();
  if (!value) { setMsg("loginMsg", t("enter_password"), true); return; }
  localStorage.setItem(ADMIN_STORAGE, value);
  setLoginBusy(true);
  setMsg("loginMsg", "");
  api("/api/auth", { method: "POST", body: "{}" })
    .then(handle)
    .then(function () { showApp(); return loadKeys(false); })
    .catch(function (e) {
      if (e.message !== "unauthorized") setMsg("loginMsg", e.message || t("sign_in_failed"), true);
    })
    .finally(function () { setLoginBusy(false); });
}
function logout() {
  localStorage.removeItem(ADMIN_STORAGE);
  latestKeys = [];
  showLogin();
  document.getElementById("authInput").value = "";
  setMsg("loginMsg", "", false);
}
function init() {
  applyI18n();
  if (adminSecret()) {
    setLoginBusy(true);
    api("/api/auth", { method: "GET" })
      .then(handle)
      .then(function () { showApp(); return loadKeys(false); })
      .catch(function () {})
      .finally(function () { setLoginBusy(false); });
  }
}

function statusBadge(key) {
  if (key.status === "deprecated") return '<span class="badge deprecated">deprecated</span>';
  if (key.status === "active" && key.cooldownUntil > Math.floor(Date.now() / 1000)) {
    return '<span class="badge cooling">cooling</span>';
  }
  return '<span class="badge ' + escapeHtml(key.status) + '">' + escapeHtml(key.status) + "</span>";
}
function formatReset(secs) {
  if (!secs) return "-";
  try { return new Date(secs * 1000).toISOString().slice(0, 10) + " UTC"; }
  catch (e) { return "-"; }
}
function creditBlock(key) {
  var limit = Number(key.creditLimit) || 0;
  var remaining = Number(key.creditRemaining) || 0;
  var usage = Number(key.creditUsage) || 0;
  var unlimited = limit <= 0;
  var pct = unlimited ? 100 : Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
  var barClass = "bar";
  if (!unlimited && remaining <= 0) barClass += " empty";
  else if (!unlimited && pct <= 15) barClass += " low";
  var label = key.label || key.planName || "";
  return (
    '<div class="meta"><strong>' + (unlimited ? t("unlimited") : (money(remaining) + " / " + money(limit))) +
    "</strong>" + (label ? " · " + escapeHtml(label) : "") + "</div>" +
    '<div class="' + barClass + '"><i style="width:' + pct + '%"></i></div>' +
    '<div class="meta">' + t("used") + " " + money(usage) +
    (key.limitReset ? " · reset " + escapeHtml(key.limitReset) : "") + "</div>"
  );
}
function renderStats(keys) {
  keys = keys || [];
  var now = Math.floor(Date.now() / 1000);
  var total = keys.length;
  var active = keys.filter(function (k) { return k.status === "active" && !(k.cooldownUntil > now); }).length;
  var remaining = keys.reduce(function (sum, k) { return sum + (Number(k.creditRemaining) || 0); }, 0);
  var requests = keys.reduce(function (sum, k) { return sum + (Number(k.requestCount) || 0); }, 0);
  var deprecated = keys.filter(function (k) { return k.status === "deprecated"; }).length;
  var exhausted = keys.filter(function (k) { return k.status === "exhausted"; }).length;
  var unlimited = keys.filter(function (k) { return !(Number(k.creditLimit) > 0); }).length;
  document.getElementById("stats").innerHTML =
    '<div class="stat"><div class="k">' + t("stat_keys") + '</div><div class="v">' + total + '</div><div class="h">' + t("stat_dep_exh", { d: deprecated, e: exhausted }) + '</div></div>' +
    '<div class="stat"><div class="k">' + t("stat_healthy") + '</div><div class="v">' + active + '</div><div class="h">' + t("stat_ready") + '</div></div>' +
    '<div class="stat"><div class="k">' + t("stat_remaining") + '</div><div class="v">' + money(remaining) + '</div><div class="h">' + t("stat_unlimited", { n: unlimited }) + '</div></div>' +
    '<div class="stat"><div class="k">' + t("stat_requests") + '</div><div class="v">' + requests + '</div><div class="h">' + t("stat_picks") + '</div></div>';
}

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}
function upsertChart(id, config) {
  if (typeof Chart === "undefined") return;
  destroyChart(id);
  var canvas = document.getElementById(id);
  if (!canvas) return;
  chartInstances[id] = new Chart(canvas.getContext("2d"), config);
}
function mapToLabelsValues(obj) {
  var labels = Object.keys(obj || {});
  var values = labels.map(function (k) { return obj[k] || 0; });
  return { labels: labels, values: values };
}
function doughnutConfig(labels, values) {
  return {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{ data: values, backgroundColor: CHART_COLORS.slice(0, Math.max(values.length, 1)), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } }
    }
  };
}
function barConfig(labels, values, label, horizontal) {
  var valueAxis = { grid: { color: "rgba(148,163,184,.25)" }, ticks: { font: { size: 10 } }, beginAtZero: true };
  var categoryAxis = { grid: { display: false }, ticks: { font: { size: 10 } } };
  return {
    type: "bar",
    data: {
      labels: labels.length ? labels : [t("none")],
      datasets: [{
        label: label,
        data: values.length ? values : [0],
        backgroundColor: "#ea580c",
        borderRadius: 6,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis }
    }
  };
}
function renderCharts(stats) {
  if (!stats || !stats.external || !stats.upstream) return;
  var ext = stats.external;
  var up = stats.upstream;
  upsertChart("chartCredits", doughnutConfig(
    [t("chart_used"), t("chart_remaining_lbl")],
    [ext.creditUsage || 0, ext.creditRemaining || 0]
  ));
  var st = up.status || {};
  upsertChart("chartStatus", doughnutConfig(
    ["active", "cooling", "exhausted", "deprecated"],
    [st.active || 0, st.cooling || 0, st.exhausted || 0, st.deprecated || 0]
  ));
  var fb = up.failureBuckets || up.failures || {};
  upsertChart("chartFails", doughnutConfig(
    [t("chart_fails_0"), t("chart_fails_12"), t("chart_fails_3")],
    [fb["0"] || 0, fb["1-2"] || 0, fb["3+"] || 0]
  ));
  var byKey = up.byKey || [];
  upsertChart("chartRemaining", barConfig(
    byKey.map(function (k) { return k.mask; }),
    byKey.map(function (k) { return k.remaining; }),
    t("chart_remaining_lbl"), true
  ));
  upsertChart("chartPicks", barConfig(
    byKey.map(function (k) { return k.mask; }),
    byKey.map(function (k) { return k.picks; }),
    t("picks"), true
  ));
  var ep = mapToLabelsValues(up.lastEndpoint);
  upsertChart("chartEndpoint", doughnutConfig(
    ep.labels.length ? ep.labels : [t("none")],
    ep.values.length ? ep.values : [0]
  ));
  var rs = mapToLabelsValues(up.lastResult);
  upsertChart("chartResult", doughnutConfig(
    rs.labels.length ? rs.labels : [t("none")],
    rs.values.length ? rs.values : [0]
  ));
  var geo = mapToLabelsValues(up.lastCountry || up.countries);
  if (!geo.labels.length) geo = mapToLabelsValues(up.lastColo);
  upsertChart("chartGeo", doughnutConfig(
    geo.labels.length ? geo.labels : [t("none")],
    geo.values.length ? geo.values : [0]
  ));
}
function loadStats() {
  if (!analyticsOpen) return Promise.resolve();
  return api("/api/stats").then(handle).then(function (data) { renderCharts(data.stats); }).catch(function () {});
}

function renderStrategies() {
  var root = document.getElementById("strategies");
  if (!root) return;
  root.innerHTML = "";
  STRATEGY_IDS.forEach(function (id) {
    var el = document.createElement("div");
    el.className = "strategy" + (selectedStrategy === id ? " active" : "");
    el.innerHTML =
      '<div class="title">' + escapeHtml(t("strategy_" + id + "_title")) + "</div>" +
      '<div class="desc">' + escapeHtml(t("strategy_" + id + "_desc")) + "</div>";
    el.onclick = function () { selectedStrategy = id; renderStrategies(); };
    root.appendChild(el);
  });
}
function renderSyncIntervalChips() {
  var root = document.getElementById("syncIntervalChips");
  if (!root) return;
  root.innerHTML = "";
  syncIntervalPresets.forEach(function (secs) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "chip" + (selectedSyncInterval === secs ? " active" : "");
    el.textContent = formatInterval(secs);
    el.onclick = function () { selectedSyncInterval = secs; renderSyncIntervalChips(); };
    root.appendChild(el);
  });
}
function setInputValue(id, value) {
  var el = document.getElementById(id);
  if (el) el.value = String(value);
}
function numInput(id, fallback) {
  var el = document.getElementById(id);
  var n = el ? Number(el.value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function applySettings(settings, presets) {
  if (!settings) return;
  if (Array.isArray(presets) && presets.length) syncIntervalPresets = presets.slice();
  selectedStrategy = settings.strategy || selectedStrategy;
  selectedSyncInterval = settings.usageSyncIntervalSecs || selectedSyncInterval;
  setInputValue("maxFailures", settings.maxNetworkFailures != null ? settings.maxNetworkFailures : 5);
  setInputValue("quotaLead", settings.quotaProbeLeadSecs != null ? settings.quotaProbeLeadSecs : 3600);
  renderStrategies();
  renderSyncIntervalChips();
}

function renderKeys(keys) {
  latestKeys = keys || [];
  renderStats(latestKeys);
  if (analyticsOpen) loadStats();
  var root = document.getElementById("keys");
  var empty = document.getElementById("empty");
  if (!root || !empty) return;
  root.innerHTML = "";
  if (!latestKeys.length) {
    empty.style.display = "";
    empty.textContent = t("no_keys");
    return;
  }
  empty.style.display = "none";
  latestKeys.forEach(function (k) {
    var el = document.createElement("div");
    el.className = "key";
    el.innerHTML =
      "<div>" +
        '<div class="key-top"><code>' + escapeHtml(k.mask) + "</code>" + statusBadge(k) + "</div>" +
        '<div class="meta">' + (k.note ? escapeHtml(k.note) : t("no_note")) +
        " · " + t("added") + " " + timeAgo(k.addedAt) + "</div>" +
      "</div>" +
      "<div>" + creditBlock(k) +
        '<div class="meta" style="margin-top:6px">' + t("picks") + " " + (k.requestCount || 0) +
        " · " + t("net_fails") + " " + (k.consecutiveNetworkFailures || 0) +
        " · " + t("err") + " " + escapeHtml(k.lastErrorType || t("none")) +
        (k.quotaResetAt ? " · " + t("reset") + " " + formatReset(k.quotaResetAt) : "") +
        " · " + t("last_used") + " " + timeAgo(k.lastUsedAt) +
        " · " + t("synced") + " " + timeAgo(k.creditSyncedAt) + "</div>" +
        '<div class="meta">' + t("last_call") + " " + timeAgo(k.lastCallAt) +
        (k.lastCallEndpoint ? " · " + escapeHtml(k.lastCallEndpoint) : "") +
        (k.lastCallStatus ? " · " + escapeHtml(k.lastCallStatus) : "") +
        (k.lastClientIp ? " · ip " + escapeHtml(k.lastClientIp) : "") +
        (k.lastColo ? " · colo " + escapeHtml(k.lastColo) : "") +
        (k.lastCountry ? " · " + escapeHtml(k.lastCountry) : "") +
        "</div>" +
      "</div>" +
      '<div class="actions"></div>';
    var actions = el.querySelector(".actions");
    var usageBtn = document.createElement("button");
    usageBtn.className = "ghost";
    usageBtn.textContent = t("usage");
    usageBtn.onclick = function () { syncOne(k.apiKey, usageBtn); };
    actions.appendChild(usageBtn);
    if (k.status === "deprecated" || k.status === "exhausted") {
      var reactBtn = document.createElement("button");
      reactBtn.className = "soft";
      reactBtn.textContent = t("enable");
      reactBtn.onclick = function () { reactivate(k.apiKey, reactBtn); };
      actions.appendChild(reactBtn);
    }
    var delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = t("delete");
    delBtn.onclick = function () { deleteKey(k.apiKey); };
    actions.appendChild(delBtn);
    root.appendChild(el);
  });
}

function settingsPayload(extra) {
  var body = {
    strategy: selectedStrategy,
    usageSyncIntervalSecs: selectedSyncInterval,
    maxNetworkFailures: numInput("maxFailures", 5),
    quotaProbeLeadSecs: numInput("quotaLead", 3600)
  };
  if (extra) Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
  return body;
}
function saveSettings() {
  var btn = document.getElementById("saveSettingsBtn");
  btn.disabled = true;
  setMsg("settingsMsg", t("saving"));
  api("/api/settings", { method: "PUT", body: JSON.stringify(settingsPayload()) })
    .then(handle)
    .then(function (data) {
      applySettings(data.settings, data.usageSyncIntervalPresets);
      if (data.keys) renderKeys(data.keys);
      setMsg("settingsMsg", t("saved", { s: selectedStrategy, i: formatInterval(selectedSyncInterval) }));
    })
    .catch(function (e) { setMsg("settingsMsg", e.message, true); })
    .finally(function () { btn.disabled = false; });
}
function resetCounters() {
  if (!confirm(t("confirm_reset"))) return;
  setMsg("settingsMsg", t("resetting"));
  api("/api/settings", { method: "PUT", body: JSON.stringify(settingsPayload({ resetCounters: true })) })
    .then(handle)
    .then(function (data) {
      applySettings(data.settings, data.usageSyncIntervalPresets);
      renderKeys(data.keys || []);
      setMsg("settingsMsg", t("counters_reset"));
    })
    .catch(function (e) { setMsg("settingsMsg", e.message, true); });
}
function reactivate(apiKey, btn) {
  btn.disabled = true;
  api("/api/keys/reactivate", { method: "POST", body: JSON.stringify({ apiKey: apiKey }) })
    .then(handle)
    .then(function (data) {
      renderKeys(data.keys || []);
      setMsg("listMsg", t("key_enabled"));
    })
    .catch(function (e) { setMsg("listMsg", e.message, true); })
    .finally(function () { btn.disabled = false; });
}
function parseKeyInput(raw) {
  var text = String(raw || "").trim();
  if (!text) return [];
  if (text.charAt(0) === "[") {
    try {
      var arr = JSON.parse(text);
      if (Array.isArray(arr)) return arr.map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    } catch (e) { /* fall through */ }
  }
  return text.split(/[\\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}
function addKey() {
  var keys = parseKeyInput(document.getElementById("keyInput").value);
  if (!keys.length) { setMsg("addMsg", t("enter_keys"), true); return; }
  var note = document.getElementById("noteInput").value.trim();
  setMsg("addMsg", t("adding", { n: keys.length }));
  var body = keys.length === 1 ? { apiKey: keys[0], note: note } : { apiKeys: keys, note: note };
  api("/api/keys", { method: "POST", body: JSON.stringify(body) })
    .then(handle)
    .then(function (data) {
      document.getElementById("keyInput").value = "";
      document.getElementById("noteInput").value = "";
      var added = data.added != null ? (Array.isArray(data.added) ? data.added.length : data.added) : 1;
      var skipped = data.skipped != null ? (Array.isArray(data.skipped) ? data.skipped.length : data.skipped) : 0;
      setMsg("addMsg", t("added_n", { n: added }) + (skipped ? t("skipped_n", { n: skipped }) : ""));
      if (data.keys) renderKeys(data.keys);
      else return loadKeys(false);
    })
    .catch(function (e) { setMsg("addMsg", e.message, true); });
}
function deleteKey(apiKey) {
  if (!confirm(t("confirm_delete"))) return;
  api("/api/keys", { method: "DELETE", body: JSON.stringify({ apiKey: apiKey }) })
    .then(handle)
    .then(function () { return loadKeys(false); })
    .catch(function (e) { setMsg("listMsg", e.message, true); });
}
function syncUsage(force) {
  var syncBtn = document.getElementById("syncBtn");
  var forceBtn = document.getElementById("forceSyncBtn");
  if (syncBtn) syncBtn.disabled = true;
  if (forceBtn) forceBtn.disabled = true;
  setMsg("listMsg", force ? t("force_syncing") : t("syncing_stale"));
  api("/api/keys/sync", { method: "POST", body: JSON.stringify({ force: !!force }) })
    .then(handle)
    .then(function (data) {
      if (data.settings) applySettings(data.settings);
      renderKeys(data.keys || []);
      setMsg("listMsg", t("synced_summary", {
        s: data.synced || 0,
        k: data.skipped || 0,
        i: formatInterval(selectedSyncInterval)
      }));
    })
    .catch(function (e) { setMsg("listMsg", e.message, true); })
    .finally(function () {
      if (syncBtn) syncBtn.disabled = false;
      if (forceBtn) forceBtn.disabled = false;
    });
}
function syncOne(apiKey, btn) {
  btn.disabled = true;
  setMsg("listMsg", t("syncing"));
  api("/api/keys/sync", { method: "POST", body: JSON.stringify({ apiKey: apiKey, force: true }) })
    .then(handle)
    .then(function (data) {
      if (data.settings) applySettings(data.settings);
      renderKeys(data.keys || []);
      var left = data.key ? (money(data.key.creditRemaining) + " / " + (data.key.creditLimit > 0 ? money(data.key.creditLimit) : t("unlimited"))) : "";
      setMsg("listMsg", t("updated", { v: left }));
    })
    .catch(function (e) { setMsg("listMsg", e.message, true); })
    .finally(function () { btn.disabled = false; });
}
function loadKeys(forceRefresh) {
  var path = forceRefresh ? "/api/keys?refresh=1" : "/api/keys";
  var btn = document.getElementById("refreshBtn");
  if (btn) btn.disabled = true;
  return api(path)
    .then(handle)
    .then(function (data) {
      showApp();
      applySettings(data.settings, data.usageSyncIntervalPresets);
      renderKeys(data.keys || []);
      setMsg("listMsg", "");
    })
    .catch(function (e) {
      if (e.message !== "unauthorized") setMsg("listMsg", e.message, true);
    })
    .finally(function () { if (btn) btn.disabled = false; });
}

init();
</script>
</body>
</html>`;

export const ADMIN_HTML = HTML;
