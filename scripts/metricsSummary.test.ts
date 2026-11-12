import { describe, expect, it } from "vitest";
import { readAnalysisDimensions, summarizeMetrics, type MetricRow } from "./metricsSummary";

describe("metrics reporting", () => {
  it("groups existing model/scope/effort metrics without inventing rejected-call settings", () => {
    const rows: MetricRow[] = [
      { route: "/api/pokepilot/analyze", status: 200, model: "gpt-6-luna", scope: "team", requests: 2,
        cache_status: "personal-low-miss", duration_ms: 200, input_tokens: 1000, output_tokens: 300,
        cached_input_tokens: 20, estimated_cost_usd: 0.01, latency_bucket: "lt_500ms" },
      { route: "/api/pokepilot/analyze", status: 403, model: "unknown", scope: "unknown", requests: 1,
        cache_status: "none", duration_ms: 2, latency_bucket: "lt_500ms" },
    ];
    expect(summarizeMetrics(rows).analysisByConfiguration).toEqual([
      { model: "gpt-6-luna", scope: "team", reasoningEffort: "low", billingSource: "personal", attempts: 2,
        completedAnalyses: 2, serverErrors: 0, meanDurationMs: 100, inputTokens: 1000, outputTokens: 300,
        cachedInputTokens: 20, estimatedCostUsd: 0.01, latencyBuckets: { lt_500ms: 2 } },
      { model: "unknown", scope: "unknown", reasoningEffort: "unknown", billingSource: "unknown", attempts: 1,
        completedAnalyses: 0, serverErrors: 0, meanDurationMs: 2, inputTokens: 0, outputTokens: 0,
        cachedInputTokens: 0, estimatedCostUsd: 0, latencyBuckets: { lt_500ms: 1 } },
    ]);
  });
  it("counts both funding sources and separates their costs", () => {
    const rows = ["miss", "personal-medium-miss", "personal-low-hit", "personal-medium-shared"].map((cache_status) => ({
      route: "/api/pokepilot/analyze", status: 200, requests: 2, duration_ms: 20,
      cache_status, estimated_cost_usd: cache_status.endsWith("miss") ? 0.01 : 0,
    }));
    expect(summarizeMetrics(rows)).toMatchObject({ completedAnalyses: 8, cacheHits: 2, sharedResults: 2,
      estimatedSuccessfulCallCostUsd: 0.02, estimatedSiteCallCostUsd: 0.01, estimatedPersonalCallCostUsd: 0.01 });
  });
  it("does not invent historical effort or count errors as completed", () => {
    expect(readAnalysisDimensions("miss")?.reasoningEffort).toBe("unknown");
    expect(readAnalysisDimensions("personal-medium-error")).toBeNull();
    expect(summarizeMetrics([{ route: "/api/pokepilot/analyze", status: 500, cache_status: "miss", requests: 1 }]))
      .toMatchObject({ completedAnalyses: 0, serverErrors: 1 });
    expect(summarizeMetrics([])).toMatchObject({ requests: 0, meanDurationMs: null });
  });
  it("separates known failed-call cost from successful analysis cost", () => {
    const rows = [
      { route: "/api/pokepilot/analyze", status: 200, cache_status: "miss", requests: 1, estimated_cost_usd: 0.01 },
      { route: "/api/pokepilot/analyze", status: 502, cache_status: "personal-medium-failed", requests: 1, estimated_cost_usd: 0.03 },
    ];
    expect(summarizeMetrics(rows)).toMatchObject({
      completedAnalyses: 1, estimatedSuccessfulCallCostUsd: 0.01,
      estimatedFailedCallCostUsd: 0.03, estimatedTotalCallCostUsd: 0.04,
      estimatedSiteCallCostUsd: 0.01, estimatedPersonalCallCostUsd: 0.03,
    });
  });
});
