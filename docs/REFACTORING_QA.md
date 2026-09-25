# Refactoring and Verification, 2026-09-19

## 2026-09-24: Team Workspace Follow-up

- `useTeamDraft` owns names, localized untitled names, normalized snapshots, and
  the saved comparison baseline. Renaming changes only the baseline name, not
  unsaved moves/EVs. Display metadata hydration remains excluded from dirty checks.
- `useSavedTeamShowdown` owns saved-team Showdown drafts, hydration, imports, and
  clipboard feedback. Closing, account switching, newer opens, and unmount
  invalidate pending responses. Duplicate imports are suppressed. App retains
  the explicit application of imported data to its active workspace.
- `useTeamWorkspaceRestore` owns one-time restoration after library hydration.
  Browser QA reproduced a prior failure: StrictMode/refresh cleanup could cancel
  restoration after the scope had already been marked restored. Completion is
  now recorded after resolution; each attempt has an AbortSignal so cleanup
  cannot cancel a different manual load. A manual action that supersedes an
  attempt is respected rather than overwritten on a later library refresh.
- API routes, persisted schemas, UI markup/CSS, account synchronization, and
  analysis behavior are unchanged. The prior refactor remains in the worktree.

Added 19 hook regressions covering dirty baselines, localization, normalization,
late responses, account changes, import failures, duplicate submission, unmount,
StrictMode replay, last-team preference, and manual restoration supersession.
Final `check:cloudflare` passed: lint, 122 test files / 854 tests, TypeScript,
production build, and Wrangler dry-run. Existing bundle-size warnings remain.
Local Chrome QA covered save, duplicate, Showdown edit/import, loaded move
verification, clean team switching, dirty EVs followed by rename, save/clear of
the warning, and reload restoration. Only a Grammarly extension error was
observed, not an application error. Live cross-device OAuth was not repeated.

Remaining batches include picker interaction consolidation, broader App action
coordination, CopilotPanel policy/presentation, server analysis lifecycle, and
CSS/help preference ownership. This follow-up is not committed or deployed.

## 2026-09-24: Request Modules, Key Lifecycle, and Metrics

- Split request construction into localized labels, optimization snapshots, and
  matchup snapshots. The existing builder keeps its public exports for callers.
  Its main file decreased from 1,464 to 658 lines.
- Split request shape validation into sets, recommendation candidates, and team
  context. The contract entry point retains whole-request consistency checks and
  decreased from 1,338 to 499 lines. AST-based comparison against HEAD confirmed
  all 49 builder/validator function bodies were unchanged during extraction.
- Shared move legality lookup/filtering between the team builder and calculator.
  Base/mega learnset merging is shared; each editor retains its previous empty
  result fallback and move catalog deduplication behavior.
- `usePersonalApiKey` owns account-scoped key presence and asynchronous response
  generations. A delayed GET cannot overwrite a completed save/removal, and
  account changes or unmount invalidate pending responses. `useAccount` retains
  the shared account-action busy guard and its existing public interface.
- Extracted pure metrics report aggregation. Personal-key cache statuses now
  count as completed analyses; site and personal estimated costs are separate.
  Existing rows/report totals remain compatible; no D1 migration is required.

Verification: full `check:cloudflare` passed (119 files / 833 tests, lint,
TypeScript, production build, Wrangler dry-run). Two additional lifecycle tests
then passed in the focused 6-test key suite; final lint and TypeScript passed.
Existing bundle-size warnings remain. No paid model calls or production writes.

Local Chrome QA confirmed Charizard selection, Mega Charizard X, preserved moves,
Flamethrower search + Enter, transfer to the calculator, and Dragon Claw search +
Enter there. No browser console errors were captured. Live OAuth/key encryption
was not retested; this pass does not change those server implementations.

Remaining separate refactor batches: App workspace actions/dirty-state ownership,
full picker interaction unification, CopilotPanel policy/presentation separation,
server analysis lifecycle, and CSS/help preference ownership. No changes to
fallback policy, prompt content, API versions, database schema, or CSS in this pass.
Changes are local only; this refactor has not been committed or deployed.

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

### Repository File Hygiene

- Removed two obsolete `.gitkeep` files: type icons already populate their
  directory, and move-category assets live under `icons/categories` instead.
  Also removed the local `noop` probe and empty Showdown temporary export.
- Expanded repository ignore rules for environment variants, Wrangler local
  secrets, local-only notes, credential files, generated reports, and caches.
  The two environment templates and public `.env.cloudflare` remain tracked.
- Inspected 129 locally available commits (483 historical paths), current
  tracked files, common credential patterns, and exact values of three local
  secrets without printing those values. No actual secret matches were found;
  the only pattern match was a synthetic personal-key test fixture.
- No tracked build outputs, logs, or private environment files were found.
  This is a bounded local-history inspection, not a guarantee covering remote
  deleted branches, inaccessible history, or every possible secret format.
- Preserved design originals, paid evaluation evidence, local development data,
  production catalogs, migrations, lockfiles, and documentation. Being unused
  by the runtime alone is not grounds to delete these files.
- Added three repository-hygiene tests for ignore coverage, public environment
  configuration, and accidentally tracked ignored files. Focused tests and lint
  passed. No Git history rewrite, commit, push, or deployment was performed.

### Unused-code Cleanup

- Removed the unreferenced exact-matchup prompt; active scope instructions and
  prompt versions are unchanged.
- Removed the unused public scope array. Tests now exercise the visibility
  predicate used by the application, including the hidden matchup scope.
- Made five same-file helper functions private instead of exporting them.
- Removed 54 obsolete calculator CSS rules (62 selectors across 23 unused
  classes), preserving active selectors in mixed selector groups.
- Kept evaluation-only recommendation helpers, dynamic CSS classes, framework
  entrypoints, and legacy data migration paths that still have consumers.
- `npm run check:cloudflare` passed: lint, 122 test files / 854 tests,
  TypeScript, production build, and Wrangler dry-run. Existing chunk warnings
  remain. Local calculator screenshots at desktop and 390x844 showed no obvious
  style regression; this was a visual smoke check, not full interaction coverage.
- No paid API calls, commit, push, or deployment were performed.

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
