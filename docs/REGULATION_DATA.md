# Regulation M-C data

The active legality snapshot is `showdown-regulation-mc.json`. Battle data is
generated as `showdown-battle-mc.json`, merging the Showdown base move table with
the Champions move overrides. Run `npm run data:showdown` to regenerate both.
The current upstream `champions` mod represents M-C; verify this at the next
regulation change before running the generator.

Pokemon battle data requires Showdown, while PokeAPI is an optional image source
with a four-second request timeout. Missing artwork falls back to Showdown.
Korean descriptions use the generated PokeAPI catalog and local overrides;
missing descriptions show English with a Korean notice.

## Daily Battle Usage

Rankings and automatic samples now use Pokemon Champions Battle Data:
https://championsbattledata.com/api_guide. Showdown remains the source of battle
rules and legality; PokeAPI/local catalogs remain responsible for localization
and imagery. The old monthly Smogon usage loader and proxy have been removed.

`/api/battle-usage/{singles|doubles}` returns a compact current summary, while
`/{pokemonId}` loads detailed options on demand. The upstream index provides
rank positions, not overall species usage percentages. Do not invent those
percentages from rank. Nature and Stat Point distributions are independent;
`statPointSpreads` percentages describe points alone, never a joint nature/build.
Legacy analysis contracts retain `sourceMonth` (snapshot month) and `cutoff: 0`
(no supplied rating filter), so existing history remains readable.

Index/cache refresh is demand-driven after one hour, with browser HTTP caching
for five minutes and Cloudflare edge caching for one hour. No per-visitor bulk
download or permanent raw archive is created. Failed refreshes may reuse a
last-known snapshot for at most seven days from its data date. Source UI includes
season/date and warns on refresh failure or data older than two days. An index
with mixed dates is rejected when less than 90% of its ranked entries share the
latest date/season. Detail must match the index date, species, and format.

Season and date discovery do not require monthly code edits. The provider does
not expose a regulation identifier in the checked index: season discovery is
NOT proof of regulation compatibility. New regulation releases still require
review of Showdown legality/rules, newly added forms, and statistical coverage.
Do not infer regulation from the M-number of a ranked season.

Attribution is required; commercial app use and reasonable caching are allowed.
Permanent mirrors, raw bulk redistribution, and competing data feeds are not:
https://championsbattledata.com/api-rules/.

Run `npx tsx scripts/qa-battle-usage.ts` for an unpaid live read-only check of
both formats and representative forms. Then check ranking, automatic samples,
calculator samples, recommendations, stale labels, and browser-cache rollover.

Prompt version 92, Pokemon cache v25, and Showdown battle-data cache v3 separate
the updated data from old cache entries. Saved teams reload Pokemon data by ID,
preserving configured builds.

## Usage Migration QA on 2026-09-30

- Live M6 / 2026-09-30 snapshots loaded 262 ranked entries per format.
  Compact summaries were about 157 KB each, versus the 4.2 MB upstream index.
- Live detail checks passed for Garchomp, Indeedee-F, Meowstic-F, Pyroar,
  and Furfrou in both formats. Cosmetic usage aliases are supported without
  merging mechanically different gender forms.
- Chrome checked Garchomp auto-selection, its transfer into the calculator,
  season/date attribution, and a 390px mobile viewport. No page errors or
  horizontal document overflow occurred.
- 149 test files / 1,097 tests, lint, TypeScript, the Cloudflare production
  build, and Wrangler dry-run passed. Paid AI evaluation and production
  deployment were not performed. The existing large-chunk build warning remains.

### Deep QA Follow-Up (Source Date 2026-10-01)

- All 524 current sets (262 Singles / 262 Doubles, season M6) passed contract,
  species/form alias, legal ability/move/item, and calculator-side checks.
  Ten live detail samples matched their index date, season, and species.
