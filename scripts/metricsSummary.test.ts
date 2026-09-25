import { describe, expect, it } from "vitest";
import { readAnalysisDimensions, summarizeMetrics } from "./metricsSummary";

describe("metrics reporting", () => {
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
