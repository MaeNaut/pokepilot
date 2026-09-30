# Refactoring and Verification, 2026-09-19

## 2026-09-27: Reproduced Late Pokemon Selection Fix

- Prioritized a concrete race over further structural extraction. App-level
  tests reproduced a late ordinary Pokemon selection repopulating a newly
  created team or a logged-out workspace (two failing tests before the fix).
- Added a small shared workspace-transition callback in App. New-team creation,
  saved-team loading, new-team Showdown import, and account departure invalidate
  pending selection request IDs and clear their loading/error/retry notices.
  Existing stale-response checks then reject late successes and failures.
- Seven integration regressions exercise the real App handlers with mocked child
  views and deferred data services: new team, logout, normal selection, old
  failure versus a newer loading request, stale usage notice, saved-team loading,
  and Showdown import. No additional component or state-manager extraction.

Verification: `check:cloudflare` passed with 136 test files / 983 tests, lint,
TypeScript, production build, and Wrangler dry-run. Existing bundle-size warnings
remain. Browser/cross-device OAuth QA was not repeated; no paid AI requests,
commit, push, or deployment. Other refactoring candidates remain deferred.

## 2026-09-27: Panel Controls and Team Editing Ownership

- Extracted `CopilotModelControl` from CopilotPanel. It owns menu visibility,
  outside/Escape dismissal, locked choices, tooltip copy, and model presentation.
  The parent updates the persisted model/effort preference in one state update.
- Extracted `CopilotAnalyzeControl`. It owns estimate presentation, button/dialog
  markup, heading focus, cancel/Escape focus return, and dismissal on context
  changes. The panel retains confirmation intent for result refresh buttons,
  authentication, preparation, and execution orchestration.
- Moved slot reorder, team-to-bench transfer, bench-to-team swap, bench reorder,
  and bench removal from App into `useTeamWorkspace`. Existing pure bench
  transformations remain the source of build transfer rules; selected-slot
  behavior and capacity checks are unchanged.
- DOM tests cover confirmation-before-execution, estimates, focus return,
  context-change dismissal, keyless model locking, selection order, and menu
  dismissal. Workspace tests cover build-preserving round trips (including
  pre-mega ability), occupied-slot exchange, reorder, capacity, and removal.

Verification: 13 new regressions; focused suite 18 passed. Full
`check:cloudflare` passed: 135 test files / 976 tests, lint, TypeScript,
production build, and Wrangler dry-run. Existing bundle-size warnings remain.
CSS and persisted schemas are unchanged. Real-browser/cross-device OAuth QA and
paid AI calls were not repeated; no commit, push, or deployment was performed.

## 2026-09-27: Portalled Menu Dismissal

- Extended the existing outside-pointer hook with optional additional container
  refs, retaining its single-container callers. Portalled menu contents now use
  the same inside/outside handling as their trigger.
- Replaced duplicate pointer listeners in BuilderToolbar, CopilotHistoryControl,
  and the model/analysis-confirmation controls in CopilotPanel. Component-owned
  Escape behavior, confirmation focus, and history positioning remain unchanged.
- Latest callbacks and portal refs are read without resubscribing the document
  listener on every render. Disabled controls and unmounted components remove
  their listeners.

Verification: six new hook regressions cover nested portal content, outside
clicks, enable/disable, callback/ref changes, unmount, late ref attachment, and
unchanged Escape ownership. Full `check:cloudflare` passed: 134 test files /
963 tests, lint, TypeScript, production build, and Wrangler dry-run.
Existing bundle-size warnings remain. Browser QA was not repeated.
No commit, push, or deployment was performed.

## 2026-09-27: Analysis Boundaries and Workspace Transitions

- Analysis diagnostics now isolate both synchronous callback exceptions and
  asynchronous rejections. Metrics/logging failures cannot replace a successful
  analysis, a cache hit, or the original provider error response.
- Recommendation and matchup preparation share localized option/target creation,
  including gender/form labels and saved-member fallback names.
- Analysis sessions retain error codes and raw fallback messages; the existing
  display translator resolves known errors using the current language.
- `useCopilotRequestPreparation` owns catalog loading and scope-specific request
  preparation. Cancelled, unavailable, or empty plans still do not submit analysis.
  `useCopilotCandidateActions` owns recommendation/optimization apply and save
  states, preserving stale-result guards and bench-capacity feedback.
