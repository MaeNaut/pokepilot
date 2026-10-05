# Validator and Postprocessing Review - October 4, 2026

The findings below describe the pre-fix diagnostic baseline. The authorized
implementation and verification are recorded in the final section.

## Scope and Method

Diagnostic review only. No product code, prompt, model, deployment, or paid API call changed.

- Traced JSON validation, public recommendation recovery, prose rewriting, private audit completion, deterministic audit checks, API delivery, and evaluation adapters.
- Replayed 100 saved responses through the current working-tree validators: 40 `v99-fresh` responses from `.tmp/mc-final`, plus 60 responses from the controlled sample-comparison experiment.
- Used each record's frozen request, not a newly rebuilt request. The comparison experiment includes rejected prompt variants; these results are not a current-model accuracy estimate.
- Reproduced 17 diagnostic edge cases offline, including Korean and English percentage statements. These deliberately constructed cases show reachable failure mechanisms, not real-world prevalence.
- Ran 127 existing tests across hosted validation, strategy audits, analysis contracts, and the hosted API; all passed. The first sandboxed test invocation could not read the Vite configuration; the approved rerun passed.
- Local diagnostic runner: `.tmp/audit-validation-offline.ts`; complete local evidence: `.tmp/validation-audit-2026-10-04.json`. They make no network requests. The key inputs and outcomes are retained below because `.tmp` is not committed.

| Scope | Saved responses | Public output changed | Warning emitted | Strict path rejected |
| --- | ---: | ---: | ---: | ---: |
| Team | 10 | 0 | 4 | 4 |
| Pokemon | 10 | 0 | 4 | 4 |
| Pokemon recommendation | 10 | 0 | 0 | 0 |
| Sample recommendation | 70 | 4 | 4 | 0 |

Warnings are not factual-error labels. Of the four changed sample responses, three lost blocks containing legitimate accuracy or secondary-effect explanations; the fourth had a full internal candidate ID removed. At least two of the four Pokemon warnings were caused by the cross-product false positive described below. The other warnings require individual interpretation and must not be assumed false.

## Findings

### 1. High Priority: Correct Prose Is Replaced by Generic Text

Locations: `server/pokepilotAnalysisValidation.ts:379`, `:479`.

`hasOptimizationOutcome` treats any numeric percentage as an unsupported outcome unless it looks like usage, and treats an OHKO mention as a claim regardless of negation. `sanitizeOptimizationNarrative` replaces the entire affected paragraph or recommendation reason, not only an offending claim. Identical replacement paragraphs are then collapsed.

Observed saved responses:

- `v99-fresh-mc-kiran-optimization`: a paragraph explaining Hurricane's 50% sun accuracy and the rain/sun tradeoff becomes a generic statement about comparing alternatives.
- `mc-kiran-optimization-comparison-r1`, blind `7dfe87fb`: the same percentage rule removes another weather explanation.
- `mc-mugepome-optimization-examples-r1`, blind `caa4f4ef`: Dark Pulse's 20% flinch effect causes the entire reason to be replaced, also losing Draco Meteor's Special Attack-drop caveat.

Constructed English and Korean accuracy/flinch statements reproduce this. `An OHKO has not been verified for this set.` also triggers replacement even though it explicitly avoids making that claim.

There is no whole-answer rules-based analysis fallback, but **block-level rules-based replacement still exists**. The distinction matters to the product's quality-first policy.

Recommendation: keep structural and action-ID safety checks, but stop using these broad text detectors to rewrite semantic content. An uncertain semantic detection should be private diagnostic data, not permission to invent a replacement explanation.

### 2. Repair Text Can Add Unsupported Confidence or Change the Recommendation

Locations: `server/pokepilotAnalysisValidation.ts:185`, `:416`, `:493`, `:549`; candidate construction in `src/calculator/setOptimizer/generalPlan.ts:434` and `:510`.

