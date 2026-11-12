export type UsageMetricRow = {
  day: string; operation: string; status: number; latency_bucket: string;
  requests: number; duration_ms: number;
};

function totals(rows: UsageMetricRow[]) {
  const attempts = rows.reduce((sum, row) => sum + row.requests, 0);
  const countStatus = (min: number, max: number) => rows.filter(row => row.status >= min && row.status < max)
    .reduce((sum, row) => sum + row.requests, 0);
  return {
    attempts, successfulResponses: countStatus(200, 300),
    rejectedRequests: countStatus(400, 500), serverErrors: countStatus(500, 600),
    conflicts: rows.filter(row => row.status === 409).reduce((sum, row) => sum + row.requests, 0),
    meanDurationMs: attempts ? rows.reduce((sum, row) => sum + row.duration_ms, 0) / attempts : null,
  };
}

export function summarizeUsageMetrics(rows: UsageMetricRow[]) {
  const operations = [...new Set(rows.map(row => row.operation))].sort();
  return {
    ...totals(rows),
    byOperation: Object.fromEntries(operations.map(operation => [operation, totals(rows.filter(row => row.operation === operation))])),
  };
}
