# Recommendation Battle-Data Expansion

Date: October 5, 2026. Implementation and bounded smoke QA, not an accuracy benchmark.
Default Luna low, optional Luna medium, and compact/lossless input encoding remain unchanged.
No Sol calls, commit, push, or deployment.

Follow-up: [selective Pokemon request enrichment](AI_RECOMMENDATION_SELECTIVE_REVIEW_2026_10_05.md)
now narrows the outgoing Pokemon recommendation detail. Source collection and
the 24-candidate sample pool below are retained; the original measurements remain
historical evidence of the full expansion.

## Data Contract

| Area | Previous | Expanded |
| --- | --- | --- |
| Usage source moves | Up to 8 | Up to 12 |
| Usage source items | Up to 4 | Up to 6 |
| Usage point distributions | Up to 6 | Up to 10 |
| Usage natures | Leading nature | Up to 3, with measured percentages |
| Pokemon recommendation | Up to 30 candidates, 4 representative moves each | Same candidate limit and representative set, plus up to 8 additional legal observed moves, item/nature choices and point distributions |
| General sample recommendation | Up to 12 candidates | Up to 24 distinct candidates |

Pokemon `usageOptions` is optional for legacy history. Its `sourcePokemonId`, date,
month and season identify the actual aggregate. Mega candidates do not inherit
base-species item alternatives. Unknown percentages remain `null`, not zero.
Move effects come from the existing game catalog; representative and alternative
moves remain separate. These are independent usage marginals, not observed joint
sets or win-rate evidence. Prompts explicitly prohibit claims of joint frequency.

Only shortlisted Pokemon get detail lookups, deduplicated by actual usage source.
At most four lookups run concurrently, with an eight-second enrichment deadline
and caller cancellation. Failed, mismatched-date/season, or slow detail loads leave
the index data available. This is data degradation, not generated-analysis fallback.
Browser/edge usage cache namespaces advance to v2 to avoid retaining old truncation.

Sample candidates retain the actual current build, including partial investment.
Focused item/move changes do not silently change allocation or nature. Observed
point spreads can also be paired with the current nature or another observed
nature; their percentage belongs to the point distribution, not the combination.
Role-relevant tail spreads and distinct alternative moves receive reserved coverage
before repeated replacement-slot variants consume the budget. Existing legality,
duplicate-candidate, reserved-item and Mega Stone handling remains in place.

The request validator, candidate-fact schema, exact-reference completion and model
input serializer understand `usage-move`, `usage-item`, and `usage-nature`. An
alternative is not accepted as a `common-move`. Audit completion only links exact
supplied names and IDs; it does not certify or rewrite the surrounding prose.
Prompt versions: global 102, core 13, recommendation 14, optimization 36.

## Input and Runtime Checks

Four existing published-team fixtures were rebuilt against the expanded data:
Tagerau and Danjinesu Singles, Kiran and Lloyd Doubles. Each has an addition-mode
Pokemon recommendation and a selected-Pokemon sample recommendation. Korean and
English each cover both formats. Five-member recommendation requests use slot 5
as the open slot. Sample inputs retain the fixture's real/unknown point allocation.

- All four Pokemon requests had 30 candidates and 180 extra moves total, with
  measured detail data for all 30. Current upstream records offered ten moves;
  the local ceiling of twelve does not manufacture missing moves.
- All four sample requests contained 24 distinct candidates.
- Actual UTF-8 requests were 217,206-227,785 bytes for Pokemon recommendation and
  59,452-61,568 bytes for sample recommendation. Model JSON remained compacted.
- A bounded stress check using eight 500-character move effects and six
  500-character item effects per candidate reached 392,853-406,186 bytes. The
  shared Node/Worker request cap is now 512,000 bytes; structure and per-field
  limits remain enforced. Declared-length and streamed overflow are tested.
- Automated regression coverage includes independent source distributions,
  legality filtering, Mega provenance/items, missing percentages, old requests,
  malformed/oversized new fields, source deduplication, cancellation/deadline,
  low-usage role candidates, current-nature preservation, and lossless encoding.

## Luna Low Smoke Results

Evaluation key only, eight calls, no automatic retries. Existing adapter pricing
estimates are shown below, including observed prompt-cache usage. There is no
matched pre-expansion arm, so these numbers do not establish a cost or quality delta.

| Scope | Calls | Mean input tokens | Mean estimated cost | Observed duration |
| --- | ---: | ---: | ---: | ---: |
| Pokemon recommendation | 4 | 61,184 | $0.006504 | 9.7-12.9 seconds |
| Sample recommendation | 4 | 21,856 | $0.002189 | 5.9-12.5 seconds |

Total estimated cost: **$0.034769755**. Eight outputs returned structurally valid
recommendations. Raw audits were clean for 6/8; two Pokemon outputs needed the
existing exact-fact link completion, leaving no final audit errors. Public prose
was not rewritten and `proseVerified` remained false.

Manual observations:

- Kiran's Charizard selected the new current-nature Timid spread and compared it
  with Modest rather than being confined to the aggregate's leading nature.
- Tagerau's Salamence selected an added Naive spread that retained mixed offense.
- Lloyd's Milotic selected an added Calm HP/Special Attack spread, preserving its
  moves and item. However, the same paragraph then falsely says that the shortlist
  contains no HP/Special Attack spread preserving all current moves. This is an
  explicit residual prose contradiction despite correct candidate selection.
- Some Pokemon explanations still rely on abstract fit labels, and largely use
  representative moves rather than the new alternatives. More supplied choices
  do not guarantee better strategic selection or readable explanations.
- Tagerau's sample explanation also blurs which offensive option is lost between
  the standard spread and the separate Roost replacement. These wording issues
  are not solved by widening the data and must not be hidden behind a clean audit.

Raw immutable inputs, manifest, outputs, provider usage and diagnostics are in
ignored `.tmp/recommendation-expansion-2026-10-05/`; runner:
`.tmp/recommendation-expansion-qa.ts`. Historical evaluation artifacts are untouched.

## Verification

- Full Vitest suite: 1,260 tests passed across 156 files.
- ESLint, TypeScript, normal production build, Cloudflare-mode build and Wrangler
  deployment dry-run passed. Dry-run did not upload or deploy the Worker.
- `git diff --check` passed. Existing Vite large-chunk and Node experimental
  SQLite warnings remain. No browser/UI code changed in this patch.