- `verifiedOptimizationReason` describes every non-current general candidate as an observed general-purpose sample. Some candidates are synthesized by combining the user's current set with a marginal usage spread, item, or one alternative move. Observing the individual component does not establish that the complete loadout was observed. This wording was inserted into the saved Dark Pulse/Draco Meteor case above.
- General-mode titles can become "검증된 상대 조정을 사용할 수 있습니다." even though no opponent-specific benchmark was requested. Reproduced with a general candidate and the cautious title `An OHKO has not been verified.`
- Meta replacement repair can reverse cautious advice. A constructed recommendation saying `Keep the rain setter.` / `Avoid switching to Rotom Wash because losing rain breaks the weather plan.` is rewritten to `Consider Rotom Wash over Pelipper.` and a generic check/tradeoff sentence when the original target name was omitted. The specific reason for avoiding the swap disappears. This uses the same minimal meta evidence fixture shape as the existing unit tests; it is not an observed paid output.

Recommendation: deterministic data can populate an explicit change summary or calculator table. It should not silently substitute for the model's strategic conclusion or call a synthetic candidate an observed complete sample.

### 3. Wrong Move-Replacement Explanations Pass Both Paths

Locations: `server/pokepilotAnalysisValidation.ts:92`, `:542`; rendering in `src/components/CopilotOptimizationRecommendation.tsx:245`.

Both move-narrative checks only require the added move's display name somewhere in the title/reason. They do not establish which move was removed or whether a supposedly retained move is actually retained.

Actual record `mc-kiran-optimization-examples-r1`, blind `a5325de3`, recommends `usage-move-solarbeam-1`. The candidate removes Weather Ball, but the text says it removes Hurricane while retaining Weather Ball. The new move name Solar Beam is present, so strict validation accepts it and production emits no quality warning. The structured change row and eventual applied candidate still use the candidate data, so the user can receive contradictory prose and an accurate change row.

Other saved comparisons also contain removed-move or stat-direction mistakes. An empty optimization audit is required by the current contract, so a passing audit adds no semantic assurance here.

Recommendation: keep the existing authoritative change row. If introducing further machine-readable claims, bind each claim to the exact candidate, removed slot, old/new move, or signed stat delta and check those fields. Do not pretend that finding the added move's name proves the natural-language explanation correct, and do not solve this with ever-larger replacement regexes.

### 4. Audit Completion Can Hide a Real Factual Error

Location: `src/utils/copilotStrategyAuditCompletion.ts:259`, particularly `:289`.

For Pokemon analysis, an invalid defensive fact is reassigned to a different named teammate if exactly one such teammate's profile supports it. Public text is not changed, and this semantic reassignment is not reported.

Constructed reproduction using the frozen Danjinesu request:

- Public reason: "보만다는 땅 타입에 약하므로 브리두라스로 교대해야 합니다."
- Original fact: `weak-to`, `subjectSlotIndex: 0` (Salamence), `valueId: ground`.
- Raw deterministic validation correctly finds a contradiction: Salamence's supplied current profile is Ground-immune.
- Completion changes the fact subject to slot 2, Archaludon, which is Ground-weak and appears in the same text.
- The wrong public sentence is unchanged. Completed audit errors become empty, strict validation passes, and production returns no warnings.

Recommendation: normalize formatting, but do not infer a new subject, state, or relation from a whole recommendation's name mentions. Preserve the original invalid fact and report the mismatch. If a future narrowly supported correction is allowed, retain an explicit before/after diagnostic and do not count it as an unmodified validation pass.

### 5. Correct Defensive Advice Is Flagged as Incorrect

Locations: `src/utils/copilotStrategyAuditCandidateValidation.ts:510`, `:521`, `:142`.

The coverage check takes every weakness type mentioned anywhere in a recommendation and demands matching defense evidence from every teammate named anywhere in that recommendation. This creates a cross-product, not sentence-to-evidence binding.

Actual saved false positives:

- `v99-fresh-mc-ddee-pokemon`: Gholdengo's Poison immunity and Incineroar's Steel resistance are correctly linked to separate facts. The checker additionally demands Poison evidence for Incineroar and Steel evidence for Gholdengo.
- `v99-fresh-mc-mugepome-pokemon`: Pelipper is described as the Ground-immune option and Basculegion as the Fighting-immune option. The checker additionally demands the reversed pairings.

A separate constructed input, "팀에 페어리 무효 동료는 없습니다.", is flagged because a teammate *resists* Fairy. The request really has no Fairy immunity. The negative-claim check combines resistance and immunity and ignores which one the sentence denies.

