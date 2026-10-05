# Sample Recommendation: Luna vs Sol vs Two Stages - 2026-10-04

## Decision

**GPT-6.1 Sol low is the most promising quality candidate in this pilot.**
Do not promote the two-stage Luna pipeline: it incurred extra time and tokens
without a persuasive factual-accuracy or usefulness gain. No production model,
prompt, UI, validator, or generation pipeline was changed by this experiment.

The result does not establish that Sol is error-free or that it should replace
Luna in every scope. Extend the same-input comparison to Team, Pokemon and
Pokemon Recommendation before changing a product-wide default. The current
Luna low default and optional medium remain unchanged.

## Design

- Scope: Sample Recommendation (`optimization`), prompt v100/core v12.
- Six cases, three repetitions per arm: 54 completed analyses, 72 paid calls.
- Arms: GPT-6 Luna low single call; GPT-6.1 Sol low single call; GPT-6 Luna low
  selection followed by a separate Luna low explanation.
- The two single-call arms have identical messages, data, schema, output limit,
  reasoning effort and service tier. Only model and evaluation cache key differ.
- Both use an 8,000-token output limit. The split selector has a 4,000-token
  limit, explains nothing, and returns candidate IDs, one rejected comparator,
  and a current/projected-Mega planning state. Its input contains the same full
  team and candidate data. The explanation receives only those candidates plus
  their comparator, all team context and the unchanged current baseline. It
  must preserve selected IDs/order. Candidate values are not rewritten.
- Serial calls, rotating arm order within each case/repetition. No automatic
  retries, repair calls, model judges, or production-key fallback. Evaluation
  key only; no private user teams or production analysis were sent.
- Original requests, full API parameters, original outputs, usage and stage
  timings were frozen locally. Nothing was selected or rewritten after seeing
  an answer to make an arm look better.

### Cases and Limits

| Case | Format / language | Provenance / focus |
| --- | --- | --- |
| Charizard | Doubles / Korean | Existing Kiran regression; dual weather, move-slot siblings, zero-point reconstructed baseline |
| Salamence | Singles / English | Existing Tagerau case; mixed investment, Aerilate, Roost replacement choices |
| Umbreon | Singles / English | New recombined roster; Wish, Foul Play, item tradeoffs |
| Golisopod | Singles / Korean | New recombined rain roster; Mega state, priority, pivot and recovery tradeoffs |
| Volcarona | Doubles / English | New recombined roster; preserve redirection/Tailwind, distinguish spread and item changes |
| Garchomp | Doubles / Korean | New recombined roster; special Mega Z versus a physically invested candidate shortlist |

The four new rosters use set components from the existing published fixtures;
they are newly assembled test teams, **not new tournament-winning teams** and
not wholly unseen Pokemon/builds. Some open-team-sheet components retain the
explicit zero-point reconstructions from earlier experiments. Those are stress
inputs, not claims about the original players' actual investment.

This is a small, purpose-selected pilot, not an estimate of population error
rates. Repetitions are clustered within six inputs. Review was performed by
the same agent that designed the experiment, not an independent expert.
Hash labels hid arm names during most reading, but some progress summaries
revealed identities, so this is not a fully blinded study.

## Results

All 54 analyses produced usable public output. All 18 split results preserved
the selector's candidate IDs/order. There were no provider failures in the
completed network-enabled run.

| Measure | Luna single | Sol single | Luna two-stage |
| --- | ---: | ---: | ---: |
| Reviewed results | 18 | 18 | 18 |
| Responses with definite factual contradictions | 2 | 0 | 2 |
| Additional major strategic failure | 1 | 0 | 0 |
| Invalid actionable candidate ID | 1 | 0 | 0 |
| Presentation issues, tracked separately | 3 | 0 | 3 |
| Median end-to-end seconds | 8.93 | 13.02 | 12.39 |
| Mean end-to-end seconds | 8.60 | 12.59 | 12.74 |
| Mean observed estimated USD / analysis | 0.001641 | 0.030748 | 0.002988 |
| Mean no-cache counterfactual USD / analysis | 0.002020 | 0.038767 | 0.003561 |
| Mean input tokens / analysis | 16,540 | 16,540 | 30,591 |
| Mean output tokens, including reasoning | 733 | 569 | 1,004 |
| Mean reasoning tokens, subset of output | 278 | 53 | 519 |

Counts overlap: the invalid Luna ID occurs in a response that also has a
factual error. The strategic failure is not a mechanically proven fact error.
Ambiguous candidate references and debatable preferences were not counted as
definite contradictions. Subjective usefulness ratings and their rubric are
retained in the machine-readable artifact but are not a validated benchmark.

Relative to Luna single, Sol cost approximately **18.74x** with **1.46x** the
median latency. Split Luna cost approximately **1.82x** with **1.39x** the
median latency and about **1.83x** the total tokens. Split totals include both
selection and explanation; comparing only its second call would understate
cost and time. Token counts alone do not establish efficiency or quality.

