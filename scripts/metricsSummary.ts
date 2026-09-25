export type MetricRow = Record<string, string | number>;

export function readAnalysisDimensions(value: string) {
  const personal = /^personal-(low|medium)-(hit|miss|shared)$/.exec(value);
  if (personal) return { billingSource: "personal", reasoningEffort: personal[1], cacheStatus: personal[2] };
  if (["hit", "miss", "shared"].includes(value)) {
    return { billingSource: "site", reasoningEffort: "unknown", cacheStatus: value };
  }
  return null;
}

export function summarizeMetrics(rows: MetricRow[]) {
  const sum = (key: string, selected = rows) => selected.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const requests = sum("requests");
  const analysis = rows.filter((row) => row.route === "/api/pokepilot/analyze");
  const completed = analysis.filter((row) => Number(row.status) >= 200 && Number(row.status) < 300 && readAnalysisDimensions(String(row.cache_status)));
  const dimensions = (row: MetricRow) => readAnalysisDimensions(String(row.cache_status));
  const costs = (billingSource: string) => sum("estimated_cost_usd", completed.filter((row) => dimensions(row)?.billingSource === billingSource));
  return {
    requests,
    serverErrors: sum("requests", rows.filter((row) => Number(row.status) >= 500)),
    meanDurationMs: requests ? sum("duration_ms") / requests : null,
    analysisRequests: sum("requests", analysis),
    completedAnalyses: sum("requests", completed),
    cacheHits: sum("requests", completed.filter((row) => dimensions(row)?.cacheStatus === "hit")),
    sharedResults: sum("requests", completed.filter((row) => dimensions(row)?.cacheStatus === "shared")),
    inputTokens: sum("input_tokens"), outputTokens: sum("output_tokens"),
    cachedInputTokens: sum("cached_input_tokens"), cacheWriteTokens: sum("cache_write_tokens"),
    estimatedSuccessfulCallCostUsd: sum("estimated_cost_usd"),
    estimatedSiteCallCostUsd: costs("site"),
    estimatedPersonalCallCostUsd: costs("personal"),
  };
}
