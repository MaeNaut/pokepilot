# AdSense readiness

## 2026-10-01 review

The latest Sites detail reported **Low value content**. The earlier rejection
reported ads on screens without publisher content; these are different notices.
An authorized `ads.txt` and ownership verification do not establish content
approval. The notification email alone does not identify affected URLs or the
reviewer's exact reasoning.

The interactive builder and calculator remain the main experience. AI analysis
requires sign-in and a personal key, so private analysis history cannot serve as
public evidence of the site's value. Existing help is useful documentation, but
the lack of a directly accessible worked example was a plausible weakness, not
a confirmed explanation from Google.

## Changes prepared locally

- Added `/help/kabamanda-ko.html` and `/help/kabamanda-en.html`, now titled
  **PokePilot analysis examples**. Real recorded Pokemon/team/replacement/sample
  results precede a Luna low/medium comparison. Screenshots replay the app's result
  component, with accessible static transcripts and single-call measurements.
- The six builds, authored selection notes and calculator checks remain in an
  expandable appendix, clearly separate from AI output. Source adjustments and
  model limitations are disclosed; do not claim a tournament win or highest win rate.
- Added links from help and the app's guest/no-key prompts. Reading the article
  does not require credentials, replace a user's team, or make an OpenAI call.
- Added the example and existing API-key guides to the sitemap. A genuine
  JavaScript-disabled fallback on the app links to complete static articles.
  No crawler-only content, hidden keyword text, or main-page guide replacement.
- Tests validate the downloadable team's M-C legality, investments, items,
  article links, and published damage against the app's bundled calculation data.

The example is deliberately fixed to the reviewed M-C snapshot. Recheck it when
regulation or calculator mechanics change. Daily usage refreshes must not silently
rewrite the article or imply new verification. Damage checks are not independent
in-game validation or an AI quality benchmark.

## Before requesting another review

### Technical fixes prepared after the live-site diagnosis

- Production and QA assets now keep `.html` as the canonical document URL.
  Explicit 301 redirects preserve the previously served extensionless URLs.
  The root rewrites to `index.html`, including authentication query strings.
- Missing paths serve a bilingual `404.html` with HTTP 404, not the app shell.
  `/api/*` still runs through the Worker and retains JSON errors.
- CSP permits the configured Cloudflare analytics script and collection origin.
  Both privacy translations disclose browser analytics separately from API metrics.
- Garchompite uses the existing standard PokeAPI sprite directly instead of first
  requesting its nonexistent gen9 image.
- Run `node scripts/verify-public-site.mjs <origin>` against a local Wrangler
  server, preview, or production to verify public routing, canonical destinations,
  sitemap pages, missing paths, and response headers. This is read-only.

The diagnostic baseline is in `ADSENSE_DIAGNOSIS_2026-10-03.md`. These fixes are
local until deployment. Cloudflare's actual injected analytics beacon and Google's
rendering/crawler history still require checks on the deployed site.

### Deployment and review

1. Deploy the verified changes. Confirm the article bodies, styles, images,
   download, help links, and sitemap on `pokepilot.app`, not just localhost.
2. Confirm no accidental login redirect, noindex, robots block, or broken route
   prevents access to the public material. `robots.txt`, `ads.txt`, and the
   existing help/privacy pages should remain accessible.
3. Use the correct Search Console property to inspect the homepage and both
   examples, including rendered content and canonical URLs. Access to the property
   was unavailable during diagnosis; indexing is not yet verified. Search
   indexing and AdSense approval are separate checks.
4. Review public navigation and content quality on mobile and desktop. Keep
   useful material after approval; do not temporarily pad content for the review.
5. Inspect the current AdSense Sites details, then request review after the
   public changes are confirmed. This work does not submit that request.

Google does not promise approval after adding one example or a fixed number of
articles. More original content may be needed if the next review gives the same
notice. Any future ad placement needs a separate check: empty editors, loading
screens, blocked analysis, and navigation controls must not become ad-only views.

## Local verification

- Follow-up technical verification: 31 real HTTP responses passed against a fresh
  local Wrangler server, including root auth-error query strings, canonical and
  alias routes, missing assets/documents, API JSON 404s, and CSP origins.
- Chromium checks passed at 1440px and 390px, including the touch login gate's
  readable example link, both article translations and sprites, the bilingual
  404, and a no-JavaScript visit following the homepage link to the example.
- Full tests (1,180), lint, and the final Cloudflare build passed. Local Wrangler
  should be restarted after rebuilding `dist` so its watched redirect map does
  not retain the intermediate empty output directory.

- Full suite: 154 files, 1,180 tests passed. Lint, Cloudflare asset build, and
  whitespace checks passed. The existing large-chunk build warning remains.