Production preserves these answers and logs a warning; the strict evaluation adapter rejects them. This biases automatic quality comparisons against otherwise valid detailed explanations.

Recommendation: distinguish resistance from immunity, preserve the original subject/type relation, and separate "not deterministically checked" from "contradicts data". Sentence-level scoping can reduce cross-sentence mistakes, but is not enough for multiple clauses in one sentence. Do not demand every type/name pairing, and do not add an unrelated defensive fact merely to satisfy the checker.

### 6. Singles and Active-Count Repairs Misread Context and Negation

Locations: `server/pokepilotAnalysisValidation.ts:298`, `:329`.

Constructed cases on frozen requests:

- Correct Singles advice, "지진으로 상대를 압박한 뒤 동료에게 교대해 피해를 분산합니다.", is replaced with the generic no-ally-damage sentence. Mentioning a teammate and damage does not mean Earthquake is damaging that teammate.
- Wrong advice, "지진은 아군에게 피해를 주지만 상대에게는 효과가 없습니다.", is left intact because an unrelated negative word exempts the entire sentence.
- A correct Singles sentence counting the two opposing active Pokemon is rewritten as if it claimed two friendly active Pokemon.
- A Doubles sentence explaining that three friendly Pokemon *cannot* be active together is rewritten, losing its follow-up switching plan.

Recommendation: preserve uncertain prose and log a narrowly named heuristic warning. Use structured active-slot/action evidence for hard validation; these sentence heuristics do not establish ownership, polarity, or temporal context.

### 7. Invalid Replacement Cards Can Become a Successful Empty Result

Location: `server/pokepilotAnalysisValidation.ts:253`.

Full-roster replacement requests legitimately allow zero recommendations to mean "keep the current team." The recovery path also uses that permission after filtering every supplied recommendation as an invalid ID. In the constructed replacement-mode case, all cards disappear but the paragraph still recommends replacing a Pokemon. It is returned successfully with only a private `recommendations-adjusted` warning.

Recommendation: distinguish an originally intentional empty list from a nonempty list that became empty after validation. Continue forbidding unknown actionable candidates. Preserve renderable narrative under the current policy, but record unavailable actions as such rather than classifying the outcome as a clean keep-current result. Any user-facing treatment should avoid inventing new strategic advice.

### 8. Malformed Paragraphs Can Crash the Schema Validator

Location: `src/utils/copilotModelValidation.ts:168`.

`validateStringArray` records a type error for `[null]`, but the next check unconditionally calls `.trim()` on each element. Reproduced `TypeError` rather than a structured validation failure. In the API this can be classified as a generic upstream failure instead of `AI_INVALID_RESPONSE`.

Provider strict JSON schema makes this less likely on the normal successful route; the validator should still be total for unknown input, including adapter and malformed-response paths.

Recommendation: guard element types before trimming and add negative-shape tests. This is a small defensive fix, not a reason to redesign the schema layer.

## Evaluation and Observability

These are limitations and follow-up work, not additional claims that the API currently exposes quality warnings to users.

- Production intentionally uses `reviewHostedCopilotAnalysis`; the older evaluation adapter uses `validateHostedCopilotAnalysis`. The former keeps renderable answers with private warnings; the latter rejects audit failures. They measure different outcomes.
- Even the strict path calls audit completion and returns sanitized prose. In this replay, all four rewritten sample outputs still count as strict passes. "Strict pass" therefore does not mean "the original model answer was correct and untouched."
- Some recommendation audit completion can drop unsupported facts or populate missing links from name mentions. Added links can establish ownership, but cannot prove the sentence's strategic conclusion or causal claim.
- `server/webPokePilotApi.ts:239` logs coarse warning codes. Specific audit errors and which prose blocks changed are discarded by the review result. The public API returns the final analysis; ordinary history cannot reconstruct the original model response from that alone.
- Privacy-preserving diagnostics can retain rule ID, stage, field path, candidate ID and count without storing team/prose. Raw-before/final-after retention should remain limited to explicit evaluation inputs or appropriately consented diagnostic data, not all user analyses.

