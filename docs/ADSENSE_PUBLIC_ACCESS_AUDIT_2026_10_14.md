# AdSense public access audit - 2026-10-14

## Scope

Read-only checks of the production site following another Low value content rejection.
No deployment, review submission, account changes, or paid AI calls were made.

## Verified

- All eight URLs in the live sitemap return HTTP 200 without cookies: home, privacy,
  Korean/English help, API key guides, and analysis examples.
- Each has a self-referencing canonical. No inspected response has an X-Robots-Tag
  exclusion, and no inspected document has a robots meta exclusion.
- robots.txt permits all paths and points to the working sitemap.
- ads.txt returns the expected Google publisher entry as plain text.
- Twenty directly referenced local image/script/stylesheet assets return 200 with
  matching media types. This is not an exhaustive nested dependency crawl.
- Two intentionally missing URLs (root and help paths) correctly return 404.
- Requests with Googlebot, Mediapartners-Google, and AdsBot-Google user-agent labels
  return the same 200 home HTML. These are NOT verified Google-origin requests and
  do not prove Google's actual crawl succeeded.
- Chrome renders the application, Korean analysis example, and English help.
  The example's deferred screenshots load when scrolled into range; no desktop
  horizontal overflow was observed on the two inspected document pages.
- Analysis examples include HTML text equivalents of screenshot results, exposed
  to accessibility APIs and visually clipped with `.analysis-accessible-text`.
  The article is not image-only. This is not evidence that Google indexes or credits
  all of that text, nor evidence of a hidden-text policy violation.

## Limitations and observations

- Home remains client-rendered: its initial root is empty, with approximately 395
  characters of noscript guidance/navigation. This creates a dependency on JS for
  the tool interface, but does not establish an AdSense defect or require SSR.
- The available Chrome profile already contains signed-in account/team state.
  No logout or account mutation was performed. A pristine guest interactive flow
  and mobile layout were not tested during this audit.
- Search Console opened its welcome/Add a website screen in the available account.
  No usable property report was available; another account/property may exist.
  Actual indexing, Google-rendered screenshots, and fetch diagnostics remain unverified.
- The initial sandbox HTTP attempt and web research fetch failed. An approved
  direct request and Chrome succeeded; tool-access failures are not site failures.
- The public corpus is mainly help, onboarding, privacy, and one localized analysis
  example. Whether it supplies enough independent value is a qualitative review
  question, not a confirmed reason supplied by Google.

## Next step

Locate an existing Search Console property or add/verify pokepilot.app with owner
approval, then inspect the home and both example URLs, including live rendering.
Do not mass-produce articles or replace the frontend framework based on this audit.
No confirmed public-access defect currently justifies a production code change.

Local reproducibility: `.tmp/audit-public.mjs` and
`.tmp/audit-public-2026-10-14.jsonl` (ignored diagnostic artifacts).

## Follow-up: Search Console registration

- With explicit owner approval, added one Google verification TXT record at the
  domain apex. Google confirmed domain ownership. Existing DNS records were not changed.
- Submitted https://pokepilot.app/sitemap.xml; Search Console reports Success and
  8 discovered pages. Aggregate reports are processing.
- Home: already indexed. Live test passes (available to Google, can be indexed);
  Google's mobile screenshot shows the rendered team-builder UI, not an empty root.
- Korean example: Discovered - currently not indexed, last crawl N/A. Live test
  passes. A manual indexing request was attempted but no success confirmation was
  received; do not treat this as a completed request.
- English example: URL is unknown to Google in the index report, last crawl N/A.
  The newly submitted sitemap may not yet be reflected in this per-URL report.
- Separate verified defect: www.pokepilot.app still has a DNS-only CNAME to
  meek-otter-c7b19f.netlify.app (comment: Netlify www alias). A strict HTTPS request
  fails with SEC_E_WRONG_PRINCIPAL. No certificate validation was bypassed.
  Recommend replacing the stale alias with an HTTPS-capable canonical redirect;
  this change was outside the approved TXT-only DNS operation and was not made.
- Search indexing and Search Console live tests are not AdSense approval checks.
- English live test also passes (available to Google; can be indexed).
- The manual indexing attempt failed explicitly: Search Console reported it could
  not submit the request and could not connect to reCAPTCHA. No challenge was solved
  or bypassed. Sitemap submission remains successful independently.

## WWW remediation (owner approved)

- Updated the existing www CNAME from the retired Netlify hostname to pokepilot.app,
  enabled Cloudflare proxying, and replaced its outdated Netlify comment.
