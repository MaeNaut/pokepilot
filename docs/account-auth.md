# Account authentication

Status: live in production as of 2026-09-18. PokePilot uses Google OAuth on the
Cloudflare Worker and does not use Netlify Identity in the active deployment.

## Runtime model

Google authorization is completed by the Worker. It verifies the Google ID token
against Google's JWKS, creates a random session token, stores only its HMAC in
D1, and returns the token in a Secure, HttpOnly, SameSite=Lax cookie.

- Idle session window: 30 days
- Absolute session lifetime: 90 days
- Refresh threshold: seven days remaining
- Session refresh: an authenticated request renews the idle window without
  extending the 90-day maximum
- Logout: revokes the server session and clears synchronized team and analysis
  history copies from the current browser
- Deletion: removes the caller's account, sessions, and account-scoped D1
  storage. Browser interface preferences remain device settings.

JavaScript never reads the session cookie. Missing, forged, expired, or deleted
sessions fail closed before a paid provider request or shared-cache operation.

## Required Worker configuration

Apply all checked-in D1 migrations, then bind the database as `DB` in
`wrangler.jsonc`:

```bash
npx wrangler d1 migrations apply pokepilot --remote
```

Set the following Worker secrets in Cloudflare. Do not commit them or add them
to a `VITE_` variable:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `POKEPILOT_CLIENT_SECRET`
- `POKEPILOT_SESSION_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

Production variables must keep `POKEPILOT_AUTH_REQUIRED=true` and
`POKEPILOT_SHARED_STORE_REQUIRED=true`. The Google OAuth client must permit the
exact callback URL:

```text
https://pokepilot.app/api/auth/google/callback
```

`OPENAI_API_KEY` is not used by public Worker analysis: every request requires
the account's encrypted personal key. Local development/evaluation credentials
are separate. `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_REDIRECT_URI` may be
Worker variables rather than secrets; never expose the OAuth client secret.

## Account data and sync scope

D1 stores a minimal Google profile: provider account identifier and any email,
display name, or HTTPS profile-image URL supplied by Google. It also stores
account-scoped serialized data through the authenticated, same-origin storage
endpoints:

| Storage key | Limit | Contents |
| --- | --- | --- |
| `team:<id>` | 30 teams / 50 KB per team | Saved teams, including bench and editable build state; each has its own revision |
| `team-order`, `teams-v2` | One row each | Display order and migration marker; legacy `teams` retained as backup |
| `analysis-history` | 60 entries / 1 MB | Renderable PokePilot analysis history; not a guarantee of factual accuracy |
| `preferences` | 4 KB | Language, theme, default battle format, tutorial completion, last selected analysis tab/model/reasoning level |

The browser keeps a local copy for continuity. Saved account teams use the
server-authoritative team-library endpoint described below. History continues
to merge independent entries with account data.
Account-owned teams and analysis history are hidden while authentication is
unresolved, cleared after a confirmed guest result, and retained through a
transient authentication error. Guest-owned local teams remain available.
Guest teams are backed up separately before sign-in and restored on logout;
they are not silently substituted for account teams or uploaded automatically.
Pending history edits retain their last confirmed server baseline for reconciliation
after a reload. A legacy analysis-history cache follows the account
copy so a deletion on another device cannot be silently undone. Preference
edits also retain their last confirmed baseline across a failed write and
reload. Preference ownership is also tracked locally so a second
account on the same device cannot inherit the prior account's language or theme.
Each tab keeps its own pending history and preference record. History
sync refreshes from the server when a peer removes a committed journal;
they do not treat a peer's live pending edits as committed data. Peer journals
are replayed during initial recovery using automatic history reconciliation.
Preferences retain field-level reconciliation and replay pending records on
both journal updates and removals. A focused tab checks the server for newer
account data even when its last write succeeded. Consumed pending records are
cleared only if they have not changed since they were read.

The shared journal reader and compare-before-delete helper live in
`accountPendingJournal.ts`; format validation and preference replay ordering
remain in their adapters. `accountCollectionHydration.ts` makes recovery/merge
decisions without browser or React side effects. `accountSyncLifecycle.ts`
owns retry-event subscriptions, sync-registry registration, and session cleanup,
with an explicit journal-event policy for each hook. History recovery and stale
writes reconcile automatically without a manual version-choice interface.
The team-update dialog belongs to the separate per-team storage flow. Merge
rules and write-retry state remain in their existing owners; no account-storage
schema or stored journal format changes are required.

History/preferences storage reads return an ETag and an unmodified
`X-PokePilot-Storage-Version` header. Clients prefer the latter because a CDN
can weaken representation ETags. Writes require the matching `If-Match`
version, so a stale device cannot overwrite a newer server copy. The version
advances on every write, even when the payload returns to earlier
content or multiple writes happen in the same millisecond. Independent analysis-history entries are merged,
and preference fields changed on only one device are retained. A full or
unavailable browser storage cache does not stop the in-memory account save;
the interface warns that the local copy may be lost when the tab closes.
Failed preference reads and writes appear in the account sync warning and retry
on reconnect, focus, or a manual retry.
Storage, personal-key, analysis, logout, and account-deletion requests from the
current client identify the account visible in that tab. The Worker rejects a
request if its authenticated session now belongs to another account or if the
ID is missing; the client then refreshes its account state. Account deletion
also requires a matching ID. Already-open older tabs must be refreshed after
deploying this Worker version.

Deployment note: already-open clients without the expected-account header get
HTTP 403 from storage, personal-key, and analysis endpoints after this Worker
version is deployed. They must refresh before using those features again.
Even earlier clients without `If-Match` cannot perform conditional writes
(HTTP 428 once they supply an account ID). Do not relax either guard: a shared
cookie alone cannot identify the account or server revision a tab last saw.

Current workspace selection, open panels, unsaved drafts, last-opened team, and
game-data caches remain device-local by design. They are navigation or cache
state, not account profile data.

### Team-library synchronization

`GET/PUT /api/pokepilot/team-library` stores each team independently in D1's
existing `account_storage` table. A one-time transaction copies the legacy
collection into team rows, preserves its order, and retains the old collection
as a backup. No additional SQL schema migration is needed. Once migrated,
legacy collection writes are rejected; old clients must reload. Old pending
team journals are not automatically replayed over the authoritative rows.

Each save/delete compares that team's JSON revision atomically. Saving A does
not invalidate B. Failed saves leave the editor unchanged and are not reported
as successful. An unsaved editor is not an offline write queue: do not close
the tab before a failed save has succeeded.

Successful saves notify other local tabs; focus, reconnect, and manual retry
also check the server. There is no continuous cross-device polling. A detected
change opens a modal without applying it. On confirmation:

- Clean active team: load the latest server version.
- Dirty B while A changed: save B first, then refresh the library and keep B open.
- Dirty active team changed/deleted remotely: discard its draft and use the server.
- B also changed while the modal was open: require confirmation of the new warning.
- Saving B or loading the replacement fails: keep the modal and do not discard the editor.

There are no local/server/both version choices. The 30-team limit still applies.

Personal OpenAI API keys are separate account-scoped D1 records, encrypted at
rest rather than stored in the synchronized `preferences` record or browser
storage. They are deleted with the account. See [personal-api-key.md](personal-api-key.md)
for the encryption, rotation, and deployment requirements.

## Acceptance checks after auth or storage changes

- Google consent, cancellation, error, successful callback, reload, and browser
  restart all yield the expected account state.
- A second signed-in browser restores saved teams, analysis history, language,
  theme, battle format, completed tutorial state, and analysis selection.
- Updates from other tabs/devices show a modal before applying. Independent B
  drafts save before refresh; conflicting A drafts are replaced only after acknowledgement.
- A deletion on another device remains deleted; a failed save does not report
  success or discard the current editor.
- A failed preference read or write displays the sync warning and retries when
  the browser reconnects or the user retries manually.
- When browser storage rejects a team write, account sync still succeeds and
  the user sees a local-storage warning.
- Logging out clears the current browser's synchronized team/history copies;
  signing back into the same account restores the D1 copies.
- Switching accounts does not expose local team/history data or carry over the
  previous account's preferences.
- Cross-origin storage writes and account deletion requests are rejected.
- Missing/forged/expired/deleted sessions never reach OpenAI or bypass shared
  Redis controls.
- A personal key is unavailable to other accounts, is never returned by the
  status endpoint, and is deleted on request or account deletion.

Update the static privacy notice and this document whenever the account schema,
sync scope, cookie behavior, or provider list changes.
