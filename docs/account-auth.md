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
| `teams` | 30 entries / 1.5 MB | Saved teams, including bench and editable build state |
| `analysis-history` | 60 entries / 1 MB | Renderable PokePilot analysis history; not a guarantee of factual accuracy |
| `preferences` | 4 KB | Language, theme, default battle format, tutorial completion, last selected analysis tab/model/reasoning level |

The browser keeps a local copy for continuity. On first sign-in, unclaimed local
teams and history merge with the account data; on a second device, the account
copy is authoritative unless that device has a persisted unsynced edit.
Account-owned teams and analysis history are hidden while authentication is
unresolved, cleared after a confirmed guest result, and retained through a
transient authentication error. Guest-owned local teams remain available.
Pending edits retain their last confirmed server baseline for three-way reconciliation
after a reload. A legacy team cache without that baseline asks once before
replacing divergent teams; a legacy analysis-history cache follows the account
copy so a deletion on another device cannot be silently undone. Preference
edits also retain their last confirmed baseline across a failed write and
reload. Preference ownership is also tracked locally so a second
account on the same device cannot inherit the prior account's language or theme.
Each tab keeps its own pending team, history, and preference record. Other tabs
replay those records after a storage notification, and a focused tab checks the
server for newer account data even when its last write succeeded. A pending
record is cleared only if it has not changed since it was read.

Account storage reads return an ETag. Writes require the matching `If-Match`
version, so a stale device cannot overwrite a newer server copy. The version
advances on every write, even when the payload returns to earlier
content or multiple writes happen in the same millisecond. First-login team
imports that exceed the 30-team limit require an explicit choice instead of
silently dropping teams. The same rule applies when concurrent additions from
separate tabs exceed that limit. Concurrent changes to different teams are merged
automatically; edits to the same team
(including an edit versus deletion) pause synchronization and ask the user to
keep either version or both. Keeping both creates a new local-team copy and is
subject to the 30-team limit. Independent analysis-history entries are merged,
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

Personal OpenAI API keys are separate account-scoped D1 records, encrypted at
rest rather than stored in the synchronized `preferences` record or browser
storage. They are deleted with the account. See [personal-api-key.md](personal-api-key.md)
for the encryption, rotation, and deployment requirements.

## Acceptance checks after auth or storage changes

- Google consent, cancellation, error, successful callback, reload, and browser
  restart all yield the expected account state.
- A second signed-in browser restores saved teams, analysis history, language,
  theme, battle format, completed tutorial state, and analysis selection.
- Concurrent saves on separate devices keep distinct team edits, and competing
  edits to the same team present a version-choice dialog before saving.
- A deletion on another device remains deleted after refresh; an offline edit
  stored as pending survives refresh and is reconciled against the account copy.
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
