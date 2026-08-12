# Deployment Checklist

This checklist covers the first Vercel portfolio/beta deployment. It does not
replace provider dashboards, legal review, or real-device testing.

## Audit Baseline - 2026-08-11

- `npm run check`: passed (55 test files, 296 tests).
- `npm run audit:all`: passed with zero reported vulnerabilities.
- Production build: CSS 202.14 KB (38.13 KB gzip), Calculator 542.28 KB
  (134.11 KB gzip), main bundle 1,036.03 KB (291.47 KB gzip).
- Vite Preview smoke test: Team Builder, Calculator, usage-ranked selection,
  localized settings persistence, dark mode, touch selection dialog, and
  PokePilot drawers passed without console warnings or broken images.
- Responsive checks: 1920x1080 desktop, 1024x1366 and 820x1180 tablet, and
  390x844 mobile. No horizontal document overflow was found. Compact Team
  Builder layouts intentionally retain vertical scrolling.
- Still unverified: a real Vercel Preview deployment, hosted response headers,
  multi-instance Redis behavior, Lighthouse/cold-network performance, paid AI
  smoke calls in the deployment environment, and physical mobile devices.

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

- Publish a concise privacy notice explaining localStorage, the anonymous signed
  cookie, hashed-IP abuse controls, OpenAI processing, and bounded Redis caching.
- Provide a visible feedback/security contact path.
- Perform non-blocking real-device Safari and Android Chrome QA, including the
  virtual keyboard, safe areas, long press, orientation changes, and image export.
- Treat PokePilot guidance as advisory; legality and calculator output remain
  deterministic product features.
- Resolve or replace the personal/non-commercial EssentiarumVG font before any
  commercial use. Review all third-party notices again before a broad launch.
- Revisit the large JavaScript chunks if measured cold-load or interaction
  performance is poor; the current build warning alone is not a release blocker.
