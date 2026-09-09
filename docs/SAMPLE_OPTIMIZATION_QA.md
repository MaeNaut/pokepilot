# Sample Optimization QA

Date: 2026-09-07. Product revision: `d6f13ac`.

## Result

On-demand execution and deployed UI checks passed at `d6f13ac`. The speed-only
selection defect found during QA is fixed in the working tree (see follow-up
below). Browser measurements in this report describe the deployed revision,
not the uncommitted fix.

## Coverage

- Existing suite: 480 tests passed; lint and production build passed.
- Offline matrix: 11 scenarios, each evaluated in both calculator directions
  (22 runs, 62 returned candidates including two instances of the known defect).
- Scenarios: Tyranitar/Gholdengo with and without Life Orb; Farigiraf/Scizor;
  Scrafty/Kingambit; Gholdengo/Garchomp and the reverse; Rotom-Wash/Garchomp;
  Corviknight/Kingambit; Incineroar/Scizor; Primarina/Tyranitar; and the
  Weavile/Gholdengo speed-only negative control below.
- All runs used doubles. Candidates stayed within 66 total points and 32 per stat.
- Existing probability, Body Press, Psyshock, Foul Play, usage-move, HP-first,
  maximum-bulk, and survival-with-reserve regressions passed.
- The Tyranitar regression confirms D30 -> D26 with unchanged 84-102 Make It Rain
  damage; D25 reopens a two-hit KO chance. Opponent is itemless Timid C32
  Gholdengo, with sand and spread damage enabled.

## Deployed Browser Checks

URL: https://pokepilot-ai.vercel.app. Isolated Chrome profiles, English UI.

| Width | Twelve calculator EV changes | Automatic searches | Horizontal overflow |
| --- | ---: | ---: | --- |
| 1600 | 51 ms | 0 | No visible issue in desktop flow |
| 820 | 50 ms | 0 | 0 px |
| 390 | 56 ms | 0 | 0 px |
| 360 | 63 ms | 0 | 0 px |

Timings include automation overhead and are single-run observations, not FPS or
physical-device guarantees. Small layouts used touch-capable Chrome emulation;
EV increments used keyboard events. Real Android touch-drag and virtual-keyboard
latency remain a manual verification item.

Verified: opponent selection (including touch dialogs), calculator tabs,
team-builder switching, no worker before clicking Optimize Set, one worker after
clicking, no hosted request for an empty plan, and seven computed candidates in
the outgoing request for a nonempty plan. No JavaScript page errors occurred.
Hosted requests were intercepted with a simulated 503: no paid AI calls were
made, and fallback rendering was checked. This does not evaluate hosted prose,
production OpenAI/Redis availability, or success-response quality.

## Speed Direction Defect Found During QA

Reproduction: Jolly Weavile H2/A32/S32 with Fake Out, versus Timid Gholdengo
H2/C32/S32 with Protect, no items, neutral field, doubles. This intentionally
minimal negative control supplies no damaging interaction: Fake Out cannot hit
Ghost, and Protect deals no damage.

Actual candidate: `set-relaxed-32-0-32-0-2-0`. Weavile changes from 194 Speed
(faster than 149) to 130 (slower), with no offensive or defensive benefit.

`candidateSelection.ts` accepts any speed-relation change as meaningful and
awards it 12 points. `seeds.ts` also generates slow-mode seeds without an explicit
Trick Room objective. A slower relation alone must not count as an improvement.
Mixed candidates may still deliberately trade speed for a verified damage or
survival gain; the fix should not prohibit all slow natures.

Initially tracked as an expected failure in
`src/calculator/setOptimizer.qa.test.ts`; now a normal passing regression test.

## Local Fix Verification

- Speed-only candidates now require a better order: slower -> tie/faster or
  tie -> faster. Losing order no longer qualifies as an improvement by itself.
- Ranking adds 12 points for gaining order and subtracts 12 for losing it;
  unchanged relative order adds nothing. This retains the existing weight.
- Slow seeds remain available for combinations with verified damage or survival
  gains. No species-specific exception or assumed Trick Room objective was added.
