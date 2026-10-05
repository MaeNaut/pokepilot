# M-C Same-Call Self-Review Experiment (2026-10-04)

## Decision

Do not adopt the candidate review instruction. Retain compact prompt v100,
core v12, Luna low by default and optional medium. No new natural-language
validator, second paid repair call, fallback analysis, model option, or
deployment was added.

The baseline already asks for a final literal-claim check. This experiment
tests a more explicit rewrite of that instruction, **not self-review versus
no self-review**. It does not show that all self-review prompting is useless.
It shows no overall improvement from this particular rewrite in this sample.

## Controlled Setup

- GPT-6 Luna, low effort, compact input, 8,000 output-token allowance, no SDK
  retries. Twelve difficult Korean cases from eight previously sourced M-C
  teams, covering team, Pokemon, Pokemon recommendation and sample optimization.
- Two fresh runs per case and prompt: 48 paid calls using the evaluation key.
  Request facts, scope/locale instructions, output schema, effort and output
  allowance are identical. All 48 responses were renderable.
- The existing review sentence was replaced with an explicit check of proposed
  paragraphs and recommendation titles/reasons against input: move owners,
  lineups, current/Mega state, targets/triggers, numeric change direction and
  contradictions. The candidate also forbids drafts/review notes in the result.
  Every existing game-specific instruction following that sentence was retained.
- Candidate label v101/core13 was used only for this local experiment and was
  reverted after review. The complete before/after instruction texts are frozen
  in the machine-readable artifact's manifest.
- Public responses were reviewed with prompt-arm labels hidden behind hashed
  identifiers. Notes were frozen before aggregate results were unblinded.
  This is one coding agent's review, not independent expert adjudication.
  Existing post-processing was unchanged; raw and displayed prose are preserved.

## Results

Each quality count is the number of **responses with at least one identified
clear factual error**, not the number of individual claims or a production
accuracy estimate. Ambiguous wording and presentation defects are separate.

| Scope | Baseline v100 | Explicit review candidate |
| --- | ---: | ---: |
| Team | 4/6 | 2/6 |
| Pokemon | 0/6 | 1/6 |
| Pokemon recommendation | 3/6 | 4/6 |
| Sample optimization | 3/6 | 3/6 |
| Total | **10/24** | **10/24** |

Round one/two error-response counts were **5/5** for the baseline and **6/4**
for the candidate. Including ambiguous prose and presentation defects changes
the broad concern counts to **12/24 versus 15/24**, not a candidate advantage.
Team improvement alone is insufficient to justify a scope-specific rollout
based on six responses per arm and a post-hoc subgroup choice.

| Per-call measure | Baseline | Candidate | Change |
| --- | ---: | ---: | ---: |
| Mean input tokens | 18,201.17 | 18,258.17 | +57 (+0.31%) |
| Mean output tokens, including reasoning | 1,470.42 | 1,455.58 | -1.01% |
| Mean reasoning tokens (part of output) | 298.21 | 328.63 | +10.20% |
| Mean total tokens | 19,671.58 | 19,713.75 | +0.21% |
| Estimated cost without caching | $0.00255533 | $0.00255361 | -0.07% |
| Estimated cost with observed cache usage | $0.00216215 | $0.00215557 | -0.30% |
| Median response time | 12.689 s | 12.468 s | -1.74% |

The tiny cost/time differences are descriptive, not evidence of a reliable
speed or cost improvement. The extra instruction did not produce a second API
call, and additional reasoning tokens do not prove a separate internal review
actually occurred. Cache-normalized estimates use the repository's standard
Luna rates of $0.10/M input and $0.50/M output for this input size.

Total: **945,248 tokens**, **$0.103625355 estimated with observed cache usage**,
or **$0.1226144 without caching**. These are estimates, not reconciled invoices.

## What Still Failed

- The candidate still used unselected Archaludon/Golisopod in the named
  Floette/Pelipper/Basculegion trio, despite explicitly checking lineups.
- It called Rotom-Wash's Volt Switch Flip Turn and attributed Expanding Force
  to an Indeedee-Female candidate that actually has Psychic.
- It still described Milotic's Defense rising from 99 to 101 as a decrease.
- It named Gengarite rather than Shed Shell as a Shadow Tag escape item. Another
  response exposed an awkward item-name correction fragment instead of clean
  final prose; one recommendation leaked the internal `commonSet` label.
- The baseline had its own major errors: Aerilate/Hyper Voice denial, invented
  sand immunity, wrong stat allocation, and Solar Beam candidate-slot confusion.
  The candidate fixing some of these while introducing others is not a general
  quality win.
- All four Wish responses omitted the healing amount's user-max-HP basis.
  Absence of an explicit error is not proof of complete understanding. Several
  recommendation responses also treated Trick Room as an established friendly
  mode without resolving the roster's fast attackers.

Future work should target a demonstrated failure class, such as candidate
identity/current-versus-alternative comparison, rather than adding another
generic review sentence or treating private-audit success as prose accuracy.

## Evidence and Reproduction

- [Machine-readable results](evaluations/mc-self-review-2026-10-04.json): all
  48 raw/displayed analyses, usage, input/message hashes, frozen instruction
  texts, manual findings and limitations. No credentials or response IDs.
- `scripts/run-mc-self-review-evaluation.ts`: fixed-input comparison with
  alternating arm order, explicit `--run` gating, immutable manifests and
  preservation of existing result files.
- Source corpus: local `.tmp/mc-final/requests-v99.json`, checked against saved
  hashes. Source team provenance remains in the earlier published/expanded
  reports and fixtures. The corpus must exist to replay the saved comparison.

Prepare a historical replay without paid calls:

```text
npx tsx scripts/run-mc-self-review-evaluation.ts --comparison=docs/evaluations/mc-self-review-2026-10-04.json --output=.tmp/mc-self-review-independent
```

Adding `--run` performs 48 new paid calls. Use a fresh output directory for an
independent run. The script refuses changed historical requests/messages or
manifest changes, so later prompt/input edits cannot silently mix evaluations.

For a new prompt experiment, use `--capture-baseline` in a fresh directory
before modifying the prompt, then prepare/run without `--comparison`.

Limitations: intentionally difficult reused cases, two samples per prompt/case,
Korean only, no calculator matchup scope, no independent reviewer, and no
statistical proof of equivalence. The prior encoding experiment used a 16,000
output cap and different encoding legends; compare the fresh paired arms here,
not their raw counts directly with that earlier experiment.

Verification: 48/48 calls and manual reviews complete; input/message hashes
match; historical preparation replay succeeds after restoring v100. The
candidate passed 84 focused tests, the full 1,216-test suite, TypeScript and
ESLint checks. After restoring v100, focused checks were rerun. No deployment.