- Browser checks covered Korean/English, light/dark, desktop, and narrow mobile
  layouts. The six sprites loaded, articles had no horizontal overflow at 320px,
  and the mobile table of contents opened, closed, and tracked the selected section.
- Language changes stayed on the same example article. The team-text download
  matched the checked-in sample; importing it in a fresh local app produced six
  valid members, 66-point builds, and the intended Mega forms/abilities/items.
- Initial routing verification made no paid AI calls. The follow-up example
  journal used 10 explicitly authorized evaluation-key calls (4 low examples and
  1 medium comparison per language). See `PUBLIC_ANALYSIS_EXAMPLES.md` for the
  fixed inputs, limitations, cost and verification. No account change, production
  deployment or AdSense review submission was made. Real Safari testing and
  production crawl/index inspection remain outside this local verification.

## Production verification - 2026-10-04

- PR #5 merged as `73ca2c9`; GitHub Actions run `37184213774` completed
  successfully, including Cloudflare deployment and unpaid authentication checks.
- Release checks passed: 1,184 tests across 154 files, lint, build, Wrangler dry
  run, and dependency audits with zero reported vulnerabilities.
- Production public-routing verification passed all 31 HTTP responses. Both
  example translations and 26 asset/download responses passed; neither article
  has a noindex directive or an ad placement.
- Live Chrome checks covered image expansion/collapse, image dialog opening and
  closing, desktop layout and 390px mobile navigation. Images loaded without
  horizontal overflow. These checks did not make paid AI calls.
- AdSense Sites still reports `Low value content` from October 1. The current
  notice mentions authentic value, ongoing maintenance, and genuine user interest.
  Technical verification does not establish that all approval criteria are met.
- After explicit user confirmation of the "I confirm I have fixed the issues"
  checkbox, the review request was submitted on October 4. AdSense's site detail
  changed to `Getting ready` / `Review requested`. Approval remains pending.
  Search Console rendering/indexing remains unverified.

## Production verification - 2026-10-14

- Main `2e0310d` passed CI and deployed Worker version
  `4316835e-2158-401c-81a5-f0153accb3d3` (Actions run `38524737907`).
- Published both Hippowdon practical guides and contextual example/key-gate UI.
  Full pre-release check passed 1,306 tests; dependency audit found no remaining
  vulnerabilities after compatible lockfile updates. Public routing passed all
  37 responses, including the expanded 10-URL sitemap.
- The www hostname now redirects to canonical HTTPS rather than the removed
  Netlify project. Search Console ownership and sitemap submission are confirmed.
  Google's live homepage rendering displayed the app; manual actions and security
  issues reported none. Indexing the two example translations remains unconfirmed;
  this is separate from AdSense approval.
- AdSense resubmission completed at 02:54 EDT on October 14. The visible state was
  `Review requested` / `Getting ready`, not `Ready`. Do not submit another request
  just to apply editorial improvements or imply approval is assured.
- Subsequent reader-flow QA clarified the guide's import/calculator steps and
  strengthened downloadable-sample tests. Those follow-up edits are local,
  with 1,309 tests and Cloudflare checks passing; they are not deployed yet.
  See [the detailed public-access audit](./ADSENSE_PUBLIC_ACCESS_AUDIT_2026_10_14.md).

## Pending UI resilience follow-up - 2026-10-14

- Analysis now shows elapsed time and observed auth/save/input/response-wait
  phases. Desktop settings open leftward; compact layouts use centered dialogs,
  without left arrows. Mega Stone controls keep square dimensions.
- Browser AI-response deadlines are 150 seconds for low and 390 seconds for
  medium, allowing the server's existing single retry and transport overhead.
  Headers and body reads share one deadline. Timeout aborts browser waiting;
  it does not promise cancellation of server/provider processing or charges.
- No browser automatic resubmission. Late responses cannot replace the terminal
  timeout or trigger a stale account refresh. Pre-call failures and post-submission
  exceptions have separate billing language; empty prepared inputs show an error.
- Real Chrome local-fixture checks covered the 150-second timeout, provider error,
  null JSON, save failure, and expired-session login gate. Unit tests additionally
  cover medium deadlines, stalled bodies, cancellation, preparation failure,
  cleanup, and explicit retry. No paid OpenAI request or production mutation.
- Full release checks passed 1,338 tests across 159 files, lint, Cloudflare build,
  and Worker dry run. The final timeout wording also passed its focused tests.
- These edits, along with the earlier guide refinements, remain uncommitted and
  undeployed. Real authenticated Cloudflare preview QA is a separate release step.

## References

- [AdSense content and user experience](https://support.google.com/adsense/answer/10015918)
- [AdSense Program policies](https://support.google.com/adsense/answer/48182)
- [Google Search JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [M-C example in Korean](https://pokepilot.app/help/kabamanda-ko.html)
- [M-C example in English](https://pokepilot.app/help/kabamanda-en.html)
