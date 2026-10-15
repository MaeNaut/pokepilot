# Current Luna Low Quality Regression

## Scope

All calls used the existing evaluation key, GPT-6 Luna low, Standard service,
`store: false`, and zero provider retries. No production key, private user team,
AI judge, or rules-based replacement analysis was used.

Inputs were rebuilt from current source at commit `70b2d2c`, using the public
M-C fixtures in `aiMcPublishedTeams.json` and `aiMcExpandedTeams.json`. Their
original publication/ranking metadata is not a claim about today's rankings.
Each input was frozen and evaluated three times. Every public paragraph and
recommendation reason was manually compared with the exact supplied facts.

| Scope | Singles | Doubles |
| --- | --- | --- |
| Team | Mugepome rain, Korean | Kiran dual weather, English |
| Pokemon | Mugepome Archaludon, English | Ddee Floette, Korean |
| Addition recommendation | Danjinesu, Korean | Lloyd, English |
| Sample recommendation | Tagerau Salamence, English | Kiran Charizard, Korean |

Six additional calls covered full-roster replacement recommendations for
Danjinesu and Lloyd. Exact-matchup/meta-threat analysis and medium were not
re-evaluated in this pass.

## Results

| Group | Calls | Responses With Confirmed Issues | Estimated Cost |
| --- | ---: | ---: | ---: |
| Current-input primary suite | 24 | 4 | $0.05660808 |
| Full-roster replacement supplement | 6 | 0 | $0.02019492 |
| Legacy evaluation-input sample runs, excluded above | 6 | 2 | $0.01319624 |
| Rejected coverage-instruction experiment | 12 | 5 | $0.040764845 |
| Total paid calls | 48 | 11 | $0.130764085 |

The 30 current-input calls used 742,264 total tokens and had a median provider
call duration of 13.827 seconds. Costs use provider-reported token usage and
the repository's cost estimator, not a billing invoice. Cache conditions were
not controlled. This small, deliberately difficult suite is not a general
accuracy rate or a latency benchmark.

All 30 current-input responses were renderable. Four had raw audit warnings;
one retained an audit warning after normalizing evidence bookkeeping. None of
the four confirmed prose-error responses retained an audit warning. Structural
validation therefore still does not certify factual accuracy.

## Confirmed Problems

1. **Team / owner confusion:** Mugepome repeat 2 says Archaludon has 32 Special
   Attack points. It has zero; Pelipper has 32. The exact owner-labelled input
   was correct.
2. **Pokemon / move ownership:** Ddee repeat 3 says Floette and Incineroar both
   carry Protect. Incineroar's supplied set instead has Flare Blitz, Throat
   Chop, Fake Out, and Parting Shot.
3. **Addition / coverage semantics:** Lloyd repeat 3 interprets Ground coverage
   as requiring a Ground-type attack. `fit.coversTypes` is computed against
   opposing defending types from the legal movepool, not attacking move types.
4. **Sample / nature comparison:** Kiran current-input repeat 3 says Timid
   lowers Attack compared with Modest. Both lower Attack; the corresponding
   candidates both have Attack 93.

The excluded legacy-input runs additionally exposed a Naive spread labelled
Adamant and a Solar Beam card described as retaining Hurricane despite that
exact candidate replacing Hurricane. Keep these examples as failure evidence,
not as current-input suite results.

## Strategic Concerns

- Two current Salamence sample responses recommended Roost over Double-Edge
  without weighing the loss of its sole Aerilate-enhanced same-type attack in
  the projected Mega branch. This is an inadequately explained strategic
  tradeoff, not an illegal build.
- Addition comparisons remain shallow. Existing Psychic Terrain priority
  protection was not consistently weighed against Armor Tail, and one addition
  explanation unnecessarily discussed a replacement's losses.
- One six-member recommendation focused on Meowscarada although the supplied
  pool covered six replacement targets. Empty recommendations are supported
  behavior; they do not prove that every possible exchange was considered.
- Weather Ball/Solar Beam phrasing and coordinated Sand Rush ownership were
  ambiguous in some outputs. These concerns were not counted as confirmed
  factual contradictions.

## Rejected Experiment

A temporary v104 draft added one explanation that `coversTypes` values are
opposing defending types, with a Ground-type example. The same 12 addition and
replacement requests were replayed with identical input hashes.

Confirmed-issue responses changed from 1/12 to 5/12. New mistakes included
calling existing special offense absent, giving Gholdengo Dark Pulse,
substituting Spikes for Tinkaton's Stealth Rock, calling existing priority
denial absent, and claiming Whimsicott loses Primarina's Dragon immunity.

This does not establish that the sentence caused those stochastic errors, but
it gives no basis for promoting it. The draft and its test were removed;
production instructions remain v103/core v13. No semantic prose rewriting,
silent candidate substitution, fallback generation, or second AI call was added.

## Retained Improvements

- Sample recommendation cards now show the six actual stat values before and
  after an allocation/nature change, including signed losses. Values come from
  the analyzed snapshots, not generated prose or current editor values.
- The label explicitly says the comparison uses the analyzed form; it does not
  present base-form candidate stats as projected Mega stats.
- Analysis execution retains `set-current` with selected candidate snapshots
  even when it was not recommended, so history preserves the baseline without
  adding an unwanted recommendation card. Older history without a baseline
  does not invent one. Move/item-only candidates with unchanged stats add no
  redundant comparison block.
- `run-mc-published-evaluation.ts` now uses the same held-stone form lookup and
  item-option limit as the product, and permits missing usage samples like the
  product instead of aborting the evaluation preparation. In this fixture
  snapshot the provider
  falls back to base-species aggregates, so corrected requests differed only
  in requested-form metadata, not candidate builds. The correction is not
  evidence of a model-quality improvement.

## Verification And Evidence

- `npm run check`: lint, 1,410 tests across 164 files, TypeScript, and Vite build
  passed. The pre-existing large-chunk warning remains.
- Headless Chrome: eight viewport/theme/locale combinations at 360 and 1280
  pixels passed initial rendering, history reload equality, and horizontal
  overflow checks. Both panel color schemes were visually inspected.
- The published-team runner prepared all 16 requests in a no-OpenAI-call smoke
  run, including Floette's missing-usage case with only its current baseline.
- Raw requests, exact provider parameters/responses, usage and review results
  remain in ignored `.tmp/quality-regression-2026-10-14/`,
  `.tmp/quality-samples-current-2026-10-14/`,
  `.tmp/quality-replacement-2026-10-14/`, and
  `.tmp/quality-coverage-after-2026-10-14/`.
- Machine-readable assessments and hashes:
  [quality-regression-2026-10-14.json](evaluations/quality-regression-2026-10-14.json).

No commit, push, or deployment was performed. The deterministic display improves
transparency, not the model's factual accuracy. Further work should target
explicit owner/state/candidate bindings in public claims with a measured pilot,
not another unmeasured instruction expansion. Upper-model testing remains
deferred as requested.
