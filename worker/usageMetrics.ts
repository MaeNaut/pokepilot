import type { WorkerEnvironment } from "./env.js";
import { latencyBucket } from "./metrics.js";

export type TeamUsageOperation = "team_create" | "team_update" | "team_delete" | "team_reorder";
export const serviceOperations = [
  "account_read", "account_delete", "logout", "team_read", "team_write",
  "team_create", "team_update", "team_delete", "team_reorder",
  "history_read", "history_write", "preferences_read", "preferences_write",
  "legacy_teams_read", "legacy_teams_write", "key_status", "key_save", "key_delete",
  "analysis", "battle_snapshot_singles", "battle_snapshot_doubles",
  "battle_detail_singles", "battle_detail_doubles",
] as const;
export type ServiceOperation = typeof serviceOperations[number];

const routes: Record<string, Partial<Record<string, ServiceOperation>>> = {
  "/api/pokepilot/account": { GET: "account_read", DELETE: "account_delete" },
  "/api/auth/logout": { POST: "logout" },
  "/api/pokepilot/team-library": { GET: "team_read", PUT: "team_write" },
  "/api/pokepilot/teams": { GET: "legacy_teams_read", PUT: "legacy_teams_write" },
  "/api/pokepilot/analysis-history": { GET: "history_read", PUT: "history_write" },
  "/api/pokepilot/preferences": { GET: "preferences_read", PUT: "preferences_write" },
  "/api/pokepilot/personal-api-key": { GET: "key_status", PUT: "key_save", DELETE: "key_delete" },
  "/api/pokepilot/analyze": { POST: "analysis" },
};

export function serviceOperation(request: Request): ServiceOperation | null {
  const path = new URL(request.url).pathname;
  const fixed = Object.hasOwn(routes, path) && Object.hasOwn(routes[path], request.method) ? routes[path][request.method] : undefined;
  if (fixed) return fixed;
  const battle = /^\/api\/battle-usage\/(singles|doubles)(\/[a-z0-9-]{1,80})?$/.exec(path);
  if (request.method !== "GET" || !battle) return null;
  // The Pokemon-specific path is discarded before aggregation.
  return `battle_${battle[2] ? "detail" : "snapshot"}_${battle[1]}` as ServiceOperation;
}

export function allowsUsageMetrics(request: Request) {
  return new URL(request.url).hostname === "pokepilot.app"
    && request.headers.get("DNT") !== "1" && request.headers.get("Sec-GPC") !== "1"
    && request.headers.get("X-PokePilot-Usage-Opt-Out") !== "1";
}

export async function recordUsageMetric(env: WorkerEnvironment, operation: ServiceOperation, status: number, elapsed: number) {
  if (env.POKEPILOT_USAGE_METRICS_ENABLED !== "true") return;
  if (!serviceOperations.includes(operation) || !Number.isInteger(status) || status < 100 || status > 599) return;
  const duration = Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0;
  try {
    await env.DB.prepare(`INSERT INTO service_usage_metrics
      (day,operation,status,latency_bucket,requests,duration_ms) VALUES (?,?,?,?,1,?)
      ON CONFLICT(day,operation,status,latency_bucket)
      DO UPDATE SET requests=requests+1,duration_ms=duration_ms+excluded.duration_ms`)
      .bind(new Date().toISOString().slice(0, 10), operation, status, latencyBucket(duration), duration).run();
  } catch { console.warn("[PokePilot usage metrics] Aggregate write unavailable."); }
}

export async function pruneUsageMetrics(env: WorkerEnvironment) {
  try {
    await env.DB.prepare("DELETE FROM service_usage_metrics WHERE day < date('now', '-90 days')").run();
  } catch { console.warn("[PokePilot usage metrics] Retention cleanup unavailable."); }
}