## Recommended Order

1. Stop semantic block replacement and audit subject reassignment. Keep valid JSON, correct scope, canonical candidate IDs, and safe action binding as hard boundaries. This does not guarantee model accuracy; it prevents the checker from silently worsening it.
2. Fix the two demonstrated defensive false positives, malformed-input crash, and intentional-empty vs filtered-empty distinction. Turn the observed outputs and constructed cases above into focused regression tests.
3. Report raw structural validity, raw audit validity, normalized audit validity, heuristic warnings, semantic edits, action availability, and human-reviewed factual accuracy separately. Do not optimize a single pass percentage.
4. Only then decide whether exact structured claim bindings or selective repair calls are worth adding. More regexes or an automatic extra LLM call on today's noisy warnings would amplify false positives and potentially waste users' money.

No additional model call was needed to establish these findings. No fixes, commits, pushes, or deployments were performed in this review.

## Authorized Implementation Follow-up

Implemented after the diagnostic review, on the user's instruction:

- Removed semantic prose-repair and fallback-template code. Public titles, paragraphs, and retained recommendation reasons remain byte-for-byte equal to model output. Unknown/duplicate candidate cards remain a separate action-safety boundary.
- Removed defensive-fact subject reassignment. A wrong fact keeps its original subject and fails audit validation instead of being silently made true about a different Pokemon.
- Scoped defensive prose checks to local statements and avoided ambiguous multi-type pairings. Removed the assumption that every defensive fact in one recommendation must answer the same selected weakness. Negative resistance and immunity claims now check their respective profiles separately.
- Kept intentionally empty replacement lists distinct from nonempty lists whose every action is invalid. The latter now returns the existing invalid-response error, consistent with other unrecoverable action lists.
- Guarded non-string paragraph elements before trimming; malformed responses retain invalid-response classification and attempted-call usage accounting.
- Added internal raw/normalized audit diagnostics, candidate counts, and `proseVerified: false`. Production logging uses counts and flags only, with no raw text. Warnings and diagnostics remain absent from public API responses and cached-response metadata.
- Preserved original evaluation responses in the generic adapter's `debugOutput`.

Verification:

- Whole suite: 154 test files, 1,232 tests passed.
- ESLint passed. An ignored historical diagnostic probe initially triggered `no-explicit-any`; its intentionally malformed fixtures were explicitly scoped as such. Product code needs no lint suppression.
- Cloudflare-mode TypeScript/build passed. The existing large-bundle advisory remains; no deployment was performed.
- Replayed the same 100 saved responses without network/model calls: 100/100 public analyses equal their original raw analyses, and request/output inputs were not mutated.
- Sample prose changes: 4/70 before, 0/70 after.
- Pokemon audit warnings/strict failures: 4/10 before, 2/10 after. The two removed warnings are the documented DDee and Mugepome cross-pairing false positives, not newly corrected model prose.
- The remaining Team warnings (4/10) and Pokemon warnings (2/10) remain visible internally. Recommendation audit completion was recorded in 3/10 cases and Team completion in 3/10 cases, separately from raw audit validity.
- Evidence: [offline replay](evaluations/validator-regressions-2026-10-04.json).

Remaining boundary: this change does not prove or repair the meaning of every
natural-language sentence. The saved wrong removed-move explanation remains
model-authored text; its structured candidate/change row stays authoritative.
The old added-move-name check has been removed as a supposed certification, not
replaced with a larger natural-language parser. Exact structured claim bindings
would be a separate future model-contract change. Private audit completion still
normalizes some bookkeeping, but its raw errors and normalization status are now
preserved rather than being conflated with untouched valid output.

No paid calls, commits, pushes, or deployments were performed in this follow-up.

## Focused QA Follow-up

Performed subsequently with the user's approval. This section supersedes the
earlier remaining-completion boundary, not the historical measurements above.

### Reproduced and Fixed

Three regression tests first failed on the previous implementation:

- Unsupported candidate claims were weakened (`adds-unanswered-weakness` to
  `weak-to`, or `role-contribution` to `responsibility`) or deleted, together
  with their evidence references. These claims and references now survive.
- Uncited false defensive facts were deleted. They are now validated whether
  or not a recommendation references them.
