import { describe, expect, it } from "vitest";
import { summarizeUsageMetrics, type UsageMetricRow } from "./usageMetricsSummary";

describe("functional API operation report", () => {
  it("separates attempts, successes, failures, HTTP conflicts and mean duration", () => {
    const base: UsageMetricRow = { day: "2026-11-12", operation: "team_update", status: 200, latency_bucket: "lt_500ms", requests: 2, duration_ms: 100 };
    const result = summarizeUsageMetrics([base,
      { ...base, status: 409, requests: 1, duration_ms: 10 },
      { ...base, operation: "key_save", status: 503, requests: 1, duration_ms: 20 },
    ]);
    expect(result).toMatchObject({ attempts: 4, successfulResponses: 2, rejectedRequests: 1, serverErrors: 1, conflicts: 1, meanDurationMs: 32.5 });
    expect(result.byOperation.team_update).toMatchObject({ attempts: 3, successfulResponses: 2, conflicts: 1 });
    expect(result.byOperation.key_save).toMatchObject({ attempts: 1, successfulResponses: 0, serverErrors: 1 });
  });
  it("does not invent observations for an empty report", () => {
    expect(summarizeUsageMetrics([])).toMatchObject({ attempts: 0, meanDurationMs: null, byOperation: {} });
  });
});
