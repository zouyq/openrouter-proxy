import { queryKey, type KeySnapshot } from "./openrouter-client.js";

export type KeyStatus = "active" | "exhausted" | "deprecated";
export type LoadBalanceStrategy = "most_remaining" | "least_requests" | "round_robin" | "lru";
export const LOAD_BALANCE_STRATEGIES: LoadBalanceStrategy[] = ["most_remaining", "least_requests", "round_robin", "lru"];
export const USAGE_SYNC_INTERVAL_PRESETS = [900, 1800, 3600, 10800, 21600, 43200, 86400] as const;
const MIN_SYNC = 900, MAX_SYNC = 86400, LOCK_SECS = 900, GAP_MS = 1000;

export interface PoolConfig {
  strategy: LoadBalanceStrategy; rrIndex: number; usageSyncIntervalSecs: number;
  lastSyncStartedAt: number; syncLockUntil: number; maxNetworkFailures: number; quotaProbeLeadSecs: number;
}
export interface KeyInfo {
  apiKey: string; mask: string; status: KeyStatus; note: string; creditLimit: number; creditUsage: number;
  creditRemaining: number; limitReset: string; requestCount: number; consecutiveNetworkFailures: number;
  cooldownUntil: number; quotaResetAt: number; lastUsedAt: number; creditSyncedAt: number;
  lastError: string; lastErrorType: string; lastSyncError: string; planName: string; label: string;
  addedAt: number; statusChangedAt: number; deprecatedAt: number; lastCallAt: number;
  lastCallEndpoint: string; lastCallStatus: string; lastClientIp: string; lastColo: string;
  lastCountry: string; lastUserAgent: string;
}
export type KeyCallMeta = { endpoint: string; status: string; clientIp?: string; colo?: string; country?: string; userAgent?: string };
export type SyncUsageOptions = { force?: boolean; minAgeSecs?: number; allowReviveExhausted?: boolean };
type KeyRow = Record<string, unknown>;
const now = () => Math.floor(Date.now() / 1000);
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const text = (v: unknown) => typeof v === "string" ? v : "";

