# M-C Sample Comparison Experiment (2026-10-04)

## Decision

Reject both tested changes. Product input remains compact v100/core12, Luna low
by default and medium optional. No second paid call, new prose validator,
fallback analysis, model option or deployment was added. The experimental
product changes and their four dedicated test cases were reverted; historical
runner, output evidence and this decision remain.

This is a negative result for these particular input/prompt variants, not proof
that all precomputed facts or all examples are harmful. Do not add more data or
instructions merely because they look helpful without checking public prose.

## Protocol

- Ten previously sourced M-C teams: five Singles and five Doubles. General
  sample optimization only, Korean, GPT-6 Luna low, 8,000 output allowance.
- Three arms, two fresh repetitions each: **60 calls**, evaluation key only,
  no SDK retries. Arm order rotates by team and repetition.
- Baseline: unchanged compact input and existing instructions.
- Comparison: add model-only `finalStatChanges` to each candidate. All six
  values are exactly `candidate.finalStats[stat] - currentBuild.finalStats[stat]`,
  including zeros. A short legend distinguishes final-stat deltas from Stat
  Points and temporary battle effects. Existing move changes are not duplicated.
- Examples: the comparison input plus two fictional, species-neutral examples:
  interpreting a physical/special defensive tradeoff with unchanged HP, and
  distinguishing move-replacement siblings. No case-specific answer is inserted.
- Both baseline and experimental messages, requests and output schema were
  frozen before calls. All arms used common prompt v100/core12; candidate
  response metadata used the experimental label 101, not a released version.
- All 60 displayed outputs were read with arm labels hidden. Notes were frozen
  before grouping. Counts are one coding agent's manual review, not independent
  expert adjudication or a natural-language automatic validator.
- The three raw/displayed differences from existing postprocessing were also
  inspected. That postprocessing was unchanged across arms.

## Results

Each error count is responses containing at least one clear factual error, not
the number of individual errors or a production-wide accuracy estimate.

| Measure | Baseline | Signed deltas | Deltas + examples |
| --- | ---: | ---: | ---: |
| Clear factual-error responses | **2/20** | **7/20** | **10/20** |
| Error responses, round 1 / round 2 | 0 / 2 | 2 / 5 | 5 / 5 |
| Including ambiguity/presentation/omission concerns | 13/20 | 13/20 | 14/20 |
| Only recommends keeping current | 2/20 | 1/20 | 3/20 |
| Mean input tokens | 16,893.4 | 17,268.7 | 17,486.7 |
| Mean output tokens, including reasoning | 778.3 | 774.05 | 792.85 |
| Mean total tokens | 17,671.7 | 18,042.75 | 18,279.55 |
| Mean estimated cost, without caching | $0.00207849 | $0.00211390 | $0.00214510 |
| Uncached cost change vs baseline | - | +1.7% | +3.2% |
| Median response time | 7.64 s | 8.33 s | 8.40 s |

Total: **1,079,880 tokens**, **$0.103804955 estimated with actual cache usage**.
These are repository-rate estimates, not reconciled invoices. All 60 responses
were renderable. A structurally valid response did not imply factual accuracy.

The broader concern counts remain high in every arm: numerical error counts
alone do not establish good strategic analysis. The baseline did not win by
only returning generic keep-current answers, but practical usefulness was a
qualitative check, not a calibrated expert strategy score.

## Remaining Errors

- The delta input still described Milotic's Defense rising from 99 to 101 as
  falling. One response inferred lower special bulk from lower Special Defense
  despite the HP increase; a stat decrease alone is not a durability result.
- Move ownership/candidate identity remained a major failure class: a Solar
  Beam candidate replacing Weather Ball was explained as replacing Hurricane;
  an Earthquake candidate removing Double-Edge was explained as removing
  Substitute; a Draco Meteor candidate was told to keep using the Dragon Pulse
  it had removed.
- Some conclusions generalized one sibling's loss to all siblings, such as all
  Recover candidates losing Protect or all Aura Sphere candidates losing priority.
- Minor numerical/count errors are included, such as calling a +2 HP change no
  increase and calling Dragon Dance plus three attacks four attacks. Even setting
  those borderline-severity cases aside does not establish a candidate advantage.

### Existing Postprocessing Follow-up

This experiment also exposed existing quality problems outside the tested input
change. They were preserved, not silently repaired during the comparison:

- `7dfe87fb`: a relevant Hurricane-in-sun accuracy paragraph became generic text.
- `caa4f4ef`: an accurate Dark Pulse replacement reason mentioning its flinch
  chance became a generic usage explanation, while an actual candidate-confusion
  error elsewhere remained visible.
- `39d40b77`: a paragraph with internal candidate identifiers was replaced, but
  `standard` / `spread-6` still leaked through titles/reasons.

The first two are concrete candidates for bounded false-positive regression
tests. Do not interpret these heuristics as general semantic verification or
expand blanket paragraph replacement to hide model mistakes.

## Limitations and Evidence

- Previously used teams, two repetitions, one effort and one language. No
  independent new-team holdout or expert review. These results do not generalize
  automatically to team, Pokemon or Pokemon-recommendation analyses.
- No examples-only arm: the examples result is conditional on the delta input.
  It does not establish the effect of examples added directly to baseline.
- Planned paid spread-variant expansion was stopped after both candidates failed.
  Deterministic tests covered mixed positive/negative/zero deltas, separate Stat
  Point changes, nonmutation, compaction and unaffected other scopes.
- Do not compare this experiment's 2/20 baseline directly with the previous
  all-scope self-review result of 10/24; case mix and fresh sampling differ.
- No statistical claim that added tokens caused the errors. The measured result
  is simply insufficient evidence to ship either candidate.

[Machine-readable evidence](evaluations/mc-comparison-2026-10-04.json) contains
all 60 raw/displayed responses, blinded review notes, usage, settings, examples,
instruction snapshots and input/message hashes. Credentials and response IDs
are excluded. Source teams remain in the published/expanded fixtures.

`scripts/run-mc-comparison-evaluation.ts` keeps immutable local baseline and
full-message manifests in `.tmp/mc-comparison`. After reverting the candidate,
prepare the frozen historical experiment without paid calls using:

```text
npx tsx scripts/run-mc-comparison-evaluation.ts --replay
```

This requires the local manifest, baseline and original request corpus; it is
not a portable reproduction from the committed evidence alone. `--run` submits
only missing result files, while existing calls are never overwritten. New
experiments need a separately captured baseline and a fresh output directory.

Verification: candidate passed 88 focused tests and all 1,220 tests, TypeScript
and ESLint. After reverting the product changes, 84 focused tests passed and
historical preparation replay succeeded. No commit, push or deployment.
