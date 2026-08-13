# Deployment Checklist

This checklist covers the first Vercel portfolio/beta deployment. It does not
replace provider dashboards, legal review, or real-device testing.

## Audit Baseline - 2026-08-12

- `npm run check`: passed (57 test files, 312 tests).
- `npm run audit:all`: passed with zero reported vulnerabilities.
- Production build: CSS 202.41 KB (38.17 KB gzip), Calculator 542.29 KB
  (134.12 KB gzip), main bundle 1,044.28 KB (294.01 KB gzip). The existing
  large-chunk warning remains a measured optimization target, not a release
  blocker.
- Production smoke test at `https://pokepilot-ai.vercel.app`: Team Builder,
  Calculator, usage-ranked defaults, save/restore, Showdown export, locale and
  theme persistence, bidirectional damage results, and PokePilot analysis all
  passed without application console errors.
- Hosted infrastructure: security and cache headers, Smogon rewrite, separate
  Preview/Production secret scopes and Redis prefixes, an uncached AI request,
  a repeated server-cache hit, privacy-safe logs, and fail-closed invalid input
  behavior were verified. The measured uncached team analysis cost about
  USD 0.00266; its identical cache hit returned without another model call.
- Local release-candidate Lighthouse: desktop 99 Performance / 100
  Accessibility / 100 Best Practices / 100 SEO; mobile 77 / 100 / 100 / 100.
  Desktop LCP was about 1.0 seconds with zero blocking time; emulated mobile LCP
  was about 4.7 seconds with 185 ms blocking time and zero layout shift.
- Responsive checks: prior 1920x1080 desktop, representative tablet layouts,
  and 390x844 mobile QA remain valid. The final 1920px release-candidate layout
  has no horizontal document overflow and keeps the footer at 32px.
- Upstash remained negligible during QA (241 commands and 12 KB at the audit
  snapshot), and Vercel logs showed the expected function invocations.
- Still unverified: physical Safari and Android Chrome behavior. The local
  accessibility/privacy fixes also require one final deployment smoke test
  after they are pushed.

## 1. Automated Gate

Run from the repository root:

```bash
npm ci
npm run check
npm run audit:all
```

The GitHub Actions workflow runs the same gate on pushes to `main` and pull
requests. Do not deploy while any command or CI job is failing.

## 2. Vercel Project

- Import `MaeNaut/pokepilot` and keep the framework preset on Vite.
- Use Node.js 22. The package currently requires Node.js 20 or newer.
- Keep Preview and Production variables in separate Vercel scopes.
- Confirm that `vercel.json` is detected. It configures the AI function's
  60-second duration, the production Smogon stats rewrite, security headers,
  and cache headers for generated static data.

## 3. Server-Only Environment Variables

Set these in Vercel without a `VITE_` prefix:

| Variable | Preview | Production | Notes |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Preview key or intentionally omitted | Restricted production key | Responses write permission only |
| `POKEPILOT_CLIENT_SECRET` | Separate random value | Separate random value | Signs anonymous client IDs; do not reuse the OpenAI key |
| `UPSTASH_REDIS_REST_URL` | Required for hosted AI QA | Required | Server-only REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Required for hosted AI QA | Required | Server-only token |
| `POKEPILOT_REDIS_PREFIX` | `pokepilot:operations:preview` | `pokepilot:operations:prod` | Prevents preview traffic from consuming production state |
| `POKEPILOT_SHARED_STORE_REQUIRED` | `true` | `true` | Fails closed instead of silently using per-instance memory |

Keep the OpenAI project hard budget enabled. Never place provider secrets in
client code, Git, or a `VITE_` variable.

## 4. Preview Verification

Deploy a Preview build first and verify all of the following before promoting:

- Team Builder and Calculator load without console errors.
- A blank team can select a Pokemon and receive usage-ranked defaults.
- The `/smogon-stats/...` request succeeds through the same-origin rewrite.
- Save, reload, rename, Showdown import/export, bench, and last-opened restore work.
- English/Korean and system/light/dark preferences survive reloads.
- Desktop, tablet, and mobile layouts have no accidental document overflow.
- PokePilot succeeds with AI enabled and falls back clearly when AI is disabled.
- A repeated identical analysis is served from cache without another model call.
- Cooldown responses show a countdown and recover after `Retry-After`.
- Two concurrent identical requests produce one model call through the shared lease.
- A deliberately invalid Redis credential makes the AI route fail closed.
- OpenAI and Upstash dashboards show the expected request, token, and command counts.

## 5. Production Smoke Test

- Promote the exact verified Preview commit.
- Confirm the custom/generated favicon, title, and description.
- Verify response headers, especially CSP, frame denial, MIME sniffing denial,
  permissions policy, and static cache policy.
- Repeat one uncached and one cached PokePilot request.
- Confirm that production uses the `:prod` Redis prefix.
- Check Vercel function logs for errors without team contents, raw IPs, or secrets.
- Check a representative cold load and run Lighthouse once on desktop and mobile.
- Keep the previous healthy Vercel deployment available for immediate rollback.

## 6. Public-Beta Follow-Ups

- Keep the published privacy notice aligned with localStorage, the anonymous
  signed cookie, hashed-IP abuse controls, OpenAI processing, and bounded Redis
  caching as those systems evolve.
- Keep the visible feedback and security-reporting paths operational, and enable
  GitHub private vulnerability reporting before a broader public launch.
- Perform non-blocking real-device Safari and Android Chrome QA, including the
  virtual keyboard, safe areas, long press, orientation changes, and image export.
- Treat PokePilot guidance as advisory; legality and calculator output remain
  deterministic product features.
- Resolve or replace the personal/non-commercial EssentiarumVG font before any
  commercial use. Review all third-party notices again before a broad launch.
- Revisit the large JavaScript chunks if measured cold-load or interaction
  performance is poor; the current build warning alone is not a release blocker.
