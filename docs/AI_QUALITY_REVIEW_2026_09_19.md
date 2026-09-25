# Hosted AI Quality Review - 2026-09-19

## Verdict

Quality issues reproduced. Do not interpret an evaluation `complete` status as
a semantic-quality pass. Production model/reasoning defaults were not changed
and nothing was deployed. No second AI model was used to grade answers.

Base revision: main 59a1063. Model: gpt-5.6-luna. Prompt: 90.
Requests used the production builders with current M-C data and existing
historical regression rosters. Locale: Korean. Each case/configuration ran once;
these are diagnostic observations, not statistically reliable success rates.

## Live Runs

| Suite | Effort | Output cap | Strict validation | Estimated USD |
| --- | --- | ---: | ---: | ---: |
| Singles/doubles smoke | low | 3500 | 2/2 | 0.009401 |
| Complex team interactions | low | 3500 | 2/4 | 0.018226 |
| Selected Pokemon regressions | low | 3500 | 4/6 | 0.019831 |
| Candidate recommendations | low | 3500 | 4/4 | 0.022647 |
| Complex team interactions | medium | 3500 | 0/4 | 0.024037 |
| Complex team interactions | medium | 8000 | 3/4 | 0.023459 |

24 API evaluations; estimated total $0.117601 using repository pricing.
This is not a provider billing reconciliation. Low's 12/16 strict passes do
not imply 75% semantic accuracy. Medium/3500 exhausted the output cap in all
four cases and returned unparseable JSON. Medium/8000 removed this truncation,
but retained factual and strategic errors. Complex-suite average latency was
16.8 seconds for low and 21.7 seconds for medium/8000.

## Reproduced Findings

1. **Wrong defensive advice.** Low Pokemon/Hippowdon groups Primarina with
   Grass-switch options despite its supplied Grass weakness. Low team/Floette
   explicitly says Floette is weak to Rock despite the supplied profile.
   Strict validation catches these cases; production
   `reviewHostedCopilotAnalysis` can retain invalid private grounding with a
   `grounding-incomplete` warning instead of rejecting the public response.
   This review establishes an exposure path, not that every failing evaluation
   would be shown unchanged by production's repair pipeline.
2. **Missed central interactions despite strict passes.** Low Staraptor omits
   allied Charm into Contrary and substitutes generic Tailwind offense.
   Low Froslass advises avoiding its Mega form for Rain Dance because it sets
   Snow, overlooking deliberate weather replacement. It also says Poison
   resistance is lacking despite several supplied resistances and Kingambit's
   immunity. These are not simply missing input data.
3. **State/owner/Speed errors.** Zoroark team and Pokemon runs fail final-Speed
   grounding involving Choice Scarf. Medium/8000 still assigns some item or
   ability evidence to the wrong owner/state. Inspect public prose separately
   from private audit errors rather than equating all audit failures to an
   identical user-visible error.
4. **Medium still contains contradictions.** It correctly recognizes allied
   Charm, but the Floette response calls its Special Attack higher than
   Delphox's while quoting 198 versus 215. The Froslass response warns against
   placing three Pokemon in front simultaneously in Doubles. Both responses
   pass the existing strict validator.
5. **Language and strategic depth.** Outputs mix Korean with `opening`,
   `roster`, and `tradeoff`, misspell supplied Pokemon names, and retain a
   supplied untranslated `Family Of Four` label. The last item is an input
   localization issue, distinct from model-generated misspellings. Several
   Pokemon explanations omit key partner interactions. Recommendation's 4/4
   strict passes still include potentially misleading partner claims: a
   third support cannot accompany two simultaneous Round users.

## Changes Made

- All three evaluation CLIs require OPENAI_EVALUATION_API_KEY and cannot fall
  back to OPENAI_API_KEY. Secrets were not printed or committed.
- Added credential isolation regression coverage and updated setup docs.
- Medium reasoning gets an 8000-token output cap; the current production
  default is medium for an observation period, while low remains available for
  explicit evaluation and lower-cost experiments. Added tests for both budgets.
- Lint and all 803 tests across 112 files passed.

## Next Quality Work

Prioritize factual rejection/repair over adding more generic prompt text.
Separate genuine contradictions from recoverable missing audit details;
introduce a bounded correction pass or an explicit quality failure for the
former. Preserve cost accounting for every attempt. Strengthen public-prose
checks for numeric comparisons, field occupancy, and defensive recommendations.
Compare input representation and model capability with held-out cases before
selecting a new default. Do not hard-code these four fixture answers into prompts.

Sample optimization, English outputs, fresh M-C species, full 24-team baseline,
and repeatability remain untested by live API calls in this review. Existing
unit tests are not a substitute. No quality fix or deployment is claimed.

## Reproduction Artifacts

Ignored local reports under artifacts/ai-evaluation (JSON includes raw outputs,
request fingerprints, validation errors, and usage; Markdown is a readable view):

- luna-low-2-case-2026-09-19T22-09-15-070Z
- luna-low-4-case-2026-09-19T22-10-14-412Z
- luna-low-6-case-2026-09-19T22-10-39-940Z
- luna-low-4-case-2026-09-19T22-11-04-678Z
- luna-medium-4-case-2026-09-19T22-11-59-108Z
- luna-medium-4-case-2026-09-19T22-14-14-675Z

Run `npm run eval:ai`, `-- --strategy`, `-- --pokemon-regressions`,
`-- --recommendation-regressions`, or `-- --strategy --effort medium`.
Original medium/3500 requires the pre-change output cap. Outputs are stochastic.
