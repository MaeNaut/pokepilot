# Personal API Keys and Reasoning Levels

Analysis failures distinguish key authentication, access restrictions, model access,
billing/quota exhaustion, and transient rate limiting. Classification uses provider
status and allowlisted code/type identifiers, never raw error text. Billing failures
link to OpenAI Billing/Limits; key-related failures link to the localized setup guide.
An attempted provider request does not receive a blanket no-cost claim. Regression
tests use mock provider failures without paid calls.

The account preferences also sync the last selected analysis tab, model, and reasoning
level. Older accounts default to Pokemon and Luna low. Logging out resets this
selection; loading key status does not overwrite it. Tabs begin with Pokemon, then Team.

PokePilot analysis requires both a signed-in account and a registered personal OpenAI API key for both Luna low and Luna medium. There is no site-key fallback, free trial, advertising credit, or daily/monthly allowance at launch. Personal requests bypass the shared analysis cache. OpenAI billing and provider limits still apply; in-flight deduplication remains. The UI shows the registration form only when no key is registered, otherwise a saved status and delete action.

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

The UI shows estimated time and cost in a confirmation popover after pressing
Analyze, on both desktop and touch devices. Model choices are ordered
Luna medium, then Luna low. The default is Luna low.
Each menu option has a persistent secondary label: Luna low is the default;
Luna medium describes deeper reasoning at increased time and cost, without
numeric multipliers or a guarantee of accuracy. The confirmation popover still
shows scope-specific absolute estimates where measurements are available.

Luna's typical times and costs are approximate per-attempt medians and means
from 24 GPT-6 runs per effort on September 24. Team had 18 cases per effort;
Pokemon and recommendation had three each. Sample analysis has no reliable
fixture-specific estimate, so the UI says its time and cost vary. Actual
requests depend on prompt length, cache status, output length, provider load,
and failed attempts. There is no publicly accessible site-funded analysis path.

The localized static setup guides live at `/help/api-key-ko.html` and
`/help/api-key-en.html`. They are linked from the account key section, relevant
analysis errors, and the main Help articles. Their language controls switch
between guide URLs; they do not collect credentials.

Before release, run `npm run check:cloudflare`, apply the D1 migration in a
preview environment, and verify key registration, account isolation, both reasoning choices, key removal, sign-out, and account deletion there.
