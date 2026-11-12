# Server-Side Service Usage Metrics

Implemented 2026-11-12. Activation requires migration 0005 and a production
deployment. This document is not evidence that collection is already live.

## Decision and Privacy Boundary

To avoid depending on country-specific analytics consent exemptions, the app
has **no custom browser event collector**. No click/page-load beacon, analytics
endpoint, heartbeat, session/visitor identifier, fingerprint, last-visit date or
return-visit tracking. The unreleased browser-event prototype and its component
instrumentation were removed.

The Worker increments daily totals while serving actual functional API requests.
It initiates no extra requests, inspects no device capabilities and does not read
bodies again for analytics or store raw logs. The only new table fields are UTC
day, fixed operation, HTTP status, latency bucket, request count and summed elapsed
milliseconds. No account/IP/session identifier, user agent, referrer, geographic
or device segment, precise event time, team name, Pokemon ID, body, prompt or
generated text is stored. Pokemon-specific paths and queries are discarded.

Use is limited to service availability, reliability, capacity and feature
operation measurement. Do not join totals to account records, infer individual
journeys, or use them for targeting/rewards. Hosting/auth/abuse prevention still
process necessary metadata under their separate policies. No new raw logging
is enabled by this change.

This is a conservative technical boundary, not legal certification for every
country. "Cookieless means no consent everywhere" is incorrect:

- [EDPB Guidelines 2/2023, version 2](https://www.edpb.europa.eu/system/files/documents/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)
  explain that local processing reported back from a device can still fall
  within ePrivacy Article 5(3); exemptions require a separate assessment.
- [LfDI Baden-Wuerttemberg guidance, section 3.1](https://www.baden-wuerttemberg.datenschutz.de/faq-zu-cookies-und-tracking-2/)
  distinguishes passive server-request analysis from initiated device access,
  while still requiring assessment of subsequent processing.
- [ICO statistical-purpose exception](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/)
  is a regional exception, not worldwide permission for client analytics.

Future client-side measurement, segmentation, third-party analytics, recognition
or advertising needs a fresh review. This change does not certify or alter the
separate existing Cloudflare Web Analytics browser script/dashboard configuration.

## Refusal

The Privacy dialog has an API-use statistics switch, without an opt-in banner.
Only explicit refusal is stored in localStorage, as a preference rather than an
activity record. No measurement uses sessionStorage. Existing functional API
calls carry `X-PokePilot-Usage-Opt-Out: 1` when disabled; there is no extra request
or visitor ID. The server also honors DNT and Sec-GPC independently.

The separate [operational metrics](OPERATIONAL_METRICS.md) table remains a basic
API reliability/resource aggregate. This switch does not suppress those counters
or Cloudflare's separate measurements. Refusal never blocks app functionality.
QA/preview hosts do not collect. Disable the switch on each production browser
used for testing to exclude those calls from the additional usage report.

## Coverage and Meaning

| Operation | What is counted |
| --- | --- |
| `account_read`, `account_delete`, `logout` | Profile checks, deletion and logout requests; not unique logins/signups |
| `team_read`, `team_write` | Library reads and writes rejected before validating a specific mutation |
| `team_create`, `team_update`, `team_delete`, `team_reorder` | Validated mutation attempts and their HTTP outcomes |
| `history_read`, `history_write` | History storage requests, not analyses inside a payload |
| `preferences_read`, `preferences_write` | Account preference storage requests |
| `key_status`, `key_save`, `key_delete` | Status reads, key saves and removals, kept separate |
| `analysis` | Functional analysis requests, not displayed-history restores |
| `battle_snapshot_singles/doubles` | Ranked-data snapshot requests by format |
| `battle_detail_singles/doubles` | Per-Pokemon data requests, without Pokemon IDs |
| `legacy_teams_read/write` | Legacy storage requests, not new per-team operations |

Each actual request can increment a counter: **no per-page deduplication**.
Successful key saves do not prove provider validity. HTTP 409 can mean stale
state or capacity limits. Team writes include autosave/rename/duplication through
the same API; reads include focus refreshes. Retries, bots and unauthenticated
requests can increase attempts. Timing is wall-clock request time including
network waits, not CPU time or exact percentiles.

Browser-only edits, damage calculations, guide clicks/views, page visits,
countries, sources, devices, unique users, returns and ordered journeys are
**not measured** here. Client caches can avoid API requests. Empty reports do
not prove nobody used the app. No quality-improvement dataset is collected.

## Reports and Deployment

```sh
npx wrangler d1 migrations apply pokepilot --remote
npm run deploy:cloudflare
npm run --silent usage:report -- --remote --days=7
npm run --silent usage:report -- --remote --days=30
npm run --silent metrics:report -- --remote --days=30
```

Main CI applies migrations before deployment. `usage:report` returns versioned
JSON with attempts, successes, rejections, server errors, HTTP 409 counts, mean
duration and per-operation totals plus daily histograms. `metrics:report` adds
model/scope/reasoning/funding groups, latency histograms, tokens, cache outcomes
and cost estimates. Reports overlap: do not add their request totals together.
Costs are estimates, not invoices or quality scores.

Wrangler authorization is required; no public metrics read/write endpoint
exists. Omit `--remote` for local reports. The current UTC day is incomplete;
earlier user behavior cannot be reconstructed. New preflight failures have
unknown model labels; older operational rows retain their previous semantics.

Migration 0005 changed before production deployment. If a prototype was applied
locally, execute the revised SQL file locally to create `service_usage_metrics`.
Old prototype tables are not read/combined. No production conversion is needed.

## Reliability and Retention

- `POKEPILOT_USAGE_METRICS_ENABLED=false` stops additional counters; the separate
  `POKEPILOT_METRICS_ENABLED` controls operational counters. Daily cleanup still
  removes rows older than 90 days when writes are disabled.
- Best-effort writes use `waitUntil` and cannot alter functional responses.
  Only fixed operations, HTTP statuses and latency buckets enter dimensions.
- One additional atomic D1 upsert per operation, plus any existing operational
  upsert. No model call, analytics SDK, raw event storage, new secret or public
  ingestion/rate-limit binding is required.
- Generic warnings contain no payload or DB details. Lost writes lower totals;
  this is not a billing/rewards/authorization ledger.
- Tests cover actual request counting, validated mutations, private-field
  omission, refusal propagation, no client collector, failure isolation, real
  SQLite upserts/schema, reports and retention.

Release CI performs unpaid authentication-boundary requests after deployment,
then reads only aggregate row/request totals from D1 to check the new table.
No account, key or team records are queried by this release check.
