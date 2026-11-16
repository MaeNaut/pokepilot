# Analysis operations on Cloudflare

## Status and scope

2026-11-16: production cutover deployed from `6b2fc00` after a verified maintenance
window and 465-second drain. Resumed Worker version:
`3736fd91-0961-49f8-a12f-bef06dc41df5`. Public site and guest authentication
boundaries passed direct checks after propagation. The first CI smoke ran too
early and saw the old maintenance response; the follow-up release waits for
admission to resume before running the full verification.

The owner confirmed one successful production Luna low analysis after cutover.
Deployment automation itself did not make a paid OpenAI call, extract a session,
or decrypt a user key. The old Upstash database and Worker secrets remain intact;
service deletion is a separate irreversible cleanup decision.

The old aliased QA URL returned 404 after the Worker began exporting a Durable
Object. Cloudflare does not generate Version URLs for Workers implementing a
Durable Object. QA alias upload was removed from CI rather than treating that
404 as a production authentication failure. `wrangler.qa.jsonc` now describes
a separately deployed `qa-pokepilot` Worker, bound to the production gate class
but the distinct `analysis-v1:qa` object and existing QA D1. The `QA` workflow
now bootstraps/deploys it on `develop` pushes, without changing production.
Authenticated QA remains pending until the separate Worker's existing
OAuth/session secrets are registered securely. The workflow checks secret names
only and labels a missing-secret deployment as bootstrap only, not login-ready.

Account data, teams, preferences, encrypted personal keys, analysis history, and
daily usage aggregates remain in D1. They are not migrated or rewritten here.
OpenAI and the public game-data providers remain external services.

## Runtime

- `worker/entry.ts` exports the existing router and `PokePilotAnalysisGate`.
- Wrangler uses the supported imperative `migrations` entry for the new class
  rather than declarative `exports`. The class is still SQLite-backed; Miniflare tests use its current
  declarative configuration API. Version URLs are unavailable for the owning Worker.
- `POKEPILOT_ANALYSIS_GATE` binds a SQLite-backed Durable Object. Its fixed name
  is `analysis-v1:production` or `analysis-v1:qa`, selected only by Worker config.
  QA references the production class namespace, so the separate names are essential.
  Never let a browser select a gate name or override the configured limits.
- The gate atomically enforces the existing sliding 60-second request window:
  20 accepted requests/account and 80/IP hash. Denied requests do not add entries.
- A second RPC acquires an expiring analysis permit: two/account and 64 globally
  per environment. The permit expires after 450 seconds and is explicitly released
  after success or failure. Provider timeouts remain 140 seconds (low) and 390
  seconds (medium), including stalled response bodies.
- The Worker generates unique tokens before RPC; repeated admission/acquisition
  with the same token is idempotent. A token cannot be reassigned to another owner.
  Release is token-specific and repeatable. Lost acquisition responses may hold a
  permit until expiry; failures never start a paid provider call without permission.
- Only opaque account IDs, IP hashes, timestamps and random permit/request tokens
  cross the gate. Keys, team contents, prompts, analysis results and raw IPs do not.
- Expired rows are pruned on use and by idle cleanup alarms. Logical expiration
  applies immediately; physical live-row cleanup can lag by about 60 seconds,
  excluding platform outages. Cloudflare storage backups follow its platform policy.
- OpenAI execution stays in the regular Worker. The gate never holds an RPC open
  while waiting for a model. Cleanup failures log a generic warning without
  changing a paid result or its original provider-error classification.
- No public gate-management endpoint is added. Missing bindings, invalid scope,
  RPC or storage failures fail closed. There is no public memory fallback.

The existing local in-flight map still merges identical requests within one
Worker instance, including their provider errors and billing uncertainty. This
is not cross-Worker result deduplication, and it was not before this migration
in `personal` mode. Public personal-key requests do not cache analysis results.
Local Vite/evaluation retains its in-memory cache and test modes.