Total: **1,187,572 tokens**, **$0.63678311 estimated** across 72 paid calls.
Prices use the October 4 official model pages: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
and [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
These are estimates from recorded provider usage and Standard short-context
rates, not a billing invoice. Explicit cache reads/writes are included. The
no-cache column removes cache effects but does not simulate another run.

## Concrete Quality Differences

### Sol

- Across all three Salamence repetitions, Sol identifies Roost over Earthquake
  as a useful alternative: it preserves invested Fire Blast, Dragon Dance and
  Aerilate Double-Edge while noting Swampert/Glimmora's Ground attacks. It also
  explains that teammates cannot supply Salamence's coverage during its own
  sweep. This is a concrete strategic connection, not just a longer summary.
- Charizard answers distinguish the uninvested current build from proposed
  spreads, correctly bind Solar Beam to the selected removed move, and compare
  the rain and sun costs without declaring either weather branch invalid.
- Golisopod answers correctly compare 54-to-60 Speed and the HP/Defense trade,
  preserve its selected responsibilities, and discuss Leech Life versus U-turn
  using the team's other pivots.
- Volcarona answers keep the support role separate from the Quiver Dance
  standard candidate, recognize the lower Speed but higher Special Attack,
  and explain which support tools survive a Protect replacement.

No definite factual errors were found in these 18 outputs. This is an
observation of this reviewed sample, not a 100% accuracy claim or proof of
optimal competitive recommendations.

### Luna Single

- Charizard r1 (`c49f75b5`) describes the current uninvested Timid build as
  maximizing Special Attack and Speed, conflating current and candidate data.
- Volcarona r3 (`df80d134`) says both Speed and Special Attack fall. The frozen
  values are Speed 132 -> 120 and Special Attack **155 -> 170**. It then rejects
  that spread while recommending an item candidate applying the same spread.
- Salamence r2 (`795dc1f2`) recommends removing the sole Aerilate STAB move,
  Double-Edge, for Roost, without a concrete advantage over the supplied
  coverage-replacement siblings. Counted separately as a major strategic flaw.
- Some Korean responses leak English terminology or misspell a move name.
  These are presentation defects, not all factual contradictions.

### Luna Two-Stage

- Garchomp r1 (`15a850b9`) still says its proposal retains three special attacks
  after replacing special Power Gem with physical Rock Slide, and reverses the
  standard comparator's specific replacement bindings. Narrowing the candidate
  list did not prevent a visible-prose contradiction.
- Salamence r2 (`66eacb03`) lists Ice/Rock/Dragon/Fairy weaknesses and says Roost
  does not remove those type vulnerabilities. The supplied move effect removes
  Flying typing for the remainder of the turn, removing Rock weakness and
  reducing Ice weakness after use. The unqualified statement is misleading.
- Selecting a weak comparison first can limit the explanation. Several outputs
  debate keeping Fire Blast against a Roost-over-Fire-Blast alternative while
  omitting the Earthquake-replacement sibling altogether.
- The split pipeline also leaked private labels such as `usage-standard`.
  A correct structured selection does not certify the resulting sentences.

## Input/Contract Findings

These issues were observed while reviewing the requests and should not be
misattributed to a specific model:

1. **A missing good candidate limits every model.** In the constructed Garchomp
   case, all nine candidates invest Attack and Speed despite the selected
   special Mega Z role. None provides a special-invested unchanged loadout, and
   `set-current` is absent. All arms choose a bounded compromise. Better prose
   is not evidence that the shortlist itself produces a good optimization.
   The request was built from pre-Mega `member.id`, as in the current
   `useSetOptimizationPlan` path. Confirm and address form-aware candidate
   coverage before drawing a product-wide recommendation-quality conclusion.
2. **An incomplete spread changes what a 'move/item candidate' means.**
   `getCurrentSpread` accepts only a complete 66-point allocation; otherwise
   `createGeneralCandidates` uses a usage spread and nature as its baseline.
   A move/item variant can therefore also change investment and nature versus
   `optimization.currentBuild`. Scope text describing those variants as only
   a move/item change is too broad for this case. All arms saw the same data,
   but some explanations inherit that misleading simplification.
3. **A slow-role loss is not necessarily a lower Speed number.** For Brave,
   zero-Speed Golisopod, `reducedRoleStats` includes Speed when a proposed build
   becomes faster and gives up the slow role. Existing scope text describes a
   lower final stat in this field. Split r3 (`36459cf6`) prints 54 -> 60 correctly
   but calls the role flag a Speed decrease and asks the user to reconcile it.
   This input-contract ambiguity is tracked separately from clear model-only
   factual errors.

No candidate-generation or prompt fixes were mixed into the measured arms.
Fixing those contract issues and rerunning a smaller paired test is preferable
to adding another generic 'check your answer' paragraph.

## Validator and Output Integrity

Luna single Volcarona r3 invents a `set-current` card absent from the candidate
list. Existing validation removes that card, keeps the valid recommendation,
and does not rewrite the false Special Attack sentence. Its diagnostic is
recorded. The other 53 public outputs are unchanged by server review.

All split selections stayed legal and preserved their selected order, yet two
still contained definite prose errors. Private warning counts must not be used
as prose-accuracy scores. No rule-based fallback or silent prose repair was
introduced.

## Evidence and Verification

[Machine-readable measurements and review notes](evaluations/sample-pipeline-2026-10-04.json)
include every result's input/output hashes, stage usage, candidate selections,
manual findings and diagnostics. Full raw evidence, new constructed fixtures,
and runner remain in ignored `.tmp/sample-pipeline-2026-10-04/` and
`.tmp/sample-pipeline-eval.ts` paths. The initial sandbox-restricted attempts
returned no provider response or usage; they are retained separately and are
not counted as completed paid evaluations. The network-enabled run is `live-v1`.

Offline checks verify frozen baseline equality, preservation of full team and
current build when narrowing candidates, unchanged original requests, and
rejection of nonexistent IDs, duplicate IDs and selected/rejected overlap.
Single-call input hashes are identical across the model arms. All 54 outputs
have manual review entries; all 72 stages have completed provider status,
explicit low effort, Standard tier and `store: false`.

Focused regression verification: four test files, 69 tests passed
(`pokepilotModelInput`, `pokepilotAnalysisValidation`, `generalPlan`, and
`copilotAnalysis`). The sandbox initially blocked the test configuration read;
the permission-enabled rerun completed successfully.

No commit, push or deployment was performed.

## Input-Contract Fix Follow-Up

This subsequent implementation is separate from the frozen pilot above. Its
recorded outputs, usage, hashes and scores are unchanged. Further Sol trials
are deferred at the user's request; no model-selection change was made.

- A legal current spread now remains available even at 0 or partially allocated
  Stat Points. Move, item and paired loadout candidates inherit that exact nature
  and allocation rather than silently adopting the leading usage spread. Their
  `evTotal` reports the actual sum. Standard/spread alternatives still require a
  complete 66-point allocation. Zero-point cards display `0`, not a blank value.
- Partial candidates are accepted only for current/focused variants and must
  retain the current allocation and nature. Current candidates cannot silently
  change moves or items. The candidate application path was checked as well.
- `reducedRoleStats` now means numeric decreases only. `losesSlowSpeedRole`
  separately identifies an increase from a zero-Speed, Speed-lowering-nature
  baseline. New evidence is checked against supplied final stats; legacy stored
  evidence without the new flag remains readable.
- Sample preparation requests the held stone's projected form when available,
  without relabeling current-form stats as post-Mega stats. The usage loader
  prefers an exact supplied form and otherwise retains its existing aggregate
  fallback. Evidence identifies both requested and actual usage Pokemon IDs.
  This does not create form-specific statistics when the provider lacks them.
- Prompt v101/core v12, optimization v35 describes these exact contracts. A
  missing appropriate invested spread is a shortlist limitation, not proof that
  an unrelated physical/special role switch is best. Keeping an incomplete
  baseline is not an endorsement of leaving points unallocated.

Five regression failures reproduced the old behavior before the fix. The full
suite after the fix passed 1,249 tests in 155 files, including request validation,
candidate application, usage lookup, prompt contracts and card rendering.
ESLint and the Cloudflare production build also passed; the existing large-chunk
build warning remains. No deployment was performed.
No paid model calls were made: generated-text accuracy after this change has
not yet been measured.

### Next Data Enrichment

Implemented in the subsequent [October 5 data-enrichment patch](AI_RECOMMENDATION_DATA_REVIEW_2026_10_05.md). The limits and proposal below describe the earlier v101 checkpoint, not the current working tree.

Candidate limits are unchanged: Pokemon Recommendation retains up to 30
candidates with four representative common moves per candidate; Sample
Recommendation retains up to 12 candidates, drawing on up to six usage spreads,
four items and eight move options. The upstream parser also bounds those source
options, so increasing only a final candidate limit cannot recover discarded
data.

Prefer distinct, sourced alternatives over repeated input: additional observed
moves/items and their effects, alternative point distributions/natures relevant
to the current role, and explicit current versus projected-form comparisons.
Retain the real current set and diverse replacement slots. Nature, item, move
and Stat Point frequencies are independent marginals, not a correlated observed
team/set; do not present their combinations as such. Measure shortlist coverage
and Luna low quality before raising limits broadly. This enrichment is proposed,
not implemented by the input-contract patch.
