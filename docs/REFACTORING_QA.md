# Refactoring and Verification, 2026-09-19

## Scope and Invariants

This pass focuses on account synchronization, asynchronous task ownership,
Worker HTTP routing, and share-card data preparation. It does not change API
paths, persisted formats, D1 schema, damage rules, model prompts, or CSS.

- `useAccountCollection` owns team/history hydration and local commits. Stable
  module-level adapters retain each collection's merge and storage policies.
- `accountSyncSession` serializes remote writes within one hydration lifetime.
  Logout, account changes, and cleanup abort requests and invalidate queued work.
  Preference sync uses the same lifetime primitive with its own merge policy.
- `useAccount` invalidates stale account refreshes; analysis sessions ignore
  results from a previous account generation and wait for history hydration.
- `workerTask` owns worker termination, abortable waiting, and animation-frame
  cleanup for optimization and threat-analysis hooks. Domain engines are unchanged.
- `teamShareBuilds` prepares image-export models outside TeamBuilder rendering.
- `worker/http` centralizes private responses, origin checks, and session refresh.
  `accountEndpoint` owns account GET/DELETE. The router awaits handlers so its
  error boundary also catches asynchronous storage failures.

## Automated Verification

- `npm run check:cloudflare`: lint, 110 test files / 780 tests, TypeScript,
  production build, and Wrangler dry-run passed.
- Baseline: 98 files / 691 tests. Added 89 regression tests in 12 files.
- `npm run audit:all`: zero reported vulnerabilities.
- Hook tests use a small React act/createRoot harness and dev-only jsdom.
- Cases include account transitions, StrictMode cleanup, late responses,
  failed hydration, write ordering, worker errors/aborts, image model mapping,
  API cancellation, and asynchronous router failures.
- Existing Vite chunk-size warnings remain; this pass does not claim bundle-size
  optimization.

## Browser Verification

Used an isolated browser against the local Vite server, without production writes
or paid AI requests. Checked 1920x1080, 820x1180, and 390x844 viewports.

- Selected Garchomp and loaded its usage sample.
- Opened the image preview and inspected artwork, moves, item, nature, and EVs.
- Changed HP EV to 1, saved the team, and switched to the calculator.
- Selected Gholdengo as opponent and checked actual damage results, including
  the mobile Damage tab and tablet layout.
- Reloaded, reopened the saved team, and verified Garchomp, moves, item, and
  HP EV 1 persisted.
- No browser runtime errors were reported during these flows.

## Limits and Follow-up

### Additional Usage-loading Pass

Calculator move and item hooks now share `usePopularUsageSet`. Fetch identity
depends only on species and battle format; catalog updates are resolved locally
with memoized domain functions rather than restarting usage requests. Five hook
tests cover empty slots, repeated renders, format changes, stale responses, and
failure recovery. This does not add a new cross-component cache or alter usage
ranking rules.

Real Google OAuth, D1 cross-device synchronization, and paid analysis were not
repeated in this local QA. Their lifecycle behavior is covered with mocked hook
and route tests; authenticated preview smoke testing is still appropriate before
production deployment.

Aborting a request cannot undo a write already accepted by the server. Existing
whole-library synchronization and multi-device conflict semantics are unchanged.
Large UI files such as App, TeamBuilder, and CalculatorPokemonEditor still contain
substantial presentation logic; this pass extracts selected responsibilities,
not every component. Browser checks cover the listed flows, not every layout or
Pokemon form. No commit, push, or production deployment is part of this pass.