The Upstash adapter, Lua scripts, Redis SDK and `dev:shared` credentials template
are removed. Ignored local secrets are deliberately not modified. Historical
QA/evaluation records mentioning Redis describe those earlier runs, not the
current dependency. The retired `distributed` and `shouldShare` run-once options
are also removed; local sharing still follows the existing in-flight lifecycle.

## Verification

Local and initial CI verification on 2026-11-16 passed 1,529 tests across 174 files, lint,
TypeScript, the Cloudflare asset build, and production/QA Wrangler dry runs.
The dependency audit passed the existing high-severity gate; nine pre-existing
moderate development-tool advisories remain. No paid provider calls were made.

```bash
npx vitest run worker/analysisGate.test.ts server/durablePokePilotOperations.test.ts worker/personalApiKeyRouting.test.ts
npm run check:cloudflare
npm run audit:all
npx wrangler deploy --dry-run --config wrangler.qa.jsonc
```

Gate tests use Miniflare's real workerd and SQLite without external data, an
OpenAI key, or paid provider calls. They cover simultaneous admission and
capacity, multiple Worker callers sharing one gate, idempotency, owner mismatch,
expiry, idle cleanup, environment isolation and object eviction/recreation.
Adapter/router tests cover local followers, pre-call failures, provider failures,
cleanup failures, missing bindings and invalid scopes. They do not establish
production deployment permissions, live RPC latency, or authenticated model QA.

## First release and retirement

1. Keep the old Upstash database active and retain the previous release commit.
   No Redis contents need copying: only short-lived control state is active.
2. Verify all local/CI checks. The deployment token must support Worker uploads,
   the SQLite Durable Object class migration, existing routes, and D1 migrations.
   Do not weaken the migration gate or print tokens to diagnose permission errors.
3. A `versions upload` is not a substitute for deploying the class migration,
   and Version URLs are unavailable on the class-owning Worker. Deploy production
   with `wrangler.jsonc`; QA must be a separate Worker with its own secrets/D1.
4. The first cutover used a verified `POKEPILOT_ANALYSIS_PAUSED=true` deployment
   and a 465-second drain before restoring the default `false`. Authentication,
   team storage and public tools remained available. Old Redis and new Durable
   Object budgets are independent, so the old 450-second leases were drained.
   The one-time cutover script and CI pause/wait steps are now retired: ordinary
   deployments must never automatically repeat that maintenance window.
   The server-only pause flag remains available for explicit operator maintenance.
   When inspecting releases, use `/deployments` and the active version's resources,
   not `/settings`, which may describe a later undeployed QA upload. The temporary
   settings-based check caused an unnecessary second drain during this release;
   it and the replacement detector were removed after completing the migration.
5. Deploy `wrangler.jsonc`, including `v1-analysis-gate` and production scope;
   then restore admission. Verify authentication boundaries, one authenticated
   analysis, permit release/failure recovery and history restoration. Use the
   QA scope for saturation probes, never consume the production global budget.
6. Check Cloudflare errors and actual gate invocation/storage metrics. There is
   no new public debug endpoint and no keepalive job. Paid Workers includes
   Durable Objects allowances, but requests, duration, storage and alarms are
   metered; do not claim the migration is unconditionally free.
7. After acceptance, remove `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, and obsolete Redis/shared-store variables from
   Cloudflare. Retire the old database only after deciding rollback will be a
   tested forward fix. An old Worker version may still require those secrets;
   deleting the database makes an old-code rollback unsafe. Cloudflare may also
   reject rollbacks that cross a class-lifecycle change: prepare a forward fix
   retaining the class export/binding, not an assumed one-click rollback.

No old service or credential was deleted during this release.

## References

- [Durable Object RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/)
- [SQLite storage and transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Rate Limiting API locality and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Version upload and class lifecycle restrictions](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/)
- [Version URL limitations](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
