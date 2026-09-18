# Account authentication rollout

Status: opt-in implementation, not enabled in production. Google OAuth and a
real Netlify Identity preview must be verified before rollout.

## Preview setup

1. Enable Netlify Identity for the existing project. Enable Google as an external
   provider, configure its OAuth client and exact callback URL in Google Cloud.
   Disable email/password signups if Google is the only intended signup method.
2. Set `VITE_ACCOUNT_AUTH_ENABLED=true` for the preview build and
   `POKEPILOT_AUTH_REQUIRED=true` for its functions. Always enable both together.
3. Set server-only `POKEPILOT_IDENTITY_URL` to the trusted Identity endpoint
   (`https://<configured-identity-host>/.netlify/identity`), never a request header.
4. Use Node >=22.12.0. Plain Vite has no Identity endpoint; test authentication on
   Netlify. Do not enable production flags until preview acceptance is complete.

The SDK uses localStorage and JavaScript-readable Secure cookies, NOT HttpOnly
cookies. It restores and refreshes its own session; no custom 30-day session
policy is claimed. Server authorization calls Identity `/user` every time and
fails closed if unavailable. No unverified JWT claims or body user IDs are used.

Redis usage keys retain their current expiration and atomic reservations, but
use a namespaced hash of the verified account ID. IP safeguards and analysis
caching remain. There is no new global spending cap. No team cloud sync or
credit ledger is implemented. Existing local teams/history stay on the device.

Account deletion requires same-origin DELETE and a verified session, deletes
only the caller through Identity admin, then clears the browser session. Existing
Redis usage entries expire normally. Re-registration abuse needs separate review;
account deletion is not a promise to permanently blacklist that identity.

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
