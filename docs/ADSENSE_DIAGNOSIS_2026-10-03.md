# AdSense live-site diagnosis - 2026-10-03

## Conclusion

The production app works for guests, and the public help pages contain substantive
server-delivered text. This is not evidence of a globally broken or inaccessible
site. The strongest content concern is that the initial app presents an empty
workspace and locked AI analysis; a visitor must interact to see useful results.
Most public prose explains how to use the product rather than demonstrating a
complete battle decision. This is a plausible weakness, not Google's confirmed
reason for the reported **Low value content** rejection.

There are also reproducible technical issues: an empty JavaScript-disabled home,
conflicting canonical/redirect destinations, catch-all successful responses for
missing pages, incomplete sitemap coverage, and a blocked analytics beacon.
Fixing those improves delivery and diagnosis but does not guarantee approval.

## Scope and evidence

- Checked `https://pokepilot.app` on October 3 EDT / October 4 UTC, using fresh,
  signed-out Chromium contexts, HTTP GETs, and the local source configuration.
- Desktop 1440 x 1000, mobile first visit 390 x 844, Korean and English documents,
  and JavaScript-disabled homepage/help/privacy checks.
- Interacted with the builder and calculator. No account sign-in, personal API
  key, AI analysis request, deployment, or review submission was made.
- Local diagnostic artifacts are ignored under `.tmp/`: `adsense-diagnosis.mjs`,
  `adsense-live-diagnosis.json`, `adsense-followup.mjs`, `adsense-followup.json`,
  and `adsense-live-*.png`. They contain public-page observations only.
- This report describes production. The existing uncommitted worked example,
  expanded sitemap, and noscript fallback are local changes, not live evidence.

## Confirmed findings

### 1. Homepage has no body content or links without JavaScript

The production HTML was 748 characters, with `<div id="root"></div>` as its
only body element. With JavaScript disabled, body text length and link count were
both zero. There is no loading explanation, readable product description, or
route to help in that state. The JavaScript-enabled app rendered successfully.

This establishes a fragile entry point for non-rendering clients or script
failures. It does **not** establish that Google saw a blank page: Google Search
can render JavaScript, and its crawler is distinct from AdSense's crawlers.
Do not infer an obligatory framework migration or that React cannot be approved.

Relevant source: `index.html`. A local noscript fallback is already prepared;
it helps JavaScript-disabled visits but is not a replacement for useful visible
content in the ordinary JavaScript-enabled first visit.

### 2. Canonical URLs disagree with actual document destinations

All five checked static documents behave the same way:

| Requested URL | Final URL after redirect | Declared canonical |
| --- | --- | --- |
| `/help/en.html` | `/help/en` | `/help/en.html` |
| `/help/ko.html` | `/help/ko` | `/help/ko.html` |
| `/help/api-key-en.html` | `/help/api-key-en` | `/help/api-key-en.html` |
| `/help/api-key-ko.html` | `/help/api-key-ko` | `/help/api-key-ko.html` |
| `/privacy.html` | `/privacy` | `/privacy.html` |

The `.html` response is a 307 redirect. Sitemap URLs and most internal links
also use `.html`. This is not an infinite browser redirect loop, but it sends
inconsistent preferred-URL signals. Cloudflare's default HTML handling accounts
for the extension removal. Choose one URL policy and align routing, canonicals,
language alternates, internal links, and sitemap entries.

Relevant sources: `wrangler.jsonc` assets configuration, `public/sitemap.xml`,
canonical and hreflang links in `public/help/*.html` and `public/privacy.html`.

### 3. Nonexistent pages return the homepage with HTTP 200

Both `/__adsense_diagnostic_missing_page__` and
`/help/__adsense_diagnostic_missing__.html` returned the same 748-character app
HTML with status 200 and the homepage canonical. The not-yet-deployed
`/help/kabamanda-ko.html` also returns the app, not the intended article.

This can conceal broken links and expose duplicate app responses at arbitrary
URLs. It is a soft-404 risk, not proof Search Console has classified these URLs
as soft 404s or that Google encountered them in the review. No broken existing
internal article link was found in this audit.

Relevant source: `wrangler.jsonc` sets
`assets.not_found_handling` to `single-page-application`. Establish the real app
routes and return an appropriate not-found response elsewhere. Preserve root
query-string flows such as authentication callbacks when changing routing.

### 4. Production sitemap omits the two API-key guides

The sitemap lists the homepage, privacy, and the two help translations. Both
API-key guides are live and linked from help, but are absent from the sitemap.
They remain discoverable through those links; sitemap omission is not a crawl
block or an established AdSense rejection cause. The local sitemap already adds
them along with the pending worked examples.

### 5. Cloudflare browser analytics is blocked by CSP

Production injects `https://static.cloudflareinsights.com/beacon.min.js/...`,
but `script-src` permits only self and the Google advertising script origin.
Chromium reported a CSP violation on the app and static documents. This prevents
the observed beacon from running. Browser-based visitor/performance statistics
may consequently be incomplete; edge HTTP request counts are a separate metric.