- Added active Single Redirect `PokePilot www to canonical HTTPS`
  (rule ID `86233f66493941f0b3c247748b1f0886`).
- Request wildcard: `*://www.pokepilot.app/*`; destination:
  `https://pokepilot.app/${2}`; status 301; preserve query string enabled.
- Strict TLS verification now succeeds for www; no certificate bypass was used.
- Verified HTTPS www root -> HTTPS apex root (301).
- Verified HTTPS www Korean example with two query parameters -> matching apex
  path and query (301).
- Verified HTTP www English example with a query -> matching HTTPS apex URL (301)
  -> 200; no redirect loop or intermediate www HTTPS hop.
- Apex Worker binding and Google verification TXT were not modified. No application
  code deployment was required. DNS/rule changes are already live.
- This fixes the confirmed www access defect, not a proven AdSense rejection cause.

## Public example entry point (local implementation)

- Replaced the AI panel footer's regulation/source label with a document icon and
  Analysis examples link. It opens the current scope's article section in a new tab.
- Footer controls are within the guest inert region and login blur overlay. Guests
  access the example via the link in the login notice, without a parenthetical
  no-sign-in label. Personal-key notices also link to the matching example section.
- Regulation/format is shown in the analysis confirmation; historical statistics
  provenance remains below the displayed analysis and retains its original date.
- Verified 1440px desktop and 360px mobile layouts, English/Korean destinations,
  all four scope targets, and guest notice link access with an inert/blurred footer.
  Guest browser checks used a local 401 account fixture, not a real OAuth login.
- Relevant regression tests: 17 passed. Lint and production build passed.
- Local normal preview: http://127.0.0.1:5203/ ; guest fixture: http://127.0.0.1:5204/ .
  This UI change is prepared for a separate feature branch; production deployment
  remains pending. The DNS remediation above is already live.

### API key gate follow-up

- Signed-in accounts whose resolved key status confirms no key now use the same
  panel blur/inert overlay as guests, including footer examples and model controls.
- The no-key notice replaces Google login with the locale-specific API key setup
  guide and retains the public example link. Confirmed key registration unlocks
  the panel. An unresolved key status does not falsely assert that a key is absent.
- Verified with a local simulated no-key account at http://127.0.0.1:5205/;
  360px mobile shows a 3px blur, an inert footer, and no horizontal overflow.

## Hippowdon practical guide draft

- Added Korean/English static guides at `/help/hippowdon-ko.html` and
  `/help/hippowdon-en.html`, linked from help and the existing Kabamanda examples.
  Source sitemap now includes both guides; these additions are not yet deployed.
- Compare the existing Impish 32 HP / 2 Def / 32 SpD Leftovers build with
  32 HP / 32 Def / 2 SpD, keeping the four moves and item unchanged.
- Observed usage snapshot: Champions Battle Data M7 Singles, 2026-10-13.
  Hippowdon data includes both spreads. Representative comparison inputs use
  Adamant Mega Salamence (32 Atk) and Modest Primarina (14 or 32 SpA).
- Five attack conditions, each against both spreads: unboosted and +1 Salamence
  Double-Edge, Primarina Sparkling Aria and Moonblast at 14 SpA, and Sparkling Aria
  at 32 SpA. Range/percentage/OHKO fields are reproduced by `hippowdonGuide.test.ts`.
- The switching example explicitly includes one Leftovers recovery of 13 HP:
  physical build survives two maximum unboosted Double-Edges with 4 HP; the special
  build faints to two minimum rolls. Prior chip and boosted attacks invalidate that
  guarantee. No claim of an independent in-game experiment or tournament result.
- Two downloadable single-Pokemon Showdown-style builds provided. The article
  notes Champions stat points, exact inputs, and no-login calculator access.
- Browser checked at 1440px and 360px; sprites loaded and no horizontal overflow.
  Existing article language-navigation logic reused. Relevant tests: 56 passed;
  lint and build passed. No paid model calls, commit, push, or deployment in this task.

## Release verification for review resubmission

- Owner requested deployment and AdSense review submission before deferring
  optional editorial improvements until the next morning.
- Full Cloudflare check passed: 159 test files, 1,306 tests, lint, asset build,
  and Worker dry run. Existing Vite bundle-size warning remains.
- The dependency audit initially blocked release on sharp/source-map-js warnings.
  Compatible lockfile updates include Wrangler 4.151.0, sharp 0.35.5, and
  source-map-js 1.2.2. Repeated full verification passed; audit reports no findings.
- Publication and review submission must be verified separately after main CI
  deploys. Google approval is not implied by these checks; edits made later may
  not be available when Google starts reviewing.