- Fixed per-format refresh isolation, invalid numeric/duplicate-rank input,
  gender-specific usage matching, and source ranks after partial refreshes.
  Active Mega forms use their matching base species statistics; projected Mega
  recommendations do not inherit a base ability or an incompatible Mega Stone.
- Regenerated the official Showdown catalogs. Gender-only forms now inherit
  base legality without replacing their distinct abilities, and forms without
  a Champions override inherit the Champions learnset rather than old game data.
  The cache version bumps prevent existing browsers from retaining stale catalogs.
- Chrome passed sixteen language/theme/viewport combinations (English/Korean,
  light/dark, 1440px desktop, 820px/1024px touch tablets, 360px touch phone), plus unavailable index, unavailable
  detail, and stale-data UI cases. Fourteen representative form selections
  matched their ability, nature, and stat points; both calculator formats passed.
  No page exceptions or horizontal document overflow were found in these checks.
- Real-data threat, replacement, optimization, and model-input preparation passed
  all four language/format combinations without paid AI calls. Fixed an input
  validator false positive that rejected ordinary KO estimates above six hits;
  the separate six-turn persistent sequence limit remains intact.
- Local workerd reproduced a deployment-blocking `redirect: "error"` incompatibility.
  Requests now use `manual` and reject non-2xx upstream responses. Actual Workers
  HTTP checks passed for both indexes, ten details, public cache reuse, HEAD,
  unsupported methods/paths, and assets. Cold index and detail loads each passed
  twelve concurrent requests across both formats. No production DB or API key was used.
- Final gate: 151 test files / 1,130 tests, lint, TypeScript, Cloudflare build,
  and Wrangler dry-run passed. Authenticated account flows, paid AI output quality,
  deployed edge CPU/quotas, and production rollout were not tested in this pass.

Repeat the read-only deployment check with:

```sh
npx tsx scripts/qa-battle-usage.ts --base-url=https://your-preview.workers.dev
```

Omit `--base-url` to check the provider through the shared Node handler. A new
season still requires a rules/legality compatibility review; season M6 remained
the provider's current season even after its source date moved to October 1.

### Authenticated Preview Follow-Up (Source Date 2026-10-01)

QA URL: https://qa-pokepilot.pokepilot-ai.workers.dev.
Final version: `082b4920-b629-4beb-8237-79b8065cd428`. The version upload used
`wrangler.qa.jsonc`, the `pokepilot-qa` D1 database, and the QA Redis prefix;
it did not promote a version to production traffic.

Four signed-in Luna low calls used the account's registered personal key:

| Scope | Analysis time | Total tokens | Estimated cost (USD) |
| --- | ---: | ---: | ---: |
| Pokemon | 11.0s | 7,391 | $0.0012 |
| Sample | 7.7s | 10,560 | $0.0012 |
| Team | 13.0s | 11,631 | $0.0017 |
| Find | 10.7s | 22,747 | $0.0027 |

Total: 52,329 tokens and approximately $0.0068. These were functional UI checks
against current usage data, not a comprehensive model-quality benchmark.
No additional paid calls were made to exercise restored history actions.

- Fixed draft analyses disappearing from the current team's history on its
  first save. Completed and in-flight calls now follow the same draft into its
  saved team, without crossing account or unrelated workspace boundaries.
- Fixed false stale warnings after restoring sample analysis. Lazy optimization
  planning is excluded from the UI freshness key; the full model cache key and
  actual build, slot, format, and matchup changes remain significant.
- Fixed recommendation cards disappearing after bench saves or history reloads.
  History retains only validated candidate snapshots referenced by the output,
  and also recovers them from older full request fingerprints. Lazy candidate
  list resets do not invalidate an otherwise unchanged team or filter state.
- Chrome verified first-save history promotion and reload with original call
  metrics, restored sample application, recommendation-to-bench persistence,
  and recommendation selection into an empty slot. Genuine team edits still
  mark old recommendations stale and disable their actions.
