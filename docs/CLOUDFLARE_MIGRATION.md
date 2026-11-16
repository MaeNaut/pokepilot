# Cloudflare migration

Status: complete as of 2026-09-18. `https://pokepilot.app` is served by the
`pokepilot` Cloudflare Worker. The Worker serves the built Vite assets and owns
the API, Google OAuth callback, and same-origin Champions battle usage adapter.

## Current production topology

The configuration in this revision replaces Upstash with Durable Objects.
The production cutover completed on 2026-11-16, and the owner confirmed a
successful production Luna low analysis. The separate QA Worker is deployed and
Google login initiation passes. Authenticated browser QA and retiring the old
service remain follow-up steps.
See [analysis operations](ANALYSIS_OPERATIONS.md) for the rollout status and
first-deployment procedure; do not remove the old service before cutover verification.

- **Worker and static assets:** `pokepilot` Worker with the `ASSETS` binding
- **Custom domain:** `pokepilot.app`
- **Worker URL:** `https://pokepilot.pokepilot-ai.workers.dev` (not an isolated QA environment)
- **Separate QA Worker URL:** `https://qa-pokepilot.pokepilot-ai.workers.dev`
  (the former alias is unavailable after Durable Objects were introduced;
  the separate Worker now serves the app with its own session secret)
- **QA database:** `pokepilot-qa`, configured in `wrangler.qa.jsonc`
- **Database:** Cloudflare D1 database `pokepilot`, bound as `DB`
- **Operational state:** Public BYOK calls use the `personal` safeguard mode:
  fresh results without shared caching, account/IP request protection, and Durable Object
  account/global active-analysis permits. Identical requests still deduplicate
  locally. Development-only `ai-test`/`ai-fresh` modes can bypass admission.
- **Account storage:** D1 `accounts`, `account_sessions`, and
  `account_storage` tables, plus encrypted `personal_api_keys`
- **Metrics:** bounded daily `operational_metrics` aggregates in D1

Legacy Netlify/Vercel deployment entry points and Netlify Identity dependencies
have been removed. Their historical implementations remain available in Git.
The Node API adapter in `server/` is still used by the Vite development server.

## Reprovisioning or recovery

1. Confirm `wrangler.jsonc` still binds `ASSETS`, `POKEPILOT_ANALYSIS_GATE`, and the D1 `DB` database, and
   maps the `pokepilot.app` custom domain.
2. Apply all checked-in D1 migrations in order:

   ```bash
   npx wrangler d1 migrations apply pokepilot --remote
   ```

   If local Wrangler credentials lack D1 access, apply the same checked-in SQL
   through the Cloudflare D1 console and record the operation before deploying.
