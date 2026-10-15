# Speed Evidence Review - October 15, 2026

## Decision

Retain the verified item-Speed arithmetic fixes and share their implementation
between input tactics and private audit validation. **Do not promote the extra
model-bound Speed table.** The trial passed its necessary nonregression guard,
but did not demonstrate a meaningful quality benefit worth the extra runtime
code and input. Its runtime module, dedicated tests and encoding instructions
were removed rather than left as unused code.

Final prompt metadata is **v114/core 13**. Common/scope/locale instruction prose,
uniform owner-bound encoding, schemas, model and reasoning remain unchanged.
The paid candidate really used v113; results are not relabeled as v114.

## Retained Fixes

`src/utils/copilotSpeed.ts` replaces duplicated item-modifier parsing and
comparison arithmetic in tactics and strategy-audit validation. Use the existing
`@smogon/calc` engine's `pokeRound` convention, not fractional Speed comparisons.

- Speed 155 with Choice Scarf compares as **232**, not 232.5. It ties a supplied
  Speed 232 rather than incorrectly receiving a faster-than relationship.
- Speed 143 with Iron Ball compares as **71**, not 71.5.
- Missing stats no longer manufacture Speed zero in the team's ordering map.
  Audit validation continues to reject comparisons requiring missing stats.
- Preserve canonical ID normalization and Unicode multiplication/apostrophes.
  A description starting with a condition is not promoted to an unconditional
  numeric modifier. This remains a bounded canonical-description reader, not a
  general natural-language battle-effect parser.

These changes fix reproducible arithmetic/grounding bugs. They do not establish
that a model will obey the corrected facts in every public sentence. Comparisons
remain current-state, active-item-only: they do not incorporate ability
suppression, status, stages, priority, Trick Room or weather-dependent abilities.

## Rejected Input Trial

The candidate added per-owner current and projected-Mega `speedEvidence`:
pre-item stat, item multiplier, rounded item-adjusted value, and explicitly
hypothetical Tailwind/weather/terrain values. Conditional calculations used
Champions generation 0 in `@smogon/calc`, including combined-modifier rounding:
155 with Scarf and Tailwind is 465, not twice the already-rounded 232.

Only five supplied abilities had condition mappings: Chlorophyll, Swift Swim,
Sand Rush, Slush Rush and Surge Surfer. A short encoding legend separated these
assumptions from actual fields and move order. No extra strategy rules, semantic
rewrites, fallback, new model or response schema were introduced.

Reuse thirty exact baseline outputs from the October 14 unified-layout trial
(observed prompt v110, byte-identical encoding/instructions to the selected-
Pokemon path at v112). Six frozen public-team selected-Pokemon cases each receive
five new candidate calls: **30 new GPT-6 Luna low evaluation-key calls**.
Cases are Archaludon, Hisuian Zoroark, Pelipper, Charizard, Staraptor and Vivillon.
All six are English; this trial does not measure Korean localization quality.

Before calling the candidate, record the necessary guard: Speed-error responses
and all factual-error responses must not increase; no two cases may each lose
at least two core explanations. Passing that guard is not sufficient proof of
value. The arithmetic fix can be retained independently of the input trial.

All paragraphs and recommendation titles/reasons were manually reviewed, with
Speed errors, other factual errors, omissions and ambiguous wording kept
separate. Speed errors include false numeric/item comparisons and ordering
switch-entry weather by move Speed. Impossible active lineups with otherwise
correct numeric comparisons count as other errors. Both arms were reaudited
with the same current validator. No paid AI judge was used.

| Measure | Reused baseline | Extra Speed table |
| --- | ---: | ---: |
| Renderable responses | 30/30 | 30/30 |
| Responses with Speed errors | 2/30 | 2/30 |
| Responses with any confirmed factual error | 5/30 | 4/30 |
| Responses with wording/omission concerns | 15/30 | 19/30 |
| Sufficient case-specific core explanations | 22/30 | 21/30 |
| Raw/final audit-flagged responses | 3/30 | 3/30 |
| Input tokens | 417,550 | 427,080 |
| Output tokens | 35,122 | 34,968 |
| Estimated billed cost | $0.0463038 | $0.047909475 |
| Median duration | 13.277 s | 17.880 s |

New cost is **$0.047909475**, not the sum of both arms: the baseline was reused.
Estimates use the application usage calculator, not reconciled invoices. Input
grew 2.28% and estimated cost 3.47%; observed median duration increased 34.67%.
Historical baseline reuse, stochastic generation, cache differences and
nonblinded review prevent a causal latency or accuracy claim.

The candidate correctly named Scarf-adjusted 232 in all five Zoroark and all
five Vivillon outputs. Two Staraptor outputs explicitly distinguished current
and Mega Tailwind values. One Charizard output explained Venusaur's Chlorophyll
payoff; none of the matched baseline Charizard outputs did. These are useful
details, not an overall quality win.

Counterexamples remain: Archaludon outputs introduce a contradictory 108/76
comparison, impossible Singles ally actions, switch-entry timing based on move
Speed and nonexistent Special Attack investment. One Zoroark output invents
Normal typing/STAB for Gardevoir. Its full Illusion/Pixilate explanation falls
from 3/5 to 2/5, while generic Vivillon support still fails to explain an allied
setup turn. There is insufficient benefit to promote the extra table.

## Verification

The evidence ledger verifies request recovery after removing derived metadata,
identical matched SDK parameters and instruction prose outside the encoding
message, matching provider payload hashes, and final serializer restoration to
the baseline for all six frozen inputs. Original provider outputs are preserved.

Final checks: lint, **1,427 tests / 165 files**, TypeScript, Vite and Cloudflare
Worker dry-run. Existing large-chunk/experimental SQLite warnings remain.
No commit, push or deployment; no production-key calls or private user teams.

[Machine-readable evidence](evaluations/speed-evidence-2026-10-15.json).
Raw transcripts, frozen encoders and protocol remain local and ignored under
`.tmp/speed-evidence-2026-10-15/`; the ledger alone is not a self-contained replay.