- Unit tests cover all six directional transitions, both selection stages,
  mixed offense/defense tradeoffs, and preference for retaining speed when the
  other benefits are equal.
- Full local check: 489 tests passed; lint and production build passed. The
  existing large-chunk build warning remains.
- Repeated all 22 offline plans: 60 candidates, no invalid point allocations,
  and no candidates without a measured gain under the QA comparisons. Both
  Weavile negative-control directions now return no candidates instead of one.
- Existing Tyranitar D26, Farigiraf maximum/reserve bulk, probability, and
  move-mechanics regressions remain passing. No paid API calls were needed.
- The fix has not been pushed or verified on the production deployment yet.

## Superseded: Hard Role Preservation

This intermediate policy was rejected because usage-loaded spreads are not
user-locked intent. The soft-tradeoff policy below replaces it.

The speed-direction fix alone still allowed losing an attacker's broader role
in exchange for a local survival gain. Candidate preparation now preserves the
current final Attack, Special Attack, and Speed wherever the starting set has
positive investment. These are conservative build constraints, not inferred
species roles. A nature change may free points only if the original final stat
is retained. A zero-investment, Speed-lowering nature also keeps its slow Speed.

- Constraints are applied before evaluation, frontier pruning, and final
  selection, including combined seeds. Remaining points are rebuilt around
  those constraints; all displayed benchmarks are calculated on the new spread.
- Uninvested offense stays eligible for minimum-breakpoint tuning, so support
  sets are not forced to become attackers. Existing investments are not assumed
  redundant merely because the exact foe's KO tier stays the same.
- Fully invested attackers may now have no recommended adjustment. This is an
  intentional refusal to redesign their role, not a claim that no other set
  could win the matchup. Explicit role-changing optimization is not implemented.
- Maximum-bulk endpoints are retained through generation and coarse outcome
  deduplication, keeping the maximum/reserve alternatives available to suitable
  bulk-oriented sets.
- Optimization prompt v17 (overall v60) asks the AI to infer responsibilities
  from the actual set and team, distinguish role preservation from local gains,
  and avoid unsupported usage claims. The common prompt remains v3; other scope
  prompts are unchanged. No usage dataset or additional AI call was added.
- Local verification: 495 tests, lint, and production build passed. The 22-plan
  matrix now returns 24 candidates, with zero point-allocation violations,
  zero missing-gain flags, and zero violations of the invested-stat/slow-Speed
  constraints. The previous 60-candidate count belongs to the speed-only fix.
- Regressions cover invested physical/special/mixed sets, minimum-Speed intent,
  nature-based point savings, uninvested support sets, and Weavile with both
  an inert and a damaging matchup in both calculator directions. A partially
  invested attacker still produces candidates while retaining its Attack.
- Old tests requiring A32 -> A0 have been replaced with separate role-preserving
  and uninvested-support cases. The Tyranitar D26 boundary still passes for a
  deliberately bulk-oriented set; it is no longer a default replacement for HA.
- Tests do not assess live model prose quality. No paid API calls were made,
  and these changes have not been pushed or tested on the deployed site.

## Current Policy: Tradeoffs And Retaining The Starting Sample

- No stat floor is mandatory. Raw boundary seeds, minimum-investment variants,
  and role-preserving variants are evaluated together. Current investment is a
  reference, not an immutable choice by the user.
- Search ranking charges a soft heuristic cost for losing invested Attack,
  Special Attack, or Speed, with a nonlinear cost for removing a large portion
  of that investment. The cost is an internal selection heuristic, not a game
  fact or user-facing score. A real damage/survival gain can justify a modest
  reduction. No-gain candidates still fail the existing meaningful-change gate.
- A complete current spread can enter the pool as `set-current` if it has useful
  calculated offense or survival and no supplied adjustment clearly improves
  it without measured tradeoffs. This does not certify its metagame quality.
  Inert negative controls and incomplete allocations do not get filler cards.
- The AI can select the current sample alone or alongside targeted adjustments.
  Optimization scope v18 / overall prompt v61 explicitly distinguishes a
  usage-loaded baseline from user intent and asks for a reason to retain it.
  Other scope prefixes and the common prefix remain unchanged.
