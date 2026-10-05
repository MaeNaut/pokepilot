# Recommendation Candidate Mega State Review - October 5, 2026

## Decision

Keep the missing candidate-state data fix. It supplies canonical information that
the previous request omitted; it does not establish reliable explanation accuracy.
Keep compact encoding, Luna low by default and optional medium. No deployment,
commit or push was performed for this follow-up.

## Production Change

- A base-form recommendation candidate with a compatible representative held stone
  now includes `megaEvolution`: canonical form, types, base stats and ability/effect.
- The outer form, ability choices, common set, speed category, responsibilities and
  fit remain current-form facts. Candidate ranking and the 30-candidate pool do not
  change. No invested stats are invented from incomplete candidate sets.
- The existing stone resolver distinguishes X/Y forms, rejects incompatible items,
  and does not chain an already-Mega form. The projection is recalculated on each
  request, so changing the item or losing catalog data clears stale information.
- `request.megaOptions` continues to describe actual team members, not recommended
  additions. The recommendation prompt explains activation choice, retaining the
  stone, excluding the replaced slot when comparing options, and field timing.
- Candidate audit facts distinguish `mega-ability`/`mega-type` from base
  `ability`/`type`. Exact ability-name evidence completion preserves public prose
  and does not repair incorrect base-state claims or prove natural-language timing.
- Prompt v103, recommendation v15, core v13. Other scope versions are unchanged.
  Older requests without the optional projection remain accepted. Compact encoding
  losslessly shares repeated projected ability records.

## Evaluation Design

Evaluation-key GPT-6 Luna low, 24 calls: four cases, two arms, three repetitions.
Both arms use identical **v103 instructions and output schema**. The before arm
omits candidate `megaEvolution`; the after arm includes production-built values.
This isolates the new data, not the combined v102-to-v103 release effect.

The source is the existing five-member Tagerau Singles fixture. Its Salamence
already holds Salamencite. Current candidate responsibilities are refreshed in
both arms. Three focused cases restrict recommendations to Charizard, Meowscarada
and Rotom-Wash. The fourth retains all 30 candidates.

| Case | Representative Charizard item | Supplied projection after fix |
| --- | --- | --- |
| Y | Charizardite Y | Mega Y, Drought, Fire/Flying |
| X control | Charizardite X | Mega X, Tough Claws, Fire/Dragon |
| No-stone control | Choice Scarf | None |
| Full pool | Charizardite Y | Same Y state; 30 candidates |

X and Choice Scarf are synthetic item-only controls, not attributed tournament
sets. Their retained special moves deliberately expose whether the model reasons
about a different ability/item rather than copying the Y explanation.

Raw requests, parameters and responses are frozen in
`.tmp/recommendation-mega-2026-10-05/`. The portable
[evaluation evidence](evaluations/recommendation-mega-2026-10-05.json) preserves
paired inputs, hashes, outputs, usage, diagnostics and per-output review notes.
The experiment runner is `scripts/run-recommendation-data-evaluation.ts` with
`--experiment=candidate-mega` and the frozen paired requests supplied in its output
directory. Its default request generator remains specific to the older v102 trial.

## Observations

All 24 calls returned usable structured analysis. Manual review read every output
without an AI judge. Hosted review left every public analysis unchanged.

| Observation | Without projection | With projection |
| --- | ---: | ---: |
| Mentions competing Mega choices, all outputs | 2/12 | 7/12 |
| Y focused case mentions the Mega choice | 1/3 | 3/3 |
| X focused case mentions the Mega choice | 0/3 | 3/3 |
| Explicit Drought / active Sun / one-turn Solar Beam link | 0/12 | 1/12 |
| Final structural audit failures | 1/12 | 0/12 |
| Outputs with a confirmed contradiction in limited review | 4/12 | 2/12 |

These small, correlated counts are descriptive, not general accuracy rates or
proof of a quality gain. The full-pool arms selected different candidates. Neither
X nor the no-stone controls invented Drought, but none of the X outputs discussed
Tough Claws, and none of the focused Y outputs explained the weather/Solar Beam
connection. Non-mention is not the same as an explicit false claim.

The positive connection occurred in `tagerau-full-after-r3`: Mega Y gains Drought,
and Solar Beam takes one turn while Sun remains active. It also acknowledged the
existing Salamence Mega choice. Its switch-in wording still did not explain
Drought's initial activation on Mega Evolution explicitly.

Important remaining failures:

- `charizard-y-after-r3` says Salamencite evolves Charizard into Mega Y, despite
  the correctly supplied Charizardite Y. Its structural audit passes.
- `charizard-x-control-after-r2` claims Meowscarada lacks a representative Grass
  attack, even though Flower Trick is present. Its structural audit passes.
- `charizard-y-after-r1` frames Solar Beam as an answer to Grass opponents without
  a supported matchup. Record this as weak targeting advice rather than inventing
  an explicit type-multiplier claim that the output did not make.
- X outputs leave the loss of Ground immunity and the special-set/Tough Claws
  mismatch unexplained. Merely providing the two forms is insufficient to ensure
  the model compares them correctly.
- Before-arm errors include calling base Charizard's Ground immunity a half-damage
  resistance, claiming Glimmora's existing Grass coverage is absent, and misstating
  Salamence/Swampert/Kingambit Ground matchups.

Raw audit failures were 9/12 versus 7/12. Exact evidence completion lowered these
to 1/12 versus 0/12 without changing prose. This is evidence-link coverage, **not**
correction or verification of the explanations above; `proseVerified` remains false.

## Cost And Time

Per-call means across all four variants:

| Metric | Without projection | With projection |
| --- | ---: | ---: |
| Input tokens | 19,250.50 | 19,530.25 |
| Output tokens | 1,559.75 | 1,553.67 |
| Estimated cost including observed cache behavior | $0.002201 | $0.002279 |
| No-cache equivalent cost | $0.002705 | $0.002730 |
| Wall time | 16.80 s | 16.01 s |

Input grew 1.45%; no-cache equivalent cost grew 0.92%. The full 30-candidate request
grew from 31,106 to 31,998 input tokens (+892, 2.87%). These differences exclude
the v102-to-v103 instruction/schema change because both arms use v103.

Total 24-call estimated cost: **$0.05376131**. Costs use the existing adapter's
rates, not an invoice or newly verified pricing. The first call has a cache write;
others benefited from the common prefix, so actual estimates are order-sensitive.
Timing variation in this small run does not establish a speed improvement.

## Verification And Remaining Work

- 1,283 tests across 158 files passed, including 14 added focused tests/instruction
  checks for state resolution, stale data, validation and lossless encoding.
- Lint and Cloudflare build passed. The build retains its existing large-chunk
  warning. No paid production-key calls were made.
- No live Doubles, replacement or other-species Mega trial was included. Unit
  checks exercise input contracts but cannot establish explanation accuracy.
- The next quality step should test explicit derived mechanic links and state
  comparisons, not repeatedly add general prose instructions. Team terrain/move
  interactions remain a separate task. Do not silently repair generated prose or
  present a structural pass as a factual guarantee.
