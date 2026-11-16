# Analysis operations on Cloudflare

## Status and scope

2026-11-16: implementation and local verification in this revision. Production
cutover, authenticated deployed QA, and deletion of the old service are separate
release steps, not established by local tests. Do not delete the Upstash database
or its Worker secrets until the new release is verified and rollback is resolved.

Account data, teams, preferences, encrypted personal keys, analysis history, and
daily usage aggregates remain in D1. They are not migrated or rewritten here.
OpenAI and the public game-data providers remain external services.

## Runtime

- `worker/entry.ts` exports the existing router and `PokePilotAnalysisGate`.
- Wrangler uses the supported imperative `migrations` entry for the new class
  rather than switching the existing aliased-QA deployment workflow to declarative
  `exports`. The class is still SQLite-backed; Miniflare tests use its current
  declarative configuration API.
- `POKEPILOT_ANALYSIS_GATE` binds a SQLite-backed Durable Object. Its fixed name
  is `analysis-v1:production` or `analysis-v1:qa`, selected only by Worker config.
  Aliased versions share the class namespace, so their separate names are essential.
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

Local verification on 2026-11-16 passed 1,521 tests across 173 files, lint,
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
3. If the new class does not exist yet, an aliased `versions upload` is not a
   substitute for deploying its migration. Either use a separately deployed
   staging Worker with its own secrets/D1 or plan the first controlled production
   migration; never deploy the aliased QA config over the production Worker.
4. CI inspects the active Worker's bindings and production scope. On the first
   cutover (or a retry of an interrupted paused release), it deploys the verified
   build with `POKEPILOT_ANALYSIS_PAUSED=true`, confirms the no-cost maintenance
   response and waits 465 seconds before the normal deployment sets the flag
   back to `false`. This drains the full 450-second old lease window plus margin.
   Ordinary post-cutover deployments do not pause. If the paused release succeeds
   but a later step fails, analysis remains paused: investigate immediately and
   re-run the current main commit; do not claim the site resumed automatically.
   Authentication, team storage and public tools remain available. Old Redis and new Durable Object budgets are
   independent; a rolling switch with both accepting requests is not one strict
   global limit. Authenticated sessions and D1 data are unchanged.
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

No service, credential or deployed Worker is deleted by this implementation.

## References

- [Durable Object RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/)
- [SQLite storage and transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Rate Limiting API locality and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Version upload and class lifecycle restrictions](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/)