- The current card displays nature, item, points, and rationale; comparisons and
  Apply Sample are omitted. Save to Bench remains. Stale results say Sample at
  analysis rather than claiming they are still current. The local fallback also
  explains a supplied move-level reason to retain the set.
- The same single analysis request is used; role-cost metadata is not sent to
  the API. A valid current-only plan now permits analysis instead of showing
  the previous empty-plan notice. No live paid calls were used in this QA.
- Automated coverage: 503 tests plus lint/build passed. Tests cover soft costs,
  meaningful tradeoffs, current-only,
  no-filler cases, and current-card rendering. Tyranitar versus itemless
  Gholdengo produces both HA32 and reduced-A variants (including Brave A26/D8),
  without removing Attack investment entirely in that regression.
- Isolated Chrome at 1600, 820, and 390 px verified the real worker -> request ->
  mocked-503 fallback -> current-card flow. No page errors or horizontal overflow;
  no Apply button or comparison disclosure on the current card. Screenshots were
  inspected after the result animation. This does not measure live AI prose.
- The 22-plan matrix includes both retained and adjusted candidates now. Its old
  roleLoss counter indicates a tradeoff, not an error; current cards deliberately
  have no improvement and must not be counted as failed adjustments.

## Live Model QA: Prompt v61

Date: 2026-09-07. Six paid evaluation requests used the existing evaluation key,
Luna standard/default tier, low reasoning, and the real request builder. Four
controlled doubles cases were run, with Tyranitar and Weavile repeated once.
These are constructed matchup fixtures using the local calc species/move data,
not the user's saved teams. Tyranitar and Scrafty include small Trick Room cores;
Weavile and Farigiraf are isolated set tests. Legality snapshot was unavailable
and was represented as such rather than fabricated as valid. No usage fetch,
production Redis, or browser/API transport was tested in this live-model run.

Verdict: deterministic candidates improved, but live explanation quality is not
ready for sign-off. No product fixes were made during this QA.

### Findings

1. Repeated reversed defensive interpretation (Tyranitar, 2/2 responses).
   The Sassy H32/A21/D13 option reduces Shadow Ball damage from 23-27 to 19-23;
   raw hit-count bounds improve from 8-9 to 9-11. The model instead says Shadow
   Ball protection gets worse. This incorrect qualitative claim survives
   `validateHostedCopilotAnalysis` and its narrative sanitizer. Candidate
   selection itself is plausible: both responses keep HA32 as an alternative,
   and the second includes a smaller Brave A27/B3/D4 adjustment.
2. Current-only response instability (Weavile, 1/2 responses).
   Both responses endorse the existing Jolly H2/A32/S32 set, but the first returns
   an empty recommendations array. The evaluation adapter's basic validation
   accepts it; replaying the production validator correctly raises
   `AI_INVALID_RESPONSE`. In the app this means failure/fallback, not a successful
   hosted result with a missing card. The second returns `set-current` correctly.
3. Narrative deletion can remove the reason for the recommendation.
   The model frequently repeats KO classifications despite the prompt rule.
   Production sanitization removes matching sentences rather than fixing them.
   Scrafty's opening becomes a dangling conclusion, and its attacking-option
   reason retains the costs but loses the Drain Punch benefit. Tyranitar's first
   raw response also calls the current Make It Rain result a guaranteed three-hit
   result even though the supplied two-hit KO probability is 98.05%; that
   numeric sentence is removed before display. Raw and displayed responses must
   be evaluated separately.

### Positive Cases

- Farigiraf: selected Relaxed H32/B32/D2 and Relaxed H32/B9/D25, keeping zero
  Speed and explaining maximum physical bulk versus reserve special bulk.
  B9 receives 188-224 Bug Bite damage at 227 HP; reducing to B8 while moving the
  point to D gives 192-228 and a 6.25% OHKO chance. The minimum-survival boundary
  is meaningful, not arbitrary leftover investment.
- Scrafty: selected Impish H32/B32/D2, conditional Adamant H32/A30/D4 for a
  Drain Punch probability gain, and the current Careful H32/B2/D32. This is not
  pointless Attack investment justified only by unchanged Close Combat damage.
  It is a conditional role change, and its presentation still needs the narrative
  issue above fixed. One run is not evidence of broad stability.
