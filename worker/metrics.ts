import type { PokePilotOperationalEvent } from "../server/pokepilotApi.js";
import { OPENAI_LUNA_MODEL_ID, POKEPILOT_AI_PROMPT_VERSION } from "../server/openAiLuna.js";
import type { WorkerEnvironment } from "./env.js";

const routes = new Set([
  "/api/auth/google", "/api/auth/google/callback", "/api/auth/logout",
  "/api/pokepilot/account", "/api/pokepilot/teams",
  "/api/pokepilot/analysis-history", "/api/pokepilot/preferences", "/api/pokepilot/analyze",
  "/api/pokepilot/personal-api-key",
]);

export function metricRoute(path: string) {
  return routes.has(path) ? path : null;
}

export function latencyBucket(ms: number) {
  if (ms < 500) return "lt_500ms";
  if (ms < 2000) return "lt_2s";
  if (ms < 10000) return "lt_10s";
  if (ms < 30000) return "lt_30s";
  return "gte_30s";
}

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;
}

// Explicit field selection prevents identity, fingerprints, and request bodies
// from entering the aggregate even when operational events gain new properties.
export function metricValues(route: string, status: number, elapsed: number, event?: PokePilotOperationalEvent, now = new Date()) {
  const analysis = event?.type === "analysis" ? event : undefined;
  const failed = event?.type === "analysis-failure" ? event : undefined;
  const paid = analysis?.cacheStatus === "miss" ? analysis : undefined;
  const duration = Math.round(positive(elapsed));
  return [
    now.toISOString().slice(0, 10), route, status, event?.scope ?? "unknown",
    failed
      ? failed.billingSource === "personal" ? `personal-${failed.reasoningEffort}-failed` : "failed"
      : analysis?.billingSource === "personal"
      ? `personal-${analysis.reasoningEffort ?? "low"}-${analysis.cacheStatus}`
      : analysis?.cacheStatus ?? (event?.type === "cooldown" ? "cooldown" : "none"),
    route === "/api/pokepilot/analyze" ? analysis?.modelId ?? failed?.modelId ?? OPENAI_LUNA_MODEL_ID : "none",
    route === "/api/pokepilot/analyze" ? POKEPILOT_AI_PROMPT_VERSION : 0,
    latencyBucket(duration), duration,
    positive(failed?.usage.inputTokens ?? paid?.inputTokens), positive(failed?.usage.outputTokens ?? paid?.outputTokens),
    positive(failed?.usage.cachedInputTokens ?? paid?.cachedInputTokens), positive(failed?.usage.cacheWriteTokens ?? paid?.cacheWriteTokens), positive(failed?.usage.costUsd ?? paid?.costUsd),
  ];
}

export async function recordMetric(env: WorkerEnvironment, route: string, status: number, elapsed: number, event?: PokePilotOperationalEvent) {
  if (env.POKEPILOT_METRICS_ENABLED !== "true") return;
  try {
    await env.DB.prepare(`INSERT INTO operational_metrics
      (day,route,status,scope,cache_status,model,prompt_version,latency_bucket,requests,duration_ms,input_tokens,output_tokens,cached_input_tokens,cache_write_tokens,estimated_cost_usd)
      VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)
      ON CONFLICT(day,route,status,scope,cache_status,model,prompt_version,latency_bucket)
      DO UPDATE SET requests=requests+1,duration_ms=duration_ms+excluded.duration_ms,
      input_tokens=input_tokens+excluded.input_tokens,output_tokens=output_tokens+excluded.output_tokens,
      cached_input_tokens=cached_input_tokens+excluded.cached_input_tokens,
      cache_write_tokens=cache_write_tokens+excluded.cache_write_tokens,
      estimated_cost_usd=estimated_cost_usd+excluded.estimated_cost_usd`)
      .bind(...metricValues(route, status, elapsed, event)).run();
  } catch {
    console.warn("[PokePilot metrics] Aggregate write failed.");
  }
}

export async function pruneMetrics(env: WorkerEnvironment) {
  try {
    await env.DB.prepare("DELETE FROM operational_metrics WHERE day < date('now', '-90 days')").run();
  } catch {
    console.warn("[PokePilot metrics] Retention cleanup failed.");
  }
}