3. Set server-side Worker secrets in Cloudflare. Never place them in
   `wrangler.jsonc`, `.env.cloudflare`, Git, or chat:

   - `POKEPILOT_CLIENT_SECRET`
   - `POKEPILOT_SESSION_SECRET`
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`

   Public analysis reads the signed-in account's personal key, not
   `OPENAI_API_KEY`. Keep local/evaluation keys separate. The OAuth client ID
   may also be configured as a Worker variable; its client secret must remain secret.
4. Keep the Worker variables in `wrangler.jsonc` aligned with the intended
   environment. Production requires account authentication, the Durable Object
   gate with scope `production`, and `GOOGLE_OAUTH_REDIRECT_URI` set to the production callback. QA
   deployments use a different callback, so keep both URLs explicit in
   their respective Wrangler configs.
5. In Google Cloud, register the exact production redirect URI:

   ```text
   https://pokepilot.app/api/auth/google/callback
   ```

   Add the `workers.dev` callback only when actively testing that preview host.
6. Verify and deploy:

   ```bash
   npm run check:cloudflare
   npm run deploy:cloudflare
   ```

## Separate QA Worker

Cloudflare does not provide Version URLs for a Worker that implements a Durable
Object. The former `qa` version alias therefore returns 404; uploading another
alias cannot restore it. Do not treat that as a production login failure.

`wrangler.qa.jsonc` now names a separate Worker, `qa-pokepilot`, with no production
custom-domain routes. It binds the existing `pokepilot-qa` D1 database and the
`PokePilotAnalysisGate` class defined in the production Worker, but selects the
distinct `analysis-v1:qa` object. It does not export or migrate that class itself.

The `QA` GitHub Actions workflow deploys `develop` to this separate Worker, using
the existing repository deployment credentials. It applies only QA D1 migrations
and runs guest authentication checks without paid API calls. An initial bootstrap
can create the Worker before authentication secrets are registered; the workflow
explicitly reports that login is not ready in that case. It never copies or
replaces authentication secrets.

On 2026-11-16 the owner registered the separate Worker's Google OAuth credentials
and authorized an independent QA session secret. A one-time job generated 48
cryptographically random bytes, encoded them as base64url, and piped the value
directly to Wrangler. No plaintext output or backup was created, by owner choice.
It refused production targets and did not overwrite an existing secret. Google
login initiation and guest safeguards passed without paid API calls; completing
Google login and an authenticated analysis remains a browser QA step.

Keep QA and production session secrets independent. The legacy QA sessions no
longer work, and any existing QA personal API key must be deleted/re-registered
through the QA profile before analysis. Teams and analysis history were not
deleted or rewritten. If an existing QA secret must be replaced again, obtain
explicit authorization for session invalidation and key re-registration first;
normal deployments must never generate or rotate it automatically.

After those prerequisites are satisfied:

```bash
npx wrangler d1 migrations apply pokepilot-qa --remote --config wrangler.qa.jsonc
npm run check:cloudflare
npx wrangler deploy --config wrangler.qa.jsonc
npm run verify:deployment -- --url https://qa-pokepilot.pokepilot-ai.workers.dev
```

Main CI deploys production only; pushes to `develop` deploy QA only. Register
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and
`POKEPILOT_SESSION_SECRET` under Workers & Pages > qa-pokepilot > Settings >
Variables and Secrets, selecting Production for this separately named Worker.
Do not send values in chat or commit them. QA currently uses its session secret
as the supported client-signing fallback, not a copied production client secret. Google sign-in
requires `https://qa-pokepilot.pokepilot-ai.workers.dev/api/auth/google/callback`
in the OAuth client's authorized redirect URIs. That callback address is unchanged
from the old alias. `wrangler deploy --config wrangler.qa.jsonc` now targets
`qa-pokepilot`, never `pokepilot`; retain that distinction.

See [Version URL limitations](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
and [analysis operations](ANALYSIS_OPERATIONS.md). Do not enable production logging
to work around a QA-only measurement request. HTTP response time does not measure
Worker CPU. `wrangler.qa.jsonc` keeps invocation logs disabled.

On October 14, 2026, release preflight passed 1,381 tests, lint, the Cloudflare
build/dry-run, and the dependency audit. Historical live Upstash checks in disposable QA
keys verified cross-instance account/global capacity, release after success or
failure, orphan expiry, longest-lease TTL, and atomic request admission. The QA
preview passed 37 public routing checks and guest API rejection. A Luna low
request completed, and its result/time/token/cost metadata survived history
reload. Desktop, tablet, and 360px settings menus were checked in Chrome.
The final live sign-out check was interrupted by a browser confirmation dialog;
authentication draft cleanup remains covered by the regression suite.

October 15 follow-up: alternate-account Google sign-in, owner-entered key
registration, one live low Pokemon analysis, automatic team save and
result/usage-metadata restoration after reload/history selection/new tab passed
in ordinary Chrome on isolated QA. This does not establish independent-device
sync, concurrent-edit or destructive-account-flow coverage. See
[the onboarding QA record](./PRELAUNCH_QA_2026_10_15.md) for remaining gaps.

## Rollback

Use the Cloudflare Workers dashboard to roll the `pokepilot` Worker back to a
previous healthy version. Do not make a DNS or registrar change for an ordinary
application rollback. After rollback, verify `/`, `/api/pokepilot/account`, a
signed-in PokePilot request, and the Google callback before announcing recovery.