- All candidate benchmark values in all six request records were recalculated
  with the engine: zero mismatches. All six requests passed request validation.
  After replaying production response validation, five responses were accepted
  and one rejected. Acceptance does not imply strategic correctness.

### Usage

| Case | Calls | Latency | Estimated USD |
| --- | ---: | --- | ---: |
| Tyranitar | 2 | 10.981 / 11.368 s | 0.00748154 |
| Weavile | 2 | 6.298 / 5.821 s | 0.00197368 |
| Scrafty | 1 | 12.173 s | 0.00312304 |
| Farigiraf | 1 | 7.266 s | 0.00159884 |
| Total | 6 | mean 8.985 s | 0.01417710 |

API-reported tokens: input 66,517 (cached read 19,510; cache write 3,902), output
3,492 (including 746 reasoning tokens), total 70,009. Costs are calculated using
the repository's standard pricing table, not reconciled billing amounts.
No hidden retries were enabled. Raw requests/responses are in ignored
`.tmp/sample-live-<case>-<run>.json`; the live script skips existing results to
avoid accidental repeat charges. The replay script applies the production
validator without further API calls.

Next priorities: enforce the current-only response contract in model evaluation,
ground qualitative defensive comparisons, and preserve coherent reasoning when
removing repeated numeric outcomes. Do not change model/reasoning level based on
this small six-call sample alone.

## Follow-Up QA: Prompt v62

### Changes And Scope

- Optimization instructions v19 explicitly require a recommendation card even
  when `set-current` is the sole candidate. An empty list is still rejected, not
  silently converted into a model-authored success.
- Clarified incoming versus outgoing damage and the distinction between a
  practical KO comparison of `same` and a raw incoming damage reduction.
  No species-specific exception or additional paid model pass was added.
- The evaluation adapter now applies the production response validator and
  narrative sanitizer, preserving the raw structured response in `debugOutput`.
  Previously a missing recommendation could pass evaluation but fail hosting.
- Numeric-outcome sanitation replaces an affected block in full. Affected card
  reasons use verified outcome improvements/regressions and actual final-stat
  reductions, rather than leaving a drawback after deleting its benefit.
  Unaffected qualitative prose remains untouched. This is a presentation
  fallback, not proof that arbitrary model prose is factually correct.
- Common prompt v3, response schema, standard service and low reasoning remain
  unchanged. Only optimization guidance/version changed, preserving the common
  prefix design. Each request grew by 199 input tokens in this batch.

### Results

Repeated the same four controlled fixtures: Tyranitar and Weavile twice each,
Scrafty and Farigiraf once each. All six production validations passed; all
candidate benchmarks recalculated without mismatch. This was direct API and
production-validator QA, not a newly deployed browser/Redis end-to-end test.

- Weavile returned `set-current` both times, retaining its Jolly Attack/Speed
  investment. The earlier empty-card failure was not reproduced (two trials,
  not a reliability guarantee).
- Tyranitar returned its existing Attack-max set alongside modest-investment
  and more defensive adjustments. The previous reversed Shadow Ball comparison
  was not reproduced in either raw response. Candidate ordering varied.
- Scrafty retained the original special-bulk support set and maximum physical
  bulk as alternatives to a conditional Drain Punch damage-probability option.
  The latter was ranked first in this run; this is a matchup-specialized role
  tradeoff, not a demonstrated upgrade for its wider support responsibilities.
- Farigiraf selected Relaxed H32/B32/D2 and H32/B9/D25 together. Reducing the
  latter to B8 restores a 6.25% Bug Bite OHKO chance, confirming its minimum
  survival boundary. Both retained the slow Trick Room relationship.

Remaining presentation limits: all three Korean responses required opening
paragraph replacement, and six of their nine card reasons were replaced because
the model repeated numerical outcomes. This prevents orphan explanations but
loses some strategic nuance. One title also repeated the complete spread;
phrasing such as "same guaranteed result" or an awkward KO-probability term
still needs polish. Do not describe this batch as flawless prose or universal
strategic correctness. No semantic validator for all free-text comparisons was
introduced; the defensive-direction improvement is prompt-level evidence only.

