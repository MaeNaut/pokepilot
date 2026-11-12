CREATE TABLE IF NOT EXISTS service_usage_metrics (
  day TEXT NOT NULL,
  operation TEXT NOT NULL,
  status INTEGER NOT NULL,
  latency_bucket TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, operation, status, latency_bucket)
) WITHOUT ROWID;