export function maskKey(key: string): string {
  return key.length <= 14 ? `${key.slice(0, 7)}...` : `${key.slice(0, 8)}...${key.slice(-4)}`;
}
export function quotaResetAt(limitReset: string, at = now()): number {
  const d = new Date(at * 1000), y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (limitReset === "daily") return Math.floor(Date.UTC(y, m, d.getUTCDate() + 1) / 1000);
  if (limitReset === "weekly") return Math.floor(Date.UTC(y, m, d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)) / 1000);
  return Math.floor(Date.UTC(y, m + 1, 1) / 1000);
}
function toKey(r: KeyRow): KeyInfo {
  return {
    apiKey: text(r.api_key), mask: text(r.mask), status: (["exhausted", "deprecated"].includes(text(r.status)) ? text(r.status) : "active") as KeyStatus,
    note: text(r.note), creditLimit: num(r.credit_limit), creditUsage: num(r.credit_usage), creditRemaining: num(r.credit_remaining),
    limitReset: text(r.limit_reset), requestCount: num(r.request_count), consecutiveNetworkFailures: num(r.consecutive_network_failures),
    cooldownUntil: num(r.cooldown_until), quotaResetAt: num(r.quota_reset_at), lastUsedAt: num(r.last_used_at), creditSyncedAt: num(r.credit_synced_at),
    lastError: text(r.last_error), lastErrorType: text(r.last_error_type), lastSyncError: text(r.last_sync_error), planName: text(r.plan_name),
    label: text(r.label), addedAt: num(r.added_at), statusChangedAt: num(r.status_changed_at), deprecatedAt: num(r.deprecated_at),
    lastCallAt: num(r.last_call_at), lastCallEndpoint: text(r.last_call_endpoint), lastCallStatus: text(r.last_call_status),
    lastClientIp: text(r.last_client_ip), lastColo: text(r.last_colo), lastCountry: text(r.last_country), lastUserAgent: text(r.last_user_agent),
  };
}
async function row(db: D1Database, key: string) { return db.prepare("SELECT * FROM keys WHERE api_key=?").bind(key).first<KeyRow>(); }
export async function listKeys(db: D1Database) {
  const result = await db.prepare("SELECT * FROM keys ORDER BY mask").all<KeyRow>();
  return (result.results ?? []).map(toKey);
}
function configFrom(r: KeyRow | null): PoolConfig {
  const strategy = LOAD_BALANCE_STRATEGIES.includes(text(r?.strategy) as LoadBalanceStrategy) ? text(r?.strategy) as LoadBalanceStrategy : "most_remaining";
  return { strategy, rrIndex: num(r?.rr_index), usageSyncIntervalSecs: Math.max(MIN_SYNC, Math.min(MAX_SYNC, num(r?.usage_sync_interval_secs) || 86400)),
    lastSyncStartedAt: num(r?.last_sync_started_at), syncLockUntil: num(r?.sync_lock_until), maxNetworkFailures: Math.max(1, num(r?.max_network_failures) || 5), quotaProbeLeadSecs: num(r?.quota_probe_lead_secs) || 3600 };
}
export async function getPoolConfig(db: D1Database) { return configFrom(await db.prepare("SELECT * FROM settings WHERE id=1").first<KeyRow>()); }
export async function setPoolConfig(db: D1Database, patch: Partial<PoolConfig>) {
  const old = await getPoolConfig(db);
  const next: PoolConfig = { ...old, ...patch, strategy: patch.strategy && LOAD_BALANCE_STRATEGIES.includes(patch.strategy) ? patch.strategy : old.strategy,
    usageSyncIntervalSecs: patch.usageSyncIntervalSecs === undefined ? old.usageSyncIntervalSecs : Math.max(MIN_SYNC, Math.min(MAX_SYNC, Math.floor(Number(patch.usageSyncIntervalSecs) || old.usageSyncIntervalSecs))),
    maxNetworkFailures: patch.maxNetworkFailures === undefined ? old.maxNetworkFailures : Math.max(1, Math.min(100, Math.floor(Number(patch.maxNetworkFailures) || old.maxNetworkFailures))),
    quotaProbeLeadSecs: patch.quotaProbeLeadSecs === undefined ? old.quotaProbeLeadSecs : Math.max(0, Math.floor(Number(patch.quotaProbeLeadSecs) || 0)) };
  await db.prepare("UPDATE settings SET strategy=?,rr_index=?,usage_sync_interval_secs=?,last_sync_started_at=?,sync_lock_until=?,max_network_failures=?,quota_probe_lead_secs=? WHERE id=1")
    .bind(next.strategy,next.rrIndex,next.usageSyncIntervalSecs,next.lastSyncStartedAt,next.syncLockUntil,next.maxNetworkFailures,next.quotaProbeLeadSecs).run();
  return next;
}
function fields(snapshot: KeySnapshot) {
  const limit = snapshot.limit ?? 0, remaining = snapshot.remaining ?? 0;
  return { limit, remaining, usage: snapshot.usage, limitReset: snapshot.limitReset, label: snapshot.label, exhausted: limit > 0 && remaining <= 0 };
}
export async function addKey(db: D1Database, apiKey: string, note = "") {
  const key = apiKey.trim();
  if (!/^sk-or-/i.test(key)) throw new Error("OpenRouter key must start with sk-or-");
  if (await row(db, key)) throw new Error("Key already exists");
  const t = now(); let snap: KeySnapshot | null = null; let syncError = "";
  try { snap = await queryKey(key); } catch (e) { syncError = String(e).slice(0, 300); }
  const f = snap ? fields(snap) : { limit: 0, remaining: 0, usage: 0, limitReset: "", label: "", exhausted: false };
  await db.prepare(`INSERT INTO keys(api_key,mask,status,note,credit_limit,credit_usage,credit_remaining,limit_reset,request_count,consecutive_network_failures,cooldown_until,quota_reset_at,last_used_at,credit_synced_at,last_error,last_error_type,last_sync_error,plan_name,label,added_at,status_changed_at,deprecated_at)
    VALUES(?,?,?,?,?,?,?,?,0,0,0,?,0,?,'','none',?,'',?,?,?,0)`)
    .bind(key,maskKey(key),f.exhausted?"exhausted":"active",note.slice(0,200),f.limit,f.usage,f.remaining,f.limitReset,f.exhausted?quotaResetAt(f.limitReset,t):0,snap?t:0,syncError,f.label,t,t).run();
  const saved = await row(db,key); if (!saved) throw new Error("Failed to add key"); return toKey(saved);
}
export async function addKeys(db: D1Database, keys: string[], note = "") {
  const added: KeyInfo[] = [], skipped: { apiKey:string; mask:string; reason:string }[] = []; const seen = new Set<string>();
  for (const key of keys) { const k=key.trim(); if (!k || seen.has(k)) continue; seen.add(k); try { added.push(await addKey(db,k,note)); } catch(e) { skipped.push({apiKey:k,mask:maskKey(k),reason:String(e)}); } }
  return { added, skipped };
}
export async function deleteKey(db: D1Database, apiKey: string) { await db.prepare("DELETE FROM keys WHERE api_key=?").bind(apiKey).run(); }
export function isQuotaExhaustedError(statusOrText: number|string, detail="") {
  const value=`${statusOrText} ${detail}`.toLowerCase();
  return statusOrText===402 || /\b402\b|insufficient.{0,20}(credit|fund)|credit.{0,20}(exhaust|limit)|quota.{0,20}(exceed|limit)|out of credits/.test(value);
}
export async function isKeySelectable(db:D1Database,key:string) { const r=await row(db,key); if(!r) return false; const k=toKey(r); return k.status==="active" && k.cooldownUntil<=now() && (k.creditRemaining>0 || k.creditLimit===0); }
export async function pickBestKey(db: D1Database): Promise<string|null> {
  const candidates=(await listKeys(db)).filter(k=>k.status==="active"&&k.cooldownUntil<=now()&&(k.creditRemaining>0||k.creditLimit===0));
  if(!candidates.length) return null; const clean=candidates.filter(k=>k.consecutiveNetworkFailures===0); const pool=clean.length?clean:candidates; const c=await getPoolConfig(db);
  let selected=pool[0];
  if(c.strategy==="round_robin") selected=pool[c.rrIndex%pool.length];
  else pool.forEach(k=>{ if(c.strategy==="most_remaining" && (k.creditRemaining>selected.creditRemaining || (k.creditRemaining===selected.creditRemaining&&k.requestCount<selected.requestCount)))selected=k;
    if(c.strategy==="least_requests" && (k.requestCount<selected.requestCount || (k.requestCount===selected.requestCount&&k.creditRemaining>selected.creditRemaining)))selected=k;
    if(c.strategy==="lru" && k.lastUsedAt<selected.lastUsedAt)selected=k; });
  await db.prepare("UPDATE keys SET request_count=request_count+1,last_used_at=? WHERE api_key=?").bind(now(),selected.apiKey).run();
  if(c.strategy==="round_robin") await setPoolConfig(db,{rrIndex:(c.rrIndex+1)%pool.length}); return selected.apiKey;
}
export async function markExhausted(db:D1Database,key:string,message="") {
  const r=await row(db,key), k=r&&toKey(r), t=now(), reset=k&&k.quotaResetAt>t?k.quotaResetAt:quotaResetAt(k?.limitReset||"",t);
  await db.prepare("UPDATE keys SET status='exhausted',status_changed_at=?,quota_reset_at=?,credit_remaining=0,last_error=?,last_error_type='quota' WHERE api_key=?").bind(t,reset,message.slice(0,300),key).run();
}
export async function setCooldown(db:D1Database,key:string,until:number) { await db.prepare("UPDATE keys SET cooldown_until=MAX(cooldown_until,?),last_error='rate limited (429)',last_error_type='rate_limit' WHERE api_key=?").bind(until,key).run(); }
export async function recordNetworkFailure(db:D1Database,key:string,message:string,errorType:"network"|"auth"="network") {
  const r=await row(db,key); if(!r) return null; const k=toKey(r), conf=await getPoolConfig(db), failures=k.consecutiveNetworkFailures+1, t=now(), deprecated=failures>=conf.maxNetworkFailures;
  await db.prepare("UPDATE keys SET consecutive_network_failures=?,last_error=?,last_error_type=?,status=CASE WHEN ? THEN 'deprecated' ELSE status END,status_changed_at=CASE WHEN ? THEN ? ELSE status_changed_at END,deprecated_at=CASE WHEN ? THEN ? ELSE deprecated_at END WHERE api_key=?").bind(failures,message.slice(0,300),errorType,deprecated?1:0,deprecated?1:0,t,deprecated?1:0,t,key).run();
  const saved=await row(db,key); return saved?toKey(saved):null;
}
export async function recordSuccess(db:D1Database,key:string,cost:number|null) {
  const r=await row(db,key); if(!r) return null; const k=toKey(r), debit=Math.max(0,Number(cost)||0), usage=k.creditUsage+debit, remaining=k.creditLimit>0?Math.max(0,k.creditLimit-usage):Math.max(0,k.creditRemaining-debit), exhausted=k.creditLimit>0&&remaining<=0,t=now();
  await db.prepare("UPDATE keys SET credit_usage=?,credit_remaining=?,consecutive_network_failures=0,last_error='',last_error_type='none',status=CASE WHEN ? THEN 'exhausted' ELSE status END,status_changed_at=CASE WHEN ? THEN ? ELSE status_changed_at END,quota_reset_at=CASE WHEN ? THEN ? ELSE quota_reset_at END WHERE api_key=?").bind(usage,remaining,exhausted?1:0,exhausted?1:0,t,exhausted?1:0,quotaResetAt(k.limitReset,t),key).run();
  const saved=await row(db,key); return saved?toKey(saved):null;
}
export async function recordKeyCall(db:D1Database,key:string,m:KeyCallMeta) { await db.prepare("UPDATE keys SET last_call_at=?,last_call_endpoint=?,last_call_status=?,last_client_ip=?,last_colo=?,last_country=?,last_user_agent=? WHERE api_key=?").bind(now(),m.endpoint.slice(0,120),m.status.slice(0,40),(m.clientIp||"").slice(0,80),(m.colo||"").slice(0,16),(m.country||"").slice(0,8),(m.userAgent||"").slice(0,200),key).run(); }
async function saveSnapshot(db:D1Database,key:string,s:KeySnapshot,allowRevive=false) {
  const old=await row(db,key); if(!old) throw new Error("Key not found"); const k=toKey(old), f=fields(s),t=now(), locked=k.status==="exhausted"&&k.quotaResetAt>t&&!allowRevive;
  const status=locked?"exhausted":f.exhausted?"exhausted":k.status==="deprecated"&&!allowRevive?"deprecated":"active";
  const reset=status==="exhausted"?(locked?k.quotaResetAt:quotaResetAt(f.limitReset,t)):0;
  await db.prepare("UPDATE keys SET credit_limit=?,credit_usage=?,credit_remaining=?,limit_reset=?,label=?,credit_synced_at=?,last_sync_error='',status=?,status_changed_at=?,quota_reset_at=? WHERE api_key=?").bind(f.limit,f.usage,f.remaining,f.limitReset,f.label,t,status,status!==k.status?t:k.statusChangedAt,reset,key).run();
}
export async function syncKeyUsage(db:D1Database,key:string,opts:SyncUsageOptions={}) {
  const r=await row(db,key); if(!r) throw new Error("Key not found"); const k=toKey(r), conf=await getPoolConfig(db), age=opts.minAgeSecs??conf.usageSyncIntervalSecs;
  if(!opts.force&&k.creditSyncedAt&&now()-k.creditSyncedAt<age)return {...k,skipped:true};
  try { await saveSnapshot(db,key,await queryKey(key),opts.allowReviveExhausted); } catch(e) { const message=String(e).slice(0,300); await db.prepare("UPDATE keys SET last_sync_error=? WHERE api_key=?").bind(message,key).run(); if(isQuotaExhaustedError(message))await markExhausted(db,key,message); }
  const saved=await row(db,key); if(!saved)throw new Error("Key not found"); return {...toKey(saved),skipped:false};
}
export async function syncAllUsage(db:D1Database,opts:SyncUsageOptions={}) {
  const conf=await getPoolConfig(db),t=now(),keys=await listKeys(db); if(conf.syncLockUntil>t)return {synced:0,skipped:keys.length};
  await setPoolConfig(db,{lastSyncStartedAt:t,syncLockUntil:t+LOCK_SECS}); let synced=0,skipped=0;
  try { for(const key of keys.filter(k=>k.status==="active"||opts.force)){ const result=await syncKeyUsage(db,key.apiKey,opts); result.skipped?skipped++:synced++; if(!result.skipped)await new Promise(r=>setTimeout(r,GAP_MS)); } } finally { await setPoolConfig(db,{syncLockUntil:0}); }
  return {synced,skipped:skipped+keys.filter(k=>k.status!=="active"&&!opts.force).length};
}
export async function reactivateKey(db:D1Database,key:string) { await syncKeyUsage(db,key,{force:true,allowReviveExhausted:true}); const r=await row(db,key); if(!r)throw new Error("Key not found"); const k=toKey(r); if(k.creditLimit>0&&k.creditRemaining<=0)throw new Error("Key still has no available credit"); const t=now(); await db.prepare("UPDATE keys SET status='active',status_changed_at=?,deprecated_at=0,consecutive_network_failures=0,cooldown_until=0,quota_reset_at=0,last_error='',last_error_type='none' WHERE api_key=?").bind(t,key).run(); const updated=await row(db,key); if(!updated)throw new Error("Key not found"); return toKey(updated); }
async function probe(db:D1Database,status:KeyStatus) { const lead=(await getPoolConfig(db)).quotaProbeLeadSecs; const keys=(await listKeys(db)).filter(k=>status==="deprecated"?k.status==="deprecated":k.status==="exhausted"&&k.quotaResetAt<=now()+lead); let probed=0,revived=0,skipped=0; for(const k of keys){probed++;try{await saveSnapshot(db,k.apiKey,await queryKey(k.apiKey),true);const updated=await row(db,k.apiKey);if(updated&&toKey(updated).status==="active")revived++;else skipped++;}catch{skipped++;} }return {probed,revived,skipped};}
export const probeDeprecatedKeys=(db:D1Database)=>probe(db,"deprecated");
export const probeExhaustedKeys=(db:D1Database)=>probe(db,"exhausted");
export async function resetRequestCounts(db:D1Database) { const r=await db.prepare("UPDATE keys SET request_count=0").run(); await setPoolConfig(db,{rrIndex:0}); return r.meta.changes??0; }
export async function hasStaleUsage(db:D1Database) { const [keys,c]=await Promise.all([listKeys(db),getPoolConfig(db)]); return keys.some(k=>k.status==="active"&&(!k.creditSyncedAt||now()-k.creditSyncedAt>c.usageSyncIntervalSecs)); }
export function buildPoolStats(keys:KeyInfo[]) { const status:{[x:string]:number}={active:0,cooling:0,exhausted:0,deprecated:0}, failures:Record<string,number>={"0":0,"1-2":0,"3+":0},lastEndpoint:Record<string,number>={},lastResult:Record<string,number>={},countries:Record<string,number>={}; let limit=0,usage=0,remaining=0,picks=0; for(const k of keys){limit+=k.creditLimit;usage+=k.creditUsage;remaining+=k.creditRemaining;picks+=k.requestCount;status[k.status==="active"&&k.cooldownUntil>now()?"cooling":k.status]++;failures[k.consecutiveNetworkFailures===0?"0":k.consecutiveNetworkFailures<3?"1-2":"3+"]++;for(const [map,v] of [[lastEndpoint,k.lastCallEndpoint],[lastResult,k.lastCallStatus],[countries,k.lastCountry]] as const)if(v)map[v]=(map[v]||0)+1;}return {external:{keyCount:keys.length,healthy:status.active,creditLimit:limit,creditUsage:usage,creditRemaining:remaining,requestCount:picks},upstream:{status,failures,byKey:keys.map(k=>({mask:k.mask,remaining:k.creditRemaining,usage:k.creditUsage,picks:k.requestCount})).sort((a,b)=>b.remaining-a.remaining),lastEndpoint,lastResult,countries}}; }
export async function getPoolStats(db:D1Database) { return buildPoolStats(await listKeys(db)); }