### Cost And Verification

| Case | Calls | Latency | Estimated USD |
| --- | ---: | --- | ---: |
| Tyranitar | 2 | 12.194 / 10.992 s | 0.00716593 |
| Weavile | 2 | 5.162 / 5.828 s | 0.00205244 |
| Scrafty | 1 | 16.885 s | 0.00335382 |
| Farigiraf | 1 | 15.557 s | 0.00164482 |
| Total | 6 | mean 11.103 s | 0.01421701 |

Input 67,711 (cached read 22,523; cache write 2,083); output 3,854 including 974
reasoning tokens; total 71,565. Repository-priced cost is approximately unchanged
from v61's $0.01417710; latency increased in this small batch, which does not
isolate model variability from the prompt change. No automatic retries.

`npm run check`: lint, 506 tests across 73 files, TypeScript and production build
passed. The existing large-chunk warning remains. Ignored evidence is stored as
`.tmp/sample-live-v62-<case>-<run>.json` and can be replayed without paid calls via
`node --import tsx .tmp/qa-sample-verification.mjs --label=v62`.

## Interpretation Notes

- Moving a spare point from reserve bulk without changing this matchup is not
  itself a defect. The feature intentionally allocates leftover points to the
  other defense after meeting a survival target.
- The `speed-adjustment` profile also appears when the Speed value changes but
  the relative order does not. This describes a change, not necessarily a gain;
  explanations should not imply a new outspeed breakpoint from that tag alone.
- Initial QA only added this report and the reproduction test. The follow-up
  modifies candidate selection and adds passing regression coverage.

## Saved-Team Browser Follow-Up

Chrome QA used the saved `Coach Scrafty` team rather than the controlled fixture.
For Tyranitar versus Life Orb Gholdengo, Sand was selected automatically and the
optimizer supplied only `set-current`. The hosted Korean result retained Brave
H32/A32/B1/D1 and explained that the current offense, bulk, and Trick Room Speed
direction had no verified no-loss replacement in this exact matchup.

The first saved-team Scrafty versus Roseli Berry Kingambit request fell back with
`AI_INVALID_RESPONSE`. Candidate generation remained available and the fallback
showed the current Sassy H32/B2/D32 set plus Brave and Relaxed alternatives. A
direct reproduction with the same Scrafty and Kingambit sets passed production
validation, selected maximum physical bulk and `set-current`, and cost $0.00272742
by the repository pricing table. This means the failure was intermittent rather
than a deterministic candidate or request-contract error.

Optimization does not use the private team-strategy audit, but a model-authored
entry there could invalidate an otherwise usable optimization response. The
server now normalizes that unused audit to empty before validation. Candidate ID,
scope, response shape, and recommendation-count validation remain enforced. This
hardens the identified intermittent path; because the failed browser response's
private raw output was not exposed, it is not proof that every possible invalid
response now recovers. Regression status after the change: 507 tests across 73
files, lint, TypeScript, and production build passed. The existing large-chunk
warning is unchanged.

## Lossless Model Input Sharing (Prompt v73)

The server now shares exact repeated records at the OpenAI boundary. The full
browser request, candidate list, calculations, and validation contract are
unchanged. Damage outcomes, Speed states, move/ability descriptions, and defensive
profiles use a flat shared-record table only when the text savings exceed the
reference and explanation overhead. Expansion is tested against the full original
request, including different current HP, KO probability, move replacements, owners,
and current/Mega immunity states. No calculations are delegated to the model.

The common and scope prompt text remains byte-identical to v72. The short reference
explanation follows both cache breakpoints, so existing core/scope caches remain
reusable. The global response version advances to isolate Redis results.

Same-request token counts, including developer messages and output schema, were
measured with the API token counter. Changed cases were also generated once per
variant at Standard low reasoning. Both variants used the same current prompts,
team, opponent, and candidate list; only serialization and its explanation differ.