Relevant source: `public/_headers`. Decide whether to enable the configured
analytics and allow its documented script/collection endpoints, or disable the
injection. Do not relax CSP globally. This is a measurement defect, with no
evidence connecting it to the content rejection.

### 6. Minor failed sprite request with successful fallback

Selecting Garchomp requested the nonexistent PokeAPI item image
`/sprites/items/gen9/garchompite.png` (404; Chromium reported ORB blocking).
The final checked images were loaded, consistent with the existing fallback.
This adds an unnecessary failure but did not stop the app or leave the checked
sprite broken. It is low priority for this investigation.

Relevant sources: `src/api/showdownCatalog.ts`, `src/components/ItemSprite.tsx`.

## Public value and navigation observations

- First visit opens a dismissible four-step tutorial on both tested viewports.
  After dismissal, the default team is empty, matchup counts are zero, and the
  analysis area shows a selection prompt. Hovering it exposes the sign-in gate.
- Rankings load publicly. Selecting Garchomp fills a sample and updates stats
  and coverage. Selecting Primarina as the calculator opponent produces actual
  damage: the observed Earthquake range was 48.7-57.8% (91-108 HP). This is a
  functionality check, not independent validation of those battle calculations.
- AI output and account history are unavailable to an unauthenticated reviewer.
  The public site currently has help, API-key setup, and privacy prose, with
  Korean/English versions. Translations are useful accessibility, but do not
  demonstrate additional independent subject matter.
- English help exposed about 10,812 visible characters; Korean help about 5,805.
  These are descriptive measurements, not minimum approval thresholds. Existing
  help includes useful explanations and small conceptual examples; it is not
  an empty template or solely headings.
- Help is a genuine anchor in the app header, with an accessible name. Privacy
  in the app footer is a dialog button, while help and sitemap link the public
  privacy document. Privacy is therefore reachable; its footer presentation is
  an optional discoverability improvement, not a missing policy page.
- Checked internal links and fragment targets resolved. Public GitHub feedback
  and security-policy links both returned 200. Mobile document checks showed
  visible headings and no horizontal document overflow at 390px.
- No advertising script or ad placement was present in the checked rendered
  pages. Ownership metadata and ads.txt are present. There is no evidence from
  this audit of current ads covering controls or empty screens.

## Checks that passed and limits

- `robots.txt`, `ads.txt`, and sitemap all returned 200. Robots allows `/`.
  ads.txt publisher ID matches the home ownership meta tag.
- Main JS/CSS, local data, and observed public battle-usage endpoints loaded.
  No app JavaScript exception was observed. The signed-out account endpoint's
  401 is expected, not a site-access failure.
- Requests using `Mediapartners-Google`, `Google-Display-Ads-Bot`, and `Googlebot`
  user-agent strings returned the same homepage. This only excludes a simple
  user-agent-based block from this test location; it does not authenticate these
  requests as Google or rule out IP, geography, or historical WAF differences.
- The web search/open tool could not retrieve the site and returned no matching
  indexed results; direct HTTP and Chromium succeeded. This is a tool-specific
  limitation, not proof the site is unindexed or blocked for Google.
- Actual Google-rendered HTML, selected canonicals, indexing coverage, verified
  Google crawler request logs, and the reviewer's affected URLs remain unknown.
  Search Console inspection can check search rendering; it cannot reveal the
  entire AdSense review decision.
- No unit/build rerun was needed: this task adds diagnostic notes and ignored QA
  scripts, with no additional product-code changes.

## Recommended next sequence

1. Correct the confirmed URL routing/canonical mismatch and missing-page behavior;
   align the sitemap. Review and include the pending fallback for no-JS visits.
2. Expose a meaningful public result from the existing app: the prepared worked
   example can help if it clearly demonstrates decisions, calculations, and
   limitations. Make it accessible near the guest analysis gate while keeping
   the builder as the main experience. One example is not a promised approval fix.
3. Resolve analytics CSP separately so subsequent public-usage evidence is useful.
   Remove the avoidable image failure when touching the relevant asset resolver.
4. Verify the deployed URLs, static bodies, navigation, and non-existent URL status.
   Inspect the correct Search Console property and available verified crawler
   logs before attributing the rejection to bot access.
5. Request another review only after the chosen improvements are actually live.
   Keep improvements useful for visitors after approval.

There is no evidence here that bulk articles, automatic team insertion, a new
framework, removing the login/key requirement, or restoring ad requests would
by themselves resolve this rejection.

## Official references

- [AdSense content and navigation rejection guidance](https://support.google.com/adsense/answer/81904?hl=en)
- [AdSense crawler and Search crawler distinction](https://support.google.com/adsense/answer/99376?hl=en)
- [Google JavaScript rendering and soft-404 guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google canonical URL recommendations](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Cloudflare static HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
- [Cloudflare browser analytics and performance beacon](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)