- Interaction move links not backed by the declared plan were trimmed when
  another link survived. They now remain visible to validation.

These removals reduce repair code rather than adding new language heuristics.
The public answer stays unchanged and private audit failures remain nonfatal.
Unary unused-slot normalization and exact request-backed element/link completion
remain; neither means public prose has been fact-checked. A wrapper regression
also checks that uncited contradictions warn internally and fail strict audit
evaluation without suppressing the production answer.

### Verification

- Eight durable integration cases (four scopes, both languages) cover review,
  the client API parser, analysis session, history serialization/reload, rendered
  prose, execution metrics, and canonical recommendation action binding. Only
  network/account boundaries and sprite fetching are mocked in these DOM tests.
- Isolated Chrome: 360px and 1280px, eight fresh responses at each width. All 16
  cases preserve text after history reload, keep metrics accessible, have no
  horizontal page overflow or page exceptions, and load recommendation sprites.
  This is component/browser QA, not production authentication or D1 sync QA.
- 7,007 malformed **JSON-representable** variants: 5,849 retain renderable public
  output, 1,158 return the expected invalid-response error, no unexpected throws.
  Deleting an array slot is serialized to `null`, as it is over the real API;
  this is not a guarantee for arbitrary sparse in-memory JavaScript arrays.
- Replayed the same 100 stored outputs: all public analyses remain unchanged.
  Team audit warnings increase from 4/10 to 5/10 compared with the preceding
  implementation. Three Team records retain more error detail; one previously
  passed only after destructive completion. This is improved error visibility,
  not worsened model output. Other scope warning totals remain unchanged.
- Whole suite: 155 files, 1,241 tests. ESLint and Cloudflare-mode build pass.
  Existing large-bundle and unrelated test-environment warnings remain.

### Fresh Low Calls

Eight calls used only the evaluation key, with no automated retries or repair
calls. Each scope has one Singles and one Doubles case and both languages across
the pair. Inputs were built using the current localized request builder and the
existing published-team fixtures; unpublished spreads remain zero allocations,
not inferred tournament spreads.

- All 8 returned usable public analyses, with no prose edits.
- Raw audit warnings: 2/8. After exact missing-element linking: 1/8.
- Total recorded tokens: 153,609. Estimated cost: **$0.01757495**.
- Response duration: 8.20-17.65 seconds; median 11.71 seconds.
- The remaining warning names Raichu without a supporting teammate fact row.
  Its sentence merely says not to activate both Mega options, so this missing
  evidence link is not by itself evidence of factually incorrect advice.

Manual prose review still found quality limitations outside deterministic audit:

- `mc-mugepome-team-ko`: the main recommendation chooses Mega Golisopod and
  Tough Claws, then discusses Emergency Exit without qualifying the pre-Mega
  state. Readers could incorrectly combine both abilities.
- `mc-kiran-optimization-ko`: a paragraph says there is no defensive investment,
  while both recommended candidate snapshots include 2 HP Stat Points. The
  structured spread is correct; the prose tradeoff is imprecise.

Neither issue is silently rewritten or counted as verified prose. No prompt
change was attempted in this validator QA. The next quality experiment should
target state-qualified ability advice and precise set-change explanations,
using these original outputs as regression evidence, rather than growing
general-purpose text-replacement rules.

Evidence: [QA measurements](evaluations/validator-qa-2026-10-04.json) and
[post-QA replay](evaluations/validator-qa-replay-2026-10-04.json). Raw approved
evaluation inputs/outputs and browser screenshots remain in the ignored local
`.tmp/validator-qa-2026-10-04/` directory, with hashes in the tracked summary.
No production user data was collected. No commit, push, or deployment was made.

### Explanation Follow-up

The subsequent [state and spread experiment](AI_STATE_TRADEOFF_REVIEW_2026_10_04.md)
tested three instruction variants with 100 low calls. None demonstrated a
reliable improvement; all were rejected and the original v100/core v12 inputs
were restored. The two issues above remain open. Saved evidence includes
explicitly correct pre-Mega wording as well as remaining state, spread, and
canonical move-slot mismatches; do not count a rare error's non-reproduction
as a verified fix.