- `useTeamWorkspace` owns active team, bench, build state, selected slot, names,
  and saved identity. Load/import/new/account-reset transitions coordinate their
  draft checkpoints and last-active-team storage. Imports remain dirty; new teams
  start clean; account reset clears the selected slot and comparison baseline.
  Async hydration cancellation and saved-team import guards remain in App.

Verification: added 35 regressions; final `check:cloudflare` passed with 133 test
files / 957 tests, lint, TypeScript, production build, and Wrangler dry-run.
Existing bundle-size and Node experimental SQLite warnings remain. UI markup,
CSS, API routes, and persisted schemas were not changed by this follow-up.
Browser/cross-device OAuth QA and paid model evaluation were not repeated.
No commit, push, or deployment was performed.

## 2026-09-27: Obsolete Analysis Code and Recommendation Loading

- Removed the unused local-analysis generator and its dedicated assertions,
  followed by its orphaned `copilotText` dictionary, prose helpers, and re-exports.
  Request labels now reuse the existing Showdown ID and display-label helpers.
  Historical local analysis entries remain readable through the history migration
  path, including their fallback notices.
- `useCalculatorUsage` shares a single popular-set subscription between move and
  item suggestions. Item eligibility changes recompute suggestions locally;
  Pokemon/format changes retain the existing stale-response protection.
- Recommendation preparation uses the existing abortable frame/task helpers.
  Scope/input changes, unmount, and newer runs release pending callers and discard
  late results. An aborted run skips ranking after shared catalog loading finishes;
  the catalog fetch itself remains available to other consumers.
- The standard and universal recommendation paths share their data-loading helper.
  Import/export inspection retained the Vite plugin, environment resolver, Worker
  entrypoints, evaluation utilities, and persisted-data compatibility code.

Verification: `check:cloudflare` passed (129 test files / 922 tests, lint,
TypeScript, production build, Wrangler dry-run). Twelve focused regressions cover
shared usage loading, local item filtering, format changes, cancellation before
the first frame, late success/failure, unmount, overlapping requests, retry, and
reuse of shared data after cancellation. Existing bundle-size warnings remain.
This pass used automated checks; browser QA and paid AI evaluation were not run.
Changes are local; no commit, push, or deployment was performed.

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
whole-library synchronization was unchanged in this refactoring pass. A later
storage fix added conditional account writes, automatic merging of independent
edits, and a same-team conflict dialog; see [account-auth.md](account-auth.md).
Large UI files such as App, TeamBuilder, and CalculatorPokemonEditor still contain
substantial presentation logic; this pass extracts selected responsibilities,
not every component. Browser checks cover the listed flows, not every layout or
Pokemon form. No commit, push, or production deployment is part of this pass.

### Account Synchronization QA (2026-09-28)

- A shared-server, two-device hook test now covers independent team edits,
  competing edits to the same team, an offline edit followed by a remote
  deletion and reload, and consecutive writes behind a delayed request.
- Reproduced and fixed a stale-write gap when storage content changed A-B-A:
  ETags now use a per-row version that advances on every write, including
  multiple writes in one millisecond. The D1 update compares both the prior
  payload and timestamp before accepting the new revision.
- First-login team imports exceeding 30 entries now pause for an explicit
  selection instead of silently truncating guest teams.
- Reproduced and fixed a failed preference write being lost on reload. The
  browser retains the unsent value and server baseline, rebases on a newer
  remote field, and removes that pending copy after sync or explicit logout.
- Authentication loading/error now hides account-owned team and history caches.
  A confirmed guest clears those caches; a transient auth error does not.
- Full validation: 138 test files / 1,037 tests, lint, TypeScript, and
  Cloudflare build passed. Existing large-chunk build warnings remain.
- These are local, simulated-device tests. Real OAuth, remote D1, and two
  authenticated preview browsers were not exercised or modified in this pass.

### Two-Tab Preview QA (2026-09-28)

- Uploaded `develop` to the isolated `qa` Worker version URL without routing
  production traffic. The preview uses its own D1 database and Redis prefix.
- The deployed preview passed the guest authentication-boundary check. Two
  Chrome tabs loaded the deployed client while account endpoints were replaced
  with a shared, versioned test store; no paid analysis was requested.