- The final deployed read-only check passed all 524 ranked sets and ten detail
  samples. Guest authentication boundaries and security headers passed. Paid
  concurrency/load testing was not performed; this is not a scale guarantee.
- The dashboard, filtered to the three versions uploaded in this pass, showed
  117 Worker invocations, four successful OpenAI subrequests, and zero runtime,
  CPU-limit, memory-limit, or client-disconnection errors. CPU P50/P90/P99 were
  2.95/21.01/86.14ms; memory P50/P99 were 12.38/25.79MB. These are small-sample
  aggregate metrics, not per-endpoint latency or CPU measurements.
- The account was still on Workers Free. Its documented 10ms CPU allowance is
  lower than the measured high percentiles. Occasional burst tolerance and zero
  errors in this sample do not establish free-tier safety for public operation;
  Workers Paid is recommended before launch unless a separate CPU optimization
  pass demonstrates adequate headroom. Network wait time is not CPU time.
  See https://developers.cloudflare.com/workers/platform/limits/.
- Final gate: 152 test files / 1,143 tests, lint, TypeScript, Cloudflare build,
  and Wrangler dry-run passed. The existing large-chunk build warning remains.
  Production stayed on `6a19cef4-f569-4601-907c-77901f30cd29` at 100% traffic;
  no commit or push was made in this QA pass.

## QA on 2026-09-09

M-C search keeps fixed forms separate: both Indeedee genders (stats, abilities,
and moves differ), both Toxtricity forms (Plus/Minus and signature moves differ),
and Green/Yellow Squawkabilly as mechanical representatives. Blue matches Green's
Guts group; White matches Yellow's Sheer Force group, so their future usage entries
fold into those representatives. Hidden colors remain loadable for saved teams and
imports, but are excluded from search and recommendation duplicates. Only in-battle
states such as Aegislash, Palafin, and Morpeko use the post-selection form control.

- Legal form count: 314 (M-B) to 349 (M-C), including all six added Mega forms.
- All 35 added entries load through the production loader with PokeAPI offline.
- All 35 have a working PokeAPI default sprite and official artwork after ID
  normalization. Champions-specific icons are missing for 34; only Pawmot has one.
- Korean names and descriptions now use PokeAPI first, Showdown Korean text as a
  fallback, and concise local overrides when both sources are missing. M-C has
  complete selectable-name and description coverage. Fairy Feather, Eelevate,
  and Fire Mane now come from upstream data instead of duplicate name overrides.
- Corrected PokeAPI aliases for apostrophes, Indeedee genders, Squawkabilly colors,
  and Toxtricity's default form. Exact form learnsets now take precedence over the
  base species, preventing male/female move leakage.
- Old regulation payloads are rejected even if their structural schema matches.
- A representative six-Pokemon team and all six newly available Mega forms were
  imported, exported, and validated in the live Pokemon Showdown teambuilder for
  `[Champions] VGC 2026 Reg M-C`. All 35 M-C additions also pass an automated
  canonical Showdown-name round trip.
- Team builder, calculator, search, share-image previews, team analysis, and
  Pokemon analysis were exercised with the new forms. Search keeps Mega forms
  behind the base species' Mega controls and exposes fixed, mechanically distinct
  forms as separate choices.
- Share images use full names for fixed forms and compact form labels for battle
  states. Rotom-Wash, Persian-Alola, Basculegion-F, Aegislash-Shield,
  Palafin-Zero, and Morpeko-Full-Belly were checked alongside the six newly
  separated M-C form choices; every team and individual artwork loaded.
- The later Champions damage-engine update now covers Aura Guard contact damage
  reduction, with damage-roll regression tests in `damageCalculator.test.ts`.
- Chrome controller failed to start; VS Code browser was available. Rillaboom
  selection was exercised there, including the missing Champions icon fallback.
- At the time of this 2026-09-09 QA run, 630 tests, lint, and the production
  build passed. Paid AI quality evaluations were not run. Run the current
  `npm run check:cloudflare` gate before treating this historical count as a
  release signal.
