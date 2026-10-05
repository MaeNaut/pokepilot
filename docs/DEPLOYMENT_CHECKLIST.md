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

Pushing `develop` does not deploy production. Open a pull request to run CI,
then merge into `main` to trigger production deployment. A Worker preview is
a separate QA deployment, not an automatic consequence of a develop push.

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
| `OPENAI_API_KEY` | Optional legacy binding; public Worker analysis does not read it. Configure paid evaluation credentials separately in the evaluation environment |
| `UPSTASH_REDIS_REST_URL` | Shared cache, leases, and request admission |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash authorization |
| `POKEPILOT_CLIENT_SECRET` | Anonymous client and abuse-control signing |
| `POKEPILOT_SESSION_SECRET` | Session HMACs, account usage identifiers, and personal-key encryption; rotation requires a key migration/re-registration plan |
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
- With a disposable QA account, verify personal API key registration, Luna low,
  Luna medium, removal, re-registration, and isolation from another account.
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
- Confirm the analysis confirmation explains automatic team saving. New/edited
  teams must finish saving before preparation or the paid AI request begins.
  Save failures, pending remote updates, and workspace/account changes must block
  the request. An unchanged saved team must not cause a duplicate write.
- Reload analysis history in a second tab: the submitted saved-team ID, result,
  timing/tokens/cost, and original battle-data season/date must remain intact.
  Do not infer a saved-team destination from a matching draft roster.
- Check battle-data rollover: preparation must stop if its source changes before
  submission. Historical results keep their original source; legacy entries with
  no provenance show "not recorded" rather than today's source.
- QA and production use separate D1 databases. Keys registered in QA do not
  transfer to production; register a key on the production site to test it there.
- Verify the privacy notice, help pages, `ads.txt`, `robots.txt`, and sitemap at
  the production domain.
- Verify both public M-C example pages, their team-text download, and guest/no-key
  links. Recheck published calculations after mechanics changes. Follow the
  [AdSense readiness checklist](./ADSENSE_READINESS.md) before requesting review;
  a successful deployment is not advertising approval.
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

## 2026-10-01 pre-release checkpoint

- Lint and the complete suite passed: 153 files, 1,166 tests. Cloudflare build,
  Worker dry run, dependency audit, and whitespace checks passed. The existing
  Vite large-chunk warning remains.
- QA usage-adapter audit passed for 524 ranked sets and 10 detail samples, with no
  catalog issues (M6, source date 2026-10-01). The unsigned deployment smoke test
  passed without a paid AI call.
- Chrome QA created `QA Auto Save 2026-10-01` and ran one sample analysis after
  automatic saving. A second tab restored the same saved team and history,
  including 7.6 seconds, 10,466 tokens, estimated $0.0014, and its original source.
  This is a workflow check, not a new model-accuracy benchmark or load test.
- Per-endpoint cold/warm CPU measurement is **not completed**. The current aliased
  Worker version URL cannot emit Workers Logs; turning on QA observability did
  not produce events. HTTP probe durations must not be reported as CPU time.
  Separate deployed staging infrastructure is needed for invocation-log-based
  measurement without changing production. See [Version URL limitations](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/).
- The earlier aggregate QA CPU P90/P99 of 21/86 ms remains a risk signal, not a
  measurement of this final version or any specific endpoint. Workers Free has
  a 10 ms CPU allowance; intermittent bursting is not a release guarantee. Review
  the CPU plan before public launch. See [Worker limits](https://developers.cloudflare.com/workers/platform/limits/).
- If Workers Paid is confirmed active, detailed endpoint CPU profiling can be
  deferred until after release; retain routine error and usage monitoring. Paid
  has a default 30-second HTTP CPU limit and a $5 monthly minimum, not unlimited
  fixed-price usage. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- Temporary logging was disabled again in the final QA upload. Production stayed
  on version `6a19cef4-f569-4601-907c-77901f30cd29`; no production deployment,
  commit, or push was performed for this checkpoint.

## 2026-10-01 release plan confirmation

- Workers Paid was verified as the account's current plan in the Cloudflare
  dashboard after the owner completed the upgrade. Detailed endpoint CPU
  profiling is deferred; it is no longer a pre-release gate. Normal CI,
  production smoke tests, and post-release error/usage monitoring still apply.
- This is the account-level Workers plan, not the domain's Pro plan. Application
  secrets and the production D1 binding remain unchanged by the upgrade.

## 2026-10-05 analysis-quality release

- At the owner's request, deployed the verified current `develop` working tree
  directly with `wrangler deploy --keep-vars`. This was not a GitHub Actions/main
  release: HEAD was `046c47483eb334a2fd75776c61fbe0f5b1d0c94f` plus the local
  analysis-quality, validation and recommendation-data changes. No commit, push
  or merge was performed. Commit these changes before relying on main CI to
  preserve this release; deploying the older main tree would replace them.
- Production Worker version: `403a4730-22bf-4518-98c0-81e49f4c0f92`.
  Previous production version for rollback:
  `f849e626-607f-45ae-99d7-3a89d8573049`.
- Included prompt v103/recommendation v15, compact input, selected recommendation
  usage alternatives, candidate Mega states and the prior validation/sample fixes.
  Known explanation limitations remain documented in
  [the Mega-state review](AI_RECOMMENDATION_MEGA_REVIEW_2026_10_05.md); this release
  does not claim that structural validation proves factual accuracy.
- `npm run check:cloudflare` passed: lint, 1,283 tests in 158 files, Cloudflare
  build and Worker dry run. Dependency audit reported zero vulnerabilities.
  The existing Vite large-chunk warning remains.
- Deployment preserved remote variables and secrets. No database migrations,
  credential rotations, DNS changes or account-data edits were performed.
- Production checks passed: current index references and SHA-256 matches for
  `/assets/index-C60_SzlT.js` and `/assets/index-C17-Qs0b.css`; Korean/English help
  and public example pages; privacy page; guest analysis rejection, no-store and
  security headers, and no unexpected session cookie.
- Both usage endpoints returned 262 sets, season M6, source date 2026-10-02,
  without the stale-fallback flag. Garchomp Singles and Rillaboom Doubles detail
  endpoints returned moves and item alternatives normally.
- No signed-in browser workflow or paid production AI call was run during this
  deployment smoke test. The 24 evaluation-key calls belong to the preceding
  quality evaluation, not to these production checks.
- Local release logs: `.tmp/release-2026-10-05-{check,audit,deploy,boundary,smoke}.log`.