- Verified independent team saves, concurrent additions, same-team conflict
  choice to keep both versions, deletion propagation, persistence after reload,
  language/theme propagation, and logout in the other tab.
- Fixed false conflicts caused by differently ordered JSON object fields. Also
  stopped live tabs from replaying another tab's uncommitted journal as if it
  were server state; committed changes still refresh peers, while journals are
  replayed on recovery. Focused regressions and the full suite pass: 142 files,
  1,077 tests, lint, and Cloudflare build.
- Google blocked sign-in from the automation browser with its insecure-browser
  warning. Therefore real OAuth, authenticated Worker/D1 writes, and paid
  analysis were not validated in this preview-browser pass.

### Server-First Team Preview QA (2026-09-29)

- Preview version: `e25a0cc9-da32-4751-b7aa-b0696c2b096f`, alias
  `https://qa-pokepilot.pokepilot-ai.workers.dev`. Uploaded from the working tree;
  no commit, push, or production traffic deployment was performed.
- Used two tabs in the user's normal Chrome profile with its existing QA login.
  Unlike the earlier run, account endpoints were not mocked: saves and reloads
  used the authenticated Worker and isolated QA D1 database. No paid analysis.
- Existing legacy QA teams loaded after the per-team migration. A direct D1
  metadata query was blocked because it lacked an account-ID filter; it was not
  retried. Backup-row integrity remains covered by SQLite migration tests,
  not by a remote database inspection in this pass.
- A saved while B had an unsaved Attack EV change: B displayed the save-before-
  refresh notice first. Confirmation saved B's EV 31 and kept B open. A's tab
  then received a clean-update notice. Loading B from A's tab retained EV 31.
- Both tabs editing A: the receiver retained EV 28 until confirming the discard
  notice, then loaded the saved EV 29. Escape did not dismiss the notice.
- Clean A receiving another save: ordinary update notice, then EV 27 after
  confirmation. A page reload restored A and EV 27 from the remote store.
- While B's save-before-refresh notice was open, the other tab saved B too:
  the notice changed to a discard warning. Confirmation loaded server EV 29,
  rather than overwriting it with the older local EV 30.
- Final disposable QA fixture values: `QA Sync A edited` Attack EV 26;
  `QA Sync B 0929` Attack EV 29. No non-QA teams were changed or deleted.
- No new defect was observed in these flows. Implementation validation remains
  146 files / 1,098 passing tests, lint, and Cloudflare build. Network-failure,
  account-boundary, and atomic stale-write rejection checks are automated tests;
  real separate-device, offline/reconnect, deletion, and mobile-layout checks
  were not repeated in this browser pass. Fresh Google OAuth was unnecessary.

### Synchronization Cleanup After Per-Team Storage (2026-09-29)

- Removed unused client collection-team APIs, legacy team merge/version-choice
  functions, pending-team read/write wrappers, managed-team accessors, and
  translation keys for the retired local/server/both dialog.
- Kept logout cleanup for old browser journals and the Worker migration/legacy
  write guard. These protect existing accounts and already-open older clients.
- Reused the team refresh path for initial hydration instead of maintaining a
  second fetch/accept/error implementation. Added failed-initial-load retry and
  late-initial-response-after-logout tests.
- Replaced obsolete whole-team-collection integration tests with current history
  synchronization cases: independent additions, deletion preservation, delayed
  writes, focus refresh, and refresh only after a peer commits its journal.
  Per-team API/hook tests remain the source of truth for team synchronization.
- Removed unused conflict-list/radio-choice CSS. The update dialog has its own
  name and two-row layout, matching its header/footer-only content.
- Preserved shared history/preferences lifecycle and write serialization; no new
  abstraction or change to the approved server-first team policy was introduced.
- Removed the remaining unused manual-conflict state/resolution API and managed/
  legacy policy options from the shared history collection hook. Hydration now
  returns the reconciled items directly and replays all pending journals.
  Automatic stale-write reconciliation, retries, and account/session guards remain.
- Removed tests for retired manual choices; retained actual history conflict
  retry coverage and verified sequential replay of all pending journals.
- Local validation: 146 test files / 1,078 passing tests, lint, and Cloudflare
  build. This cleanup has not been
  uploaded to the QA preview or deployed to production; the preceding live
  preview report describes the pre-cleanup version.

