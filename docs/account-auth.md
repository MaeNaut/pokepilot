# Account authentication rollout

Status: Cloudflare Worker migration in progress. Google OAuth and a real
Cloudflare Worker preview must be verified before rollout.

## Preview setup

1. Create the `pokepilot` D1 database, then add its generated ID as the `DB`
   binding in `wrangler.jsonc`. Apply `migrations/0001_accounts_and_sessions.sql`.
2. Build with `npm run build:cloudflare` so the committed `.env.cloudflare`
   enables the account controls. Keep `POKEPILOT_AUTH_REQUIRED=true` in Worker
   variables for preview and production.
3. Set Worker secrets: `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, `POKEPILOT_CLIENT_SECRET`,
   `POKEPILOT_SESSION_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, and
   `GOOGLE_OAUTH_CLIENT_SECRET`. Set `GOOGLE_OAUTH_REDIRECT_URI` to the exact
   Worker callback URL as a non-secret variable or secret.
4. In Google Cloud, add the exact preview callback URL
   `/api/auth/google/callback` before testing it. Do not publish the OAuth app
   until the Cloudflare preview has passed acceptance checks.

Google authorization happens on the Worker. The Worker verifies the Google ID
token against Google's JWKS, creates a random session with a 30-day idle window
and a 90-day maximum lifetime, stores only an HMAC of that session in D1, and
returns it as a `Secure`, `HttpOnly`, `SameSite` cookie. When the session has
seven days or less remaining, the next authenticated request rotates its token
and renews the idle window without extending the 90-day maximum. JavaScript
never reads the session cookie. Logout and deletion revoke the server-side
session; expired sessions fail closed before any paid provider or cache
operation. Existing Netlify Identity sessions intentionally do not migrate, so
every account signs in again after the traffic switch.

Redis usage keys retain their current expiration and atomic reservations, but
use a namespaced hash of the verified account ID. IP safeguards and analysis
caching remain. There is no new global spending cap. No team cloud sync or
credit ledger is implemented. Existing local teams/history stay on the device.

Account deletion requires a same-origin DELETE and a verified session, deletes
only the caller's D1 sessions and account, then clears the browser session.
Existing Redis usage entries expire normally. Re-registration abuse needs separate
review; account deletion is not a promise to permanently blacklist that identity.

## Required acceptance checks

- Google consent/cancel/error, callback, reload and browser restart restoration.
- Incognito + second browser: same account consumes the same allowance.
- Concurrent requests preserve Redis reservations and cooldowns.
- Missing/forged/expired/deleted tokens never reach the paid provider or cache.
- Logout/account deletion, cross-origin deletion rejection, outage fail-closed.
- Desktop/mobile Korean/English controls and local team preservation.
- Update BOTH static and in-app privacy notices before production activation.

Never commit OAuth client secrets or operator tokens. Preview approval does not
authorize turning on production flags or publishing updated privacy claims.
