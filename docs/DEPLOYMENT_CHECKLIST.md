# Deployment Checklist

This is the current Cloudflare Workers release checklist for PokePilot. It does
not replace Cloudflare, Google, OpenAI, Upstash, tax, advertising, or legal
provider requirements.

## 1. Automated gate

`.github/workflows/ci.yml` verifies pull requests without deploying. Pushes to
`main` deploy the verified build with the lockfile-installed Wrangler only after
lint, tests, build, dry run, and audit pass. Deployment then runs the unpaid
production authentication smoke test. A smoke-test failure is reported but does
not automatically roll back a completed deployment.

Before enabling this workflow, add repository Actions secrets in
GitHub Settings > Secrets and variables > Actions:

- `CLOUDFLARE_API_TOKEN`: a deployment token scoped to the PokePilot account and
  the relevant Worker/zone resources. Never reuse a local OAuth session token.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account containing `pokepilot`.

Production application secrets (OpenAI, Google, session signing, and Upstash)
remain on the Worker and must not be copied into GitHub. No D1 migrations are
automatically applied. Runs are serialized by ref without interrupting an active
deployment; superseded commits skip deployment. Keep Workers Builds disconnected
to avoid a second independent deployment pipeline. Re-run a failed Actions run
after correcting missing secrets; only the current main commit will deploy.

Run from the repository root:

```bash
npm ci
npm run check:cloudflare
npm run audit:all
```

`check:cloudflare` runs lint, the complete Vitest suite, the Cloudflare asset
build, and a Worker dry run. Do not deploy when any command or CI job fails.

## 2. Cloudflare configuration

- Confirm `wrangler.jsonc` names the `pokepilot` Worker, the `ASSETS` binding,
  the D1 `DB` binding, and the `pokepilot.app` route.
- Confirm all four D1 migrations have been applied in order: account/session
  tables, `account_storage`, `operational_metrics`, and `personal_api_keys`.
  Apply pending migrations before deploying Worker code that reads the new tables.
- Keep `POKEPILOT_AUTH_REQUIRED=true` and
  `POKEPILOT_SHARED_STORE_REQUIRED=true` for production.
- Confirm `GOOGLE_OAUTH_REDIRECT_URI` in `wrangler.jsonc` is the production
  callback, not the QA version URL callback.
- Use a production-specific `POKEPILOT_REDIS_PREFIX`. Change it intentionally
  when invalidating all operational cache and rate-limit state.

## 3. Server-only secrets

Set these in Cloudflare Worker secrets, never with a `VITE_` prefix or in Git:

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Evaluation tooling only; public analysis never falls back to this key |
| `UPSTASH_REDIS_REST_URL` | Shared cache, leases, and request admission |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash authorization |
| `POKEPILOT_CLIENT_SECRET` | Anonymous client and abuse-control signing |
| `POKEPILOT_SESSION_SECRET` | Account session HMACs and account usage identifiers |
| `GOOGLE_OAUTH_CLIENT_ID` | Google sign-in client |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google sign-in authorization-code exchange |

Keep the OpenAI project budget and alerting policy configured independently of
this repository.

## 4. Google OAuth verification

- Confirm the production Google OAuth client permits
  `https://pokepilot.app/api/auth/google/callback` exactly.
- Test consent, cancellation, success, browser restart, logout, and account
  deletion.
- Confirm the session cookie is Secure, HttpOnly, and SameSite=Lax on HTTPS.
- Test a second browser or device: saved teams, analysis history, language,
  theme, default battle format, and tutorial completion should load after sign-in.
- Confirm an account switch does not expose the prior account's local team,
  history, or preferences.
- With a disposable QA account, verify personal API key registration, low and
  medium analysis, removal, re-registration, and isolation from another account.
  Never remove a real user's key or delete a real account for a smoke test.

## 5. Production smoke test

- Load Team Builder and Calculator without console errors on desktop and mobile.
- Select a Pokemon, apply a sample where usage data exists, edit moves/EVs, and
  validate Showdown import and export.
- Confirm M-C legal forms appear where intended and in-battle-only forms remain
  post-selection controls.
- Verify saved-team save, rename, duplicate, bench transfer, reload, and image export.
- Confirm PokePilot gating when signed out and when no personal key is registered,
  personal-key analysis for each supported model, and an appropriate error when the
  provider is unavailable. Check the account history and aggregate metrics.
- QA and production use separate D1 databases. Keys registered in QA do not
  transfer to production; register a key on the production site to test it there.
- Verify the privacy notice, help pages, `ads.txt`, `robots.txt`, and sitemap at
  the production domain.
- Review Cloudflare Worker errors and Upstash/OpenAI dashboards without exposing
  team contents, identifiers, or secrets in logs.

## 6. Rollback and follow-up

- Record the deployed Worker version ID from Wrangler output.
- Roll back the Worker version in Cloudflare if an application regression is
  confirmed; preserve the D1 schema unless a migration-specific recovery plan exists.
- Keep the published privacy notice aligned with account storage, browser storage,
  Google sign-in, OpenAI processing, Redis controls, and any advertising change.
- Repeat representative real-device Safari and Android Chrome checks after major
  layout, authentication, or browser-storage changes.
