CREATE TABLE operational_metrics (
  day TEXT NOT NULL,
  route TEXT NOT NULL,
  status INTEGER NOT NULL,
  scope TEXT NOT NULL,
  cache_status TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  latency_bucket TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, route, status, scope, cache_status, model, prompt_version, latency_bucket)
);