### Follow-Up Unused Code Check (2026-09-29)

- Checked exported symbols, module references, evaluation entry points, and
  tracked ignored files. Removed the unused `classifyHostedAnalysisFailure`
  classifier and its private metadata reader, plus seven classifier-only tests.
- Kept the failure-reason validator used to restore older analysis history.
  Current error messages continue to use `getCopilotFailureMessage`.
- Kept the previous regulation catalog used by transition regression checks,
  evaluation replay scripts, and migration files. No additional unused source
  file was confirmed. Local logs and deployment caches remain Git-ignored.
- Validation: five focused test files / 29 passing tests, lint, TypeScript build,
  and no tracked files matching repository ignore rules. No deployment or paid
  analysis was performed; the full suite was not repeated for this small removal.

### Async UX Review Findings (2026-09-29, Fixed Locally)

- P2: `useCopilotCandidateActions` unconditionally selects the Pokemon analysis
  tab after awaiting candidate application. Reproduction: defer a successful
  recommendation application, switch scope to team, then resolve the operation.
  Expected: preserve the user's latest tab. Observed: `setScope("pokemon")`.
  Scope buttons remain enabled while candidate application is pending.
- P2: `usePersonalApiKey` drops peer key-change events while a local mutation is
  pending and does not refresh after it settles. Reproduction: commit a local
  save but delay its response, delete the key in another tab, dispatch that peer
  event, then resolve the save. Expected: re-read server presence (false).
  Observed: local presence becomes true until a later focus/refresh event.
  This demonstrates stale UI, not restoration of a deleted server key.
- Both cases failed correct-behavior assertions in temporary deferred-promise
  hook tests (two tests, two failures). Temporary tests were removed after
  recording these findings; production code was not changed in this review.
  No real account mutations, paid analysis, or live-browser reproduction was
  performed. Follow-up fixes should retain these scenarios as regression tests.

- Follow-up fix: candidate application only selects the Pokemon tab if the scope
  has not changed since the action started. Switching away and back also cancels
  automatic navigation; an application-driven request change alone does not.
- Key changes now defer/coalesce refresh events during a mutation and replay
  once it settles, including failure. Effect cleanup drops stale account refresh
  callbacks, and overlapping local mutations are rejected.
- Added permanent tests for changed/returned tabs, application-driven request
  updates, peer refresh after successful/failed saves, and logout cancellation.
  Validation: 146 files / 1,077 tests passed, lint, and TypeScript build.
  No live-browser QA, commit, push, or deployment in this follow-up.

### Pre-Deployment Review (2026-09-30, Findings Resolved Below)

- Release blocker: `npm run audit:all` exits 1 with four reported vulnerabilities
  (two moderate, two high) through brace-expansion and undici/miniflare/Wrangler.
  CI runs this command before deployment. `npm run audit:prod` reports zero.
  The installed dependency tree differs from package-lock.json: for example,
  Wrangler is installed at 4.143.0 but locked at 4.135.0; brace-expansion is
  installed at 1.1.21/5.0.12 but locked at 1.1.18/5.0.9. Update the affected
  lockfile dependencies and verify a clean lockfile install before release.
- P2: `useSavedTeams.refresh` drops peer notifications while a local mutation
  is busy. Deferred test: save A, receive a peer commit for B while waiting,
  complete A. No pending update for B appears. Queue/coalesce a refresh after
  the mutation settles. Server stale-write checks remain, so this test does
  not demonstrate a server-side overwrite.
- P2: overlapping team refreshes lack read-order invalidation. Deferred test:
  hold a revision-2 read, receive and acknowledge revision 3, then release the
  old read. A stale revision-2 notice reappears. Invalidate older reads when
  newer reads/acknowledgements supersede them. Confirmation re-reads the server;
  this test demonstrates misleading/repeated notices, not a saved rollback.
- P2: saved-team Showdown import leaves its textarea editable while pending.
  Deferred test: start importing Charizard, type Garchomp, complete the old
  import. The newer text is cleared when the panel closes. Disable editing
  during import or preserve newer drafts instead of clearing them.
- Three correct-behavior assertions failed in temporary hook tests, which were
  removed after recording the evidence. No product code was changed in this
  review. Live-browser/account tests and deployment were not performed.
