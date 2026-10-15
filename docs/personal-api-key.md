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
Unsaved key drafts are bound to the signed-in account and cleared on menu close,
authentication changes, or confirmed logout/deletion. Old async completions cannot
restore a draft or modify a later account/menu session. Authentication notifications
clear drafts immediately even if the same account signs back in before its UI changes.
The Worker encrypts it with AES-GCM using a domain-separated key derived from
`POKEPILOT_SESSION_SECRET`, a random nonce, and the account ID as authenticated
data. D1 stores ciphertext and nonce in `personal_api_keys`. The status endpoint
returns only `hasKey`; the browser never receives stored plaintext. Deleting an
account cascades to its key. Rotating the session secret makes existing keys
unreadable; plan a migration or ask users to register their keys again before
rotation. Never include key values in logs, metrics, teams, history, or browser
storage.

Personal analysis has no daily/monthly allowance or product cooldown. Shared-server
abuse protection remains: 20 requests/account/minute, 80 requests/IP/minute, at most
two active analyses/account and 64 globally within the configured Redis namespace.
These controls apply across Worker instances, model effort, and request fingerprints;
duplicate followers do not take additional active-analysis permits. Rejections before
provider execution explicitly report that no provider call occurred. Permits release
after completion/failure and expire after 450 seconds for crash recovery. The server
also aborts provider requests, including stalled response-body reads, after 140 seconds
(low) or 390 seconds (medium), keeping work inside the permit lifetime. Cleanup-store
failure does not discard a completed paid result.
Duplicate followers preserve the provider error classification and billing uncertainty;
operational usage metrics count the provider execution only once.

Key/team/history/preferences writes use a shared streaming byte limit before JSON
parsing. Existing storage limits remain separate; transport limits allow JSON escaping,
Unicode, and envelope overhead. Oversized streams are canceled even without a truthful
Content-Length header. Team migration starts only after a PUT body passes this boundary.

Apply `migrations/0004_personal_api_keys.sql` before deploying this Worker.
The existing `POKEPILOT_SESSION_SECRET` binding is required; no new secret is
needed. Personal calls are labeled `personal-low-miss` or
`personal-medium-miss` in `operational_metrics.cache_status` so they can be
separated from site-funded API costs.

The UI shows approximate time, total-token and cost ranges in a confirmation
popover after pressing Analyze, on both desktop and touch devices. Model choices are ordered
Luna medium, then Luna low. The default is Luna low.
Each menu option has a persistent secondary label: Luna low is the default;
Luna medium describes deeper reasoning at increased time and cost, without
numeric multipliers or a guarantee of accuracy.

Before showing the estimate, prepare the complete input, including Pokemon/set
recommendation candidates. A lazy browser Worker counts the same prompt parts
and compressed battle data used by the provider path, plus the output schema,
with local `o200k_base` tokenization and approximate message framing. This is
not the provider's authoritative billable token count. Opening the estimate does
not call OpenAI, save the team, or register/validate a key with OpenAI.

Forecast output tokens (including reasoning) and duration use 80 historical
published-team runs, grouped by the four public scopes, Singles/Doubles and
low/medium, with roster-size scaling and broad heuristic margins. Sample
recommendation now has estimates too. See the preflight-estimate section in
`AI_MODEL_EVALUATION.md` for sources, formulas and limitations; these are not
confidence intervals or a spending cap. There is no automatic learning from
private user analyses. Missing calibration or a worker failure shows an
unavailable message without inventing a price, and permits explicit confirmation.

Costs combine the locally counted input and forecast output at the shared
application pricing. No cache-read discount is assumed; the upper estimate also
allows a common/scope-prefix cache write. Cache hits, retries, model-specific
tokenization, actual output length and provider load can put the actual bill or
duration outside the displayed range. Cached input is a subset of input, not
extra total tokens. There is no publicly accessible site-funded analysis path.

Confirmation reuses the prepared input snapshot rather than recomputing it.
Authenticate and save the team before sending the paid AI request. Failed saving,
workspace/account changes or usage-source rollover stop submission; changing the
analysis context closes the old confirmation. Dismissing the confirmation aborts
pending local tokenization. Completed analysis/history retain the actual provider
token usage, application-calculated cost, request duration and original statistics
provenance, not the preflight forecast.

The localized static setup guides live at `/help/api-key-ko.html` and
`/help/api-key-en.html`. They are linked from the account key section, relevant
analysis errors, and the main Help articles. Their language controls switch
between guide URLs; they do not collect credentials.

Before release, run `npm run check:cloudflare`, apply any pending D1 migrations
in an isolated QA environment, and verify onboarding, key registration, account
isolation, both reasoning choices, key removal, sign-out, and history reload.
Only delete a real account or its registered key after explicit owner confirmation;
automated deletion tests use disposable test data. Plain Vite does not implement
the account API and cannot verify this flow; use the aliased Cloudflare QA URL.
