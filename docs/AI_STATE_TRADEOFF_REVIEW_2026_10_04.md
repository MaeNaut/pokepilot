# State and Spread Explanation Review - 2026-10-04

## Decision

**No product prompt change retained.** Three targeted instruction candidates
were tested and rejected. The final working tree uses prompt v100/core v12,
with exactly the same eight captured API inputs as before this experiment.
Earlier validator/postprocessing changes remain intact.

The two issues from [validator QA](AI_VALIDATOR_POSTPROCESS_REVIEW_2026_10_04.md#fresh-low-calls)
are **not considered solved**. A correct new example is not sufficient evidence
that a stochastic model reliably follows a newly added instruction.

## Targeted Problems

1. A team plan selects Mega Golisopod/Tough Claws but subsequently advises
   Emergency Exit without saying that this applies **before** Mega Evolution.
2. An optimization description says there is no defensive investment, although
   both recommended Charizard candidates have **2 HP Stat Points**.

The input already supplies both abilities, the projected Mega state, exact
candidate allocations, final stats, and move-change bindings. Missing source
data is not the immediate cause of either original mistake.

## Method

- Evaluation key only, GPT-6 Luna low, no automatic retries, no repair calls.
- Reused the eight sourced-team requests from the preceding validator QA.
  Each of the four scopes has a Singles and Doubles case, with Korean and
  English across the pair. These are not newly held-out teams.
- Froze the complete requests and captured API parameters. Verified identical
  user data, locale instructions, response schema and reasoning settings
  between arms. Only developer instructions and cache namespaces differ.
- Alternated before/after ordering by case and repetition. Calls are serial.
- Manually read public paragraphs and recommendation cards against the supplied
  facts. This is same-agent review, not an independent blind benchmark. Initial
  hash labels did not conceal the case or eliminate inference about the arm.
- Counted a response once per category. Target-related flags include current
  versus Mega defensive state, zero-investment wording, and incorrect spread
  comparisons. Other observations are recorded separately, not hidden.
- No target mention is not proof of a correct explicit explanation. Neither
  strict-audit passes nor absence of private warnings certify public prose.

## Experiments

| Candidate | Schedule per arm | Target-related flags, before / after | Other flagged responses, before / after | Decision |
| --- | --- | --- | --- | --- |
| v102: state qualification + expanded stat-by-stat instructions | Eight cases twice: 16 calls | 1 / 1 | 1 / 3 | Reject |
| v103: remove expanded stat paragraph, retain common safeguards | Eight cases twice, two anchors five times: 22 calls | 1 / 2 | 6 / 4 | Reject |
| v104: minimal before/after ability timing + positive is not zero | Eight cases once, two anchors three times: 12 calls | 0 / 0 | 2 / 4 | Reject |

The two repeated anchors are Mugepome Singles Team and Kiran Doubles Sample.
These small, reused-case counts do not establish statistically significant
regressions or gains. The acceptance decision is that none supplied enough
evidence to justify a quality improvement claim, not that every instruction
caused every observed error.

### Concrete Evidence

- v102 baseline Mugepome Team r2 reproduces the original problem: the opening
  chooses Mega Golisopod and then advises Emergency Exit without pre-Mega timing.
- v102 candidate Kiran Sample r2 mixes a sibling's HP155 with the actual
  baseline HP153, assigns another candidate's Special Attack, and says the
  recommended spread lowers Special Attack/Speed although both rise versus
  current. It also describes the Protect-replacement card as replacing Hurricane.
- v103 candidate Kiran Team r1 assigns Ground immunity to non-Mega Garchomp.
  That immunity belongs to the supplied Mega Z/Levitate projection; the current
  Ground/Dragon profile instead has Electric immunity.
- v103 candidate Kiran Sample r5 generalizes loss of a fast profile to bulk
  spreads. Spread-3 retains 32 Speed points and 152 Speed, equal to spread-1;
  spread-5 is slower. Those different costs cannot be assigned to both siblings.
- v104 candidate Mugepome Team r2 correctly places Emergency Exit before Mega
  and Tough Claws afterward. It still incorrectly presents Archaludon as help
  for a Fighting/Ground-weak axis even though it shares those weaknesses.
- v104 Kiran Sample r3, **both arms**, describes `usage-move-solarbeam-1` as
  replacing Hurricane and preserving Weather Ball. The canonical candidate
  replaces Weather Ball. The prose and actionable card still disagree.
- Other remaining examples include reversed Speed comparisons, forgetting a
  newly recommended Ninetales supplies Snow Warning, conflating terrain with
  weather, and counting enemy rather than allied fainting for Last Respects.

The original HP2/no-investment phrase did not recur in these fresh arms. That
limits what this experiment says about fixing that exact wording; it does not
erase the original saved failure. None of the candidates is promoted based
solely on non-reproduction.

## Cost and Runtime

100 paid evaluation calls, 1,870,349 recorded tokens, **$0.2066963 estimated**.
This is repository usage accounting, not a provider invoice. No production key
or private production-user analysis was used.

| Candidate | Input-token increase | Estimated cost before / after | No-cache cost before / after | Median seconds before / after |
| --- | --- | --- | --- | --- |
| v102 | +0.85% | $0.03447 / $0.03416 | $0.04013 / $0.04002 | 10.84 / 10.65 |
| v103 | +0.78% | $0.04417 / $0.04500 | $0.05339 / $0.05433 | 10.65 / 11.18 |
| v104 | +0.68% | $0.02328 / $0.02562 | $0.02826 / $0.02933 | 10.36 / 10.76 |

Explicit prefix-cache writes/hits and generated output length affect observed
cost. The no-cache counterfactual uses the repository's short-context Luna
rates; do not attribute every cost difference to the added instruction tokens.

## Output Integrity and Evidence

All 100 responses retained usable public output. In 99, the public analysis was
identical before and after review. The v103 baseline Kiran Sample r3 proposed
`set-current`, which is not in that request's candidate list. Existing action
validation removed only that invalid card and kept the valid card/paragraphs.
This is recorded separately from factual accuracy. No new validation, hidden
prose repair, or rules-based fallback was added in this task.

[Machine-readable measurements and per-response review notes](evaluations/state-tradeoff-2026-10-04.json)
include hashes, usage, diagnostics, and all flagged cases. Full requests,
captured parameters, original outputs and the evaluation runner remain locally
under ignored `.tmp/state-tradeoff*` paths. Rejected results are preserved.

## Next Experiment Boundary

Do not keep expanding a generic self-check paragraph. A distinct future
experiment can first bind the chosen form/candidate, then give the explanation
step only that selected state/loadout and its baseline. Test whether this
reduces cross-candidate and cross-state mixing before changing the product
pipeline. It must still preserve raw output and distinguish a valid structured
binding from a verified natural-language sentence.

The paired minimal trial's wrong Solar Beam slot is a useful regression case
for that experiment. Correct prose must name Weather Ball as removed for
`usage-move-solarbeam-1`; if it wants Hurricane removed, it must choose the
supplied standard candidate instead. No such multi-stage product change was
implemented here.

## Final Verification

- Recaptured all eight requests without paid calls: full parameters and prompt
  version match the immutable pre-experiment baseline.
- Whole suite: 155 test files, 1,241 tests passed after restoration.
- ESLint and Cloudflare-mode TypeScript/build passed. The existing large-bundle
  warning remains; no UI, account, or deployment behavior changed in this task.

No commit, push, or deployment was performed.