| Case | Candidates | Before input | After input | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Scrafty / Kingambit, including Drain Punch alternatives | 12 | 21,491 | 16,218 | 24.5% |
| Tyranitar / Gholdengo | 6 | 15,382 | 13,661 | 11.2% |
| Farigiraf / Scizor | 4 | 9,765 | 9,147 | 6.3% |
| Weavile / Gholdengo | 1 | 8,065 | 8,065 | 0% |
| ZardWile Tail Room team | - | 11,931 | 11,709 | 1.9% |
| Selected Charizard | - | 10,615 | 10,393 | 2.1% |
| Tail Room Pokemon recommendation | 30 | 23,400 | 21,346 | 8.8% |

All 12 generated responses remained displayable under production review; 10 passed
strict audit validation. The selected-Charizard case failed the strict evidence
linkage audit in both variants: the original missed a named Mawile fact, while the
shared variant encountered additional paragraph-level teammate/weakness linkage
checks. These are still quality limitations, not a universal quality-pass claim.
The Scrafty pair retained the current support set, the Farigiraf pair selected the
same maximum-physical-bulk and reserve-bulk candidates, and the Pokemon recommendation
pair selected the same three species in a different order. Tyranitar selected a
different mix of the valid current and specialized candidates. One pair per case
does not establish repeated-run stability or identical strategic judgments.

With both variants normalized to warm prefix reads, total generation costs for the
three sample pairs changed from $0.004128 to $0.003117, $0.003142 to $0.002796, and
$0.001827 to $0.001704. Recommendation changed from $0.005701 to $0.005193. Team and
Pokemon outputs happened to grow, offsetting their small input savings; normalized
total costs increased by about 0.3% and 8.7% respectively. Input savings therefore
do not guarantee a lower total cost for each stochastic response. Mean latency was
11.96s before and 12.14s after; no speed improvement is established. The 12 calls
cost $0.045333 at repository rates, including actual cache writes and reads.

Verification: `npm run check` passed 544 tests across 77 files, lint, TypeScript,
and production build. No browser/UI code changed. Ignored local evidence is in
`.tmp/model-input-requests.json`, `.tmp/model-input-comparison.json`, and
`.tmp/dedup-<case>-<variant>.json`.

## Rejected Output Compression Experiment

The uncommitted v74 private-audit field-name trial was reverted before release.
Its small savings did not justify splitting shared prompt caches and maintaining
another output representation. All scopes retain the original output schema and
core-v3 cache identity. Only the lossless v73 input sharing above is retained.
Post-revert verification passed lint, 548 tests across 77 files, TypeScript, and
production build. All four scopes have explicit regression coverage for retaining
the original output schema and the shared core-v3 cache key.

## General Sample Recommendations

Date: 2026-09-08. Working branch: `feature/general-sample-recommendations`.

Sample recommendations no longer require a configured Calculator opponent. The
selected Pokemon's current set is compared with up to three observed Smogon usage
spreads, while its selected moves, item, invested offensive axes, Speed commitment,
team roles, and active concepts remain the primary fit criteria. The usage snapshot
now retains each bounded spread's rank and percentage instead of discarding every
spread after the first one.

Observed moves are aligned to the current slots so ordering differences do not
become fake replacements. Empty move slots are not filled as unverified changes,
Item Clause conflicts are skipped, and held-item alternatives include their local
catalog effect for model grounding. A usage sample identical to the current sample
is collapsed into `set-current`. When a Calculator opponent is present, the existing
deterministic matchup candidates are appended as optional evidence; only those
candidates render damage and Speed calculations.

The request contract is version 30 and the optimization scope prompt is version 30.
General candidates explicitly carry current, usage, or matchup provenance and role
stat reductions. Validation rejects malformed provenance and unmatched move changes.
Private candidate IDs are forbidden in public prose and repaired server-side if a
model emits one. Rules-based fallback now describes general samples without a fake
opponent title or unsupported calculator claims.

Browser QA selected Weavile directly in the team builder and completed a hosted
sample request without opening the Calculator. The response retained its Jolly,
maximum-Attack, maximum-Speed, Focus Sash set because the alternatives reduced its
fast-attacker role without verified benefit. No page errors occurred. The final
automated check passed lint, TypeScript, production build, and the complete test
suite; the existing large-chunk build warning remains.
