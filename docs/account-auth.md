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

- `OPENAI_API_KEY`
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

## Account data and sync scope

D1 stores a minimal Google profile: provider account identifier and any email,
display name, or HTTPS profile-image URL supplied by Google. It also stores
account-scoped serialized data through the authenticated, same-origin storage
endpoints:

| Storage key | Limit | Contents |
| --- | --- | --- |
| `teams` | 30 entries / 1.5 MB | Saved teams, including bench and editable build state |
| `analysis-history` | 60 entries / 1 MB | Validated PokePilot analysis history |
| `preferences` | 4 KB | Language, theme, default battle format, tutorial completion |

The browser keeps a local copy for continuity. On first sign-in, unclaimed local
teams and history merge with the account data; on a second device, the account
copy is authoritative. Preference ownership is also tracked locally so a second
account on the same device cannot inherit the prior account's language or theme.

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
  theme, battle format, and completed tutorial state.
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
