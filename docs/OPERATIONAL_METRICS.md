# Operational Metrics

## Activation

Apply the migration before deploying the Worker:

```sh
npx wrangler d1 migrations apply pokepilot --remote
npm run deploy:cloudflare -- --keep-vars
```

Production was activated on 2026-09-19 with migration 0003 and Worker version
`58162a06-1126-4aa3-b2c1-a7dc0e262268`. Three unauthenticated smoke-test requests
were confirmed in the remote report (401 responses, no paid AI calls).
For subsequent environments, use the migration/deployment order above.
`POKEPILOT_METRICS_ENABLED=false`
disables new writes. A daily 04:17 UTC scheduled job removes dates older than
90 days, including when collection is disabled. No existing user tables change.

## Reading Reports

```sh
npm run --silent metrics:report -- --remote --days=7
npm run --silent metrics:report -- --remote --days=30
```

Omit `--remote` for local data. Wrangler account authorization controls access;
there is no public metrics endpoint or new admin secret. Output is versioned JSON
with UTC dates, summary totals, caveats, and sorted aggregate rows. The current
day is incomplete. An empty report means no recorded observations, not verified
zero traffic. Historical data before activation cannot be reconstructed.

For future Codex reviews: run the 7-day and 30-day reports, separate account API
traffic from analysis traffic, group rows by prompt_version/model/scope, compare
5xx and 429 counts, cache hit/shared proportions, mean duration and latency
buckets, and tokens per cache-miss completion. Propose changes with the affected
date window and sample counts. Do not infer unique users or response quality.

## Semantics and Privacy

- One best-effort D1 atomic upsert per recognized API response, scheduled through
  waitUntil so failures do not change the user's response. Concurrent increments
  accumulate rather than overwrite. No page-view or frontend click tracking.
- Only fixed route names are stored: no query strings, identifiers, fingerprints,
  cookies, IPs, user agents, Pokemon teams, prompts, or generated text.
- Auth failures, invalid requests, and upstream failures are counted by HTTP
  status. OAuth redirects are counted as redirects, not confirmed login success.
- Scope is unknown when execution does not emit a validated operational event.
- Tokens and costs are counted only for completed cache misses. Cache hits and
  shared followers never count the producer's token usage again.
- Cost is the existing application's estimate, not a billing total. Failed
  upstream attempts may cost money without reporting tokens here. Pricing changes
  require maintaining the existing usage estimator; do not use this as an invoice.
- No raw satisfaction feedback or automated semantic quality score is collected.
- Aggregation bounds stored row growth, but each observed API call still incurs
  a database write. Monitor D1 usage as traffic grows. Missing best-effort writes
  mean these counters are operational evidence, not an accounting ledger.
- Cron execution and write failures emit generic warnings without database details.

## Verification

Unit tests cover field allowlisting, latency boundaries, cache cost deduplication,
the kill switch, retention query, DB failure isolation, and Worker integration.
An in-memory SQLite test executes the real migration and upsert twice to verify
accumulation. Local D1 migration and JSON report generation are also checked.