- Cloudflare frontend build passed in the current installed environment. Main
  JS is 1,098.16 kB (314.42 kB gzip); the existing chunk-size warning remains.
  Treat performance work as measurement-driven follow-up, not a reason for
  speculative module splitting. Repeat authenticated preview QA after fixes;
  earlier live QA predates the cleanup and asynchronous UX changes.

### Pre-Deployment Fixes and QA (2026-09-30)

- Team refreshes now coalesce while writes or update acknowledgement are in
  progress and replay when those operations settle. Refreshes have monotonically
  increasing generations; acknowledgement and writes invalidate older reads.
  Failed stale reads cannot overwrite current sync status. Concurrent update
  confirmations are rejected; the confirmation's own draft save remains allowed.
- Saved-team Showdown input is read-only during import and editable afterwards.
  Added tests for its rendered read-only state, queued peer updates after success
  and failure, outdated refresh after acknowledgement, and logout cancellation.
- Updated only the affected lockfile dependency graph with `npm audit fix
  --package-lock-only`. Stopped the previous local Vite process to release its
  Windows binary lock, then completed `npm ci`. Audit: zero vulnerabilities.
- Clean-install verification: 147 test files / 1,083 passing tests; lint,
  TypeScript/Vite Cloudflare build, and Wrangler dry-run passed. Existing bundle
  size warnings remain. QA unauthenticated API safeguard check passed; no paid
  AI requests were made.
- Uploaded QA-only version `9a5e3deb-9371-4686-acbd-966d499a2113` at
  `https://qa-pokepilot.pokepilot-ai.workers.dev`, using isolated QA D1 and Redis
  prefix. Production traffic was not deployed. No commit or push.
- Used two real Chrome tabs with the existing authenticated QA session:
  A saved while B had unsaved EV changes; B received save-before-refresh notice,
  confirmed, saved its EV 28, and stayed open. A received the clean-update notice.
  Both tabs edited A; B received discard-before-refresh warning and loaded A's
  saved EV 27 after confirmation. Showdown import exposed a read-only textarea
  while pending, completed successfully, and notified the peer. Reload preserved
  A's EV 27. Final QA fixtures: A Attack EV 27; B Attack EV 28.
- No application error was observed in the final tab log; the sole reported
  error came from the Grammarly extension. Screenshot: `.tmp/predeploy-qa.png`.
  Exact delayed/out-of-order network schedules were verified by automated tests,
  not forced in the live browser. Safari, separate physical devices, and paid
  analysis were not repeated in this pass.

### Final Diff Review (2026-09-30, Follow-Up Fixed Locally)

- P2: a peer refresh already in flight when a local save starts is invalidated
  by the write generation, but is not queued for replacement. The prior fix
  only queues refreshes requested while busy, leaving this ordering uncovered.
  Reproduction: B changes remotely; start a deferred refresh, then save A.
  Whether the old read finishes before or after A's write, B's update notice
  never appears until a later refresh trigger. Both correct-behavior assertions
  failed in temporary tests. Server revision checks still reject stale writes;
  no server-side overwrite was demonstrated.
- Fix before release: when a write supersedes an active refresh, retain one
  post-write refresh, scoped to the active account/session. Preserve stale-read
  rejection rather than accepting the outdated response. Add both completion
  orders and logout cancellation to permanent regression coverage.
- Removed the temporary failing tests after recording the finding. No product
  changes, push, or deployment in this review. Tracked-file ignore-rule audit
  found no tracked ignored artifacts; new test/CSS files still need inclusion
  in the eventual commit. Previous passing QA does not cover this new ordering.

- Follow-up: track the current in-flight refresh generation. A write that
  supersedes that read schedules one replacement refresh after settling. Old
  completions cannot clear newer tracking; account hydration resets tracking,
  and acknowledgement supersedes it with its own authoritative read.
- Added seven regression cases: both read/write completion orders for successful
  and failed writes, logout/account-switch isolation, and no extra request after
  an already completed read. All 147 test files / 1,090 tests pass, along with
  lint and the Cloudflare build (existing bundle-size warning only).
- This final correction is local only. No commit, push, preview upload, or
  production deployment; QA version `9a5e3deb-9371-4686-acbd-966d499a2113`
  predates this correction. No additional live-browser QA in this follow-up.
