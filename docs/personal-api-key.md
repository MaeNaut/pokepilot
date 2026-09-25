# Personal API Keys and Reasoning Levels

The hosted default is GPT-6 Luna at low reasoning. Signed-in users may register
a personal OpenAI API key in Account and settings. The same key is used for low
or medium when registered; without a key only site-funded low is available.
Personal-key requests bypass PokePilot's site-funded cooldowns and shared
analysis cache. OpenAI still applies its own billing and account limits.

The browser sends a key only once to `PUT /api/pokepilot/personal-api-key`.
The Worker encrypts it with AES-GCM using a domain-separated key derived from
`POKEPILOT_SESSION_SECRET`, a random nonce, and the account ID as authenticated
data. D1 stores ciphertext and nonce in `personal_api_keys`. The status endpoint
returns only `hasKey`; the browser never receives stored plaintext. Deleting an
account cascades to its key. Rotating the session secret makes existing keys
unreadable; plan a migration or ask users to register their keys again before
rotation. Never include key values in logs, metrics, teams, history, or browser
storage.

Apply `migrations/0004_personal_api_keys.sql` before deploying this Worker.
The existing `POKEPILOT_SESSION_SECRET` binding is required; no new secret is
needed. Personal calls are labeled `personal-low-miss` or
`personal-medium-miss` in `operational_metrics.cache_status` so they can be
separated from site-funded API costs.

The UI's typical times and costs are approximate per-attempt medians and means
from 24 GPT-6 runs per effort on September 24. Team had 18 cases per effort;
Pokemon and recommendation had three each. Sample analysis has no reliable
fixture-specific estimate, so the UI says its time and cost vary. Actual
requests depend on prompt length, cache status, output length, provider load,
and failed attempts. The site-funded path has no direct charge to the user.

Before release, run `npm run check:cloudflare`, apply the D1 migration in a
preview environment, and verify key registration, account isolation, low and
medium analyses, key removal, sign-out, and account deletion there.
