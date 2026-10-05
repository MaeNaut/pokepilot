# Selective Pokemon Recommendation Input

Date: October 5, 2026. Working-tree implementation; no commit, push or deployment.

## Decision

Keep the 30-candidate shortlist and each representative set. Do not roll back
upstream usage collection or the expanded 24-candidate general sample pool.
At the Pokemon recommendation request boundary, send only a small selection of
the observed alternatives instead of every collected move, item, nature and spread.
Luna low remains the default, medium remains optional, and compact encoding and
prompt v102/core v13/recommendation v14 are unchanged. No Sol calls were made.

`copilotRecommendationUsageSelection.ts` is called after candidate localization:

- Retain at most three extra moves that add a missing support responsibility or
  super-effective type coverage beyond the remaining team and representative set.
- Prefer missing responsibilities, then new type coverage, then observed usage.
  Update covered roles/types after each choice to avoid padding with duplicates.
- Exclude ally-only support roles in Singles. This is a relevance heuristic,
  not a matchup calculation or a guarantee that a move is strategically optimal.
- Retain at most two observed item alternatives only when the representative item
  is absent or already held by a remaining teammate. Exclude occupied/duplicate
  items; do not replace a required Mega Stone through this enrichment.
- Exclude the outgoing member when evaluating replacement candidates.
- Omit alternate natures and point distributions from this Pokemon payload;
  detailed set comparison remains in sample recommendation. Preserve provenance
  for retained extras and omit completely empty enrichment.

The original candidate data is not mutated. Candidate order, representative set,
fit data and count are unchanged. Existing optional-field validation, historical
requests and the lossless serializer remain compatible. Matchup-scope replacement
payloads are outside this change. Item marginals are not asserted joint movesets.

## Controlled Trial

Evaluation key only; four frozen five-member addition requests, before/after,
three repetitions each: Tagerau and Danjinesu Singles, Kiran and Lloyd Doubles.
Only the candidate enrichment changes between arms. The source, shortlist,
language, prompt, model, reasoning, output cap and no-retry policy are identical.

| Mean per call, 12 calls each | Full enrichment | Selective enrichment |
| --- | ---: | ---: |
| Input tokens | 61,208.5 | 31,686.8 |
| Output tokens, including billed reasoning | 1,395.6 | 1,470.3 |
| Estimated cost with observed cache | $0.006336 | $0.003472 |
| No-cache equivalent cost | $0.006819 | $0.003904 |
| Observed duration | 12.50 s | 12.75 s |

Input decreased **48.2%** and no-cache equivalent cost decreased **42.7%**.
There was no observed latency improvement. Per-team extra moves fell from 180
to 31-48 and extra items from 165-169 to 10-18 across all 30 candidates.
This remains modest enrichment, not removal of the representative four moves.

All 24 calls returned structured analyses. Raw audit errors appeared in 11/12
full and 8/12 selective outputs; exact-reference completion left one final audit
failure in each arm. Explicit alternative-usage facts appeared in 1/12 full and
0/12 selective outputs. Absence of these facts does not prove the input was ignored.
Neither audit passes nor cost reduction establish equivalent or better accuracy.

## Manual Review and Limits

Every output was read, with selected-set/ability/type claims checked against the
frozen data. Confirmed problems and ambiguous wording are recorded separately.
Examples include Meowscarada incorrectly described as Grass-weak in a full-input
output and existing Encore overlooked when describing Tinkaton's contribution.
The selective outputs still omit important conditions, such as the Grassy
Terrain/Earthquake tradeoff and a base Charizard candidate's Mega/Drought branch.

One selective Kiran output denied Indeedee Female's priority protection. The
frozen candidate roles predated the already implemented Psychic Surge mapping;
both arms retained that old omission. A separate six-call Kiran follow-up refreshed
both candidate role lists using current production inference, with no prompt or
other facts changed. That absence claim did not recur, but other errors remained:
Rock Head/recoil and Pelipper's Water matchup in full-input prose, and calling the
sixth open position the fifth position in one selective output. This small follow-up
does not prove the role fix eliminates all errors or that selection improves accuracy.

There was no live full-roster replacement trial; replacement-slot exclusion has
deterministic tests. Some public fixtures have unpublished allocations. The result
supports reducing excessive input, not declaring recommendation quality solved.

## Evidence and Verification

- Main comparison: 24 calls, estimated $0.117698375.
- Current-role follow-up: 6 calls, estimated $0.030447400.
- Total: **30 calls, estimated $0.148145775**, using existing adapter rates rather
  than a newly verified provider price or invoice.
- [Immutable result artifact](evaluations/recommendation-selective-2026-10-05.json)
  retains raw analyses/audits, usage, hashes, selected canonical candidates and
  per-output review notes. Original before/after results were not replaced.
- Full requests/provider parameters/source snapshot are frozen locally under
  `.tmp/recommendation-selective-ab-2026-10-05/` and
  `.tmp/recommendation-selective-current-roles-2026-10-05/`.
- Focused tests: 37 passed. Full suite: **1,269 passed across 157 files**.
- ESLint and Cloudflare TypeScript/Vite build passed. Existing large-chunk and
  experimental SQLite warnings remain unrelated to this change.
