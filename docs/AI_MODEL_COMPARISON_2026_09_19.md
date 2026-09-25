# PokePilot Model Comparison - 2026-09-19

Started September 19 and completed September 20, 2026 (America/New_York).

## Current Structured-Tactics Rerun - September 20

The focused eight-case comparison was rerun after request v35 began carrying the
current Showdown-derived tactical snapshot: legal Doubles ally targets,
stat-stage interactions, shared-move sequences, field setters, held-item Speed
order, and defensive cover relations. Each case was generated three times with
the evaluation credential, no rules-based fallback, and the same 16,000-token
cap as the earlier comparison.

The final artifact is
`artifacts/ai-evaluation/current-comparison-2026-09-20T05-11-55-006Z` (48
calls). An earlier v35 artifact at `2026-09-20T04-56-03-288Z` is deliberately
excluded: its evaluation browser restored a pre-v35 local team cache, so the
new move mechanics were absent from several inputs. The application and
evaluation path now overlay canonical current Showdown move data on saved team
move entries before building a request; a regression test covers that upgrade
path. The corrected run verified that the focused inputs contain the intended
ally-target, stat-change, shared-Round, field, and defensive-tactics facts.

| Configuration | Earlier frozen result (v34) | Earlier result after validator replay | Current v35 result | Median seconds | p95 seconds | Mean USD/request |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Luna low | 18/24 | 20/24 | 16/24 | 14.25 | 17.90 | 0.00531 |
| Luna medium | 20/24 | 21/24 | 21/24 | 22.04 | 33.06 | 0.00598 |

The current run used 416,362 total tokens and USD 0.12737 for Luna low, and
429,836 total tokens and USD 0.14354 for Luna medium. Relative to the repaired
frozen validator count, Low falls four strict acceptances while Medium is
unchanged. This is not a clean causal measurement of the tactics snapshot
alone: the request version, prompt version (90 to 91), and input size changed
together. The new facts also create more audit links for the strict validator
to check.

Direct review of the focused outputs is more encouraging than Low's aggregate
strict count suggests. Both efforts identified the allied Charm plus Contrary
interaction in all three repetitions. The difficult shared-Round case still
exposes an output-contract weakness: Low passed 0/3 and Medium passed 1/3
strictly, although multiple rejected answers recognized the two-user Round
opening. Their private audits then bound a participant to an action from a
different plan, or attached an ability/item to the wrong owner. These are
blocking grounding mistakes, not transport failures.

For this pair, Luna medium is the quality-first choice: 21/24 strict acceptance
(87.5%) versus Low's 16/24 (66.7%), with no request errors. It costs about
USD 0.00067 more per request (12.7%) and adds 7.79 seconds at the median. The
production default has since been changed to Luna medium for an observation
period; this small, Korean-focused suite alone should not be treated as a final
global quality guarantee. The remaining Round regression needs a
contract/prompt improvement and an unseen-team follow-up. The strict rate
remains a grounded-output reliability signal, not a factual-accuracy score or
a user-facing answer-quality grade.

## Validator Fix Follow-up - September 20

Offline replay of the same 144 saved outputs after fixing Unicode held-item
speed multipliers and single-Pokemon negative coverage warnings introduced no
new strict rejections. Four previously rejected outputs now pass: main-run
065, 102, 104, and 105. Updated strict counts are Luna low 20/24, Luna medium
21/24, Luna high 22/24, Terra low 22/24, Terra medium 23/24, and Sol medium
24/24. These are validator acceptance counts, not factual accuracy scores.

The original results below and saved artifacts remain unchanged. No additional
model calls were made. Regression coverage includes ASCII/Unicode multipliers,
English/Korean negative advice, and mixed positive/negative advice that must
still fail. Full verification: 809 tests, lint, and TypeScript checks passed.

## Results

All 144 retained requests completed without a transport error. This excludes the
initial archived timeout and interrupted requests described below. Acceptance is
the unmodified strict validator result, not factual accuracy or production fallback
frequency. Production uses `reviewHostedCopilotAnalysis`, which can retain an answer
with a grounding warning even when strict evaluation rejects it.

| Configuration | Strict accepted | Median seconds | p95 seconds | Mean USD/request | Total USD/24 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Luna low | 18/24 | 14.2 | 19.1 | 0.00451 | 0.10834 |
| Luna medium | 20/24 | 25.2 | 34.1 | 0.00619 | 0.14850 |
| Luna high | 22/24 | 89.4 | 115.7 | 0.01501 | 0.36014 |
| Terra low | 21/24 | 28.4 | 50.9 | 0.05575 | 1.33796 |
| Terra medium | 23/24 | 42.1 | 54.1 | 0.06360 | 1.52629 |
| Sol medium | 24/24 | 52.9 | 64.9 | 0.12292 | 2.95009 |

Returned-usage estimated total: **USD 6.43132**. This includes reasoning tokens
and reported cache reads/writes. Actual invoice charges may be higher because
unreturned usage from initial timeout/interruption is not available. Median is
the average of the two middle observations; p95 uses nearest rank. Repeated
cached prefixes and this small case mix are not a production monthly forecast.

Pricing references checked during the run: [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna),
[Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

Two narrowly defined content checks illustrate why strict acceptance is insufficient.
These count explicit descriptions in the public answer, including rejected answers;
they do not score every aspect of strategy or establish general model accuracy.

| Configuration | Allied Charm + Contrary described | Both protected Nasty Plot and Calm Mind branches described |
| --- | ---: | ---: |
| Luna low | 2/3 | 0/3 |
| Luna medium | 3/3 | 1/3 |
| Luna high | 2/3 | 0/3 |
| Terra low | 2/3 | 2/3 |
| Terra medium | 3/3 | 2/3 |
| Sol medium | 3/3 | 3/3 |

## Scope and Reproduction

This is a quality-first pilot, not a production rollout or a general model
leaderboard. All requests use the explicitly configured evaluation credential.
No separate model grades the answers. Review combines the existing deterministic
validator with direct reading of user-facing answers and their supplied inputs.

The five requested configurations are Luna low/medium/high and Terra low/medium.
Sol medium is an additional reference. Each configuration receives the same eight
frozen requests three times: six team analyses, one selected-Pokemon analysis,
and one Pokemon recommendation. All requests are Korean. Sample optimization,
English responses, and a broad unseen M-C roster are outside this pilot.

The evaluation runner is `scripts/compare-ai-models.ts`. It reconstructs requests
from prior evaluation fingerprints, preserving their normalized fields (including
team-scope selectedSlot and Pokemon-scope teamName), rather than fetching changing
live usage data. Manifests retain full requests and SHA-256 hashes. Evaluator
expectations are not sent to the model. Prompt version is 90. Output cap is 16,000
tokens for every candidate, with Standard processing and no rules-based fallback.
Configurations rotate order between repetitions; this is not a blinded or
randomized study. Shared prefix caching is allowed.
Each process uses three concurrent requests, and the Sol reference runs overlap
part of the main run. Latencies are observed wall times, not an isolated service
benchmark; provider load and prefix-cache warming are confounders. Sol input
hashes were checked against the main manifest and all eight match.
The 16,000-token comparison cap is intentionally larger than production's
3,500-token Luna low default; these results are not measurements of the currently
deployed token budget. No repair-generation pass is included.

Local raw artifacts, excluded from Git:

- Five configurations: `artifacts/ai-evaluation/comparison-2026-09-20T03-34-44-678Z`
- Sol team cases: `artifacts/ai-evaluation/comparison-2026-09-20T03-39-35-907Z`
- Sol other scopes: `artifacts/ai-evaluation/comparison-2026-09-20T03-50-18-763Z`

The first process used the adapter's 60-second timeout and one SDK retry. A Luna
high request timed out, so the run resumed with a 180-second timeout and zero SDK
retries, retaining successful and validation-rejected outputs. The timed-out
record is archived. Three in-flight requests were interrupted at restart. Usage
estimates from returned responses do not include unreported timeout/interruption
charges; they are not a reconciliation of the provider invoice. Earlier retained
requests used the same prompt, payloads, cap, and model settings, but the initial
transport policy differed.

## Findings to Preserve

Strict acceptance is **not semantic accuracy**. The validator can accept false
prose and reject correct prose. Do not describe its pass rate as accuracy.

| Artifact | Configuration | Observation |
| --- | --- | --- |
| Main `001.json` | Luna low | Incorrectly discounts Tailwind in Singles by treating allies as excluding its user. |
| Main `004.json`, `043.json` | Terra low | Incorrectly says Dark opponents prevent Prankster Tailwind. Tailwind does not target those opponents. |
| Main `005.json` | Terra medium | Also generalizes the Prankster/Dark restriction to Tailwind. |
| Main `011.json` | Luna low | Suggests Tailwind when its only owner, Whimsicott, is not selected. |
| Main `013.json` | Luna high | Misses allied Charm + Contrary as the central Staraptor interaction. |
| Main `018.json` | Luna high | Describes protection/Tailwind but misses the central Nasty Plot/Calm Mind setup plan. |
| Main `024.json` | Terra low | Invents Psychic immunity for Hisuian Zoroark and a Dark weakness for Gardevoir; rejected by the validator. |
| Main `035.json` | Terra medium | Correctly warns against switching Mega Dragonite into Ice, but the validator treats that mention as positive coverage advice. Other evidence-link omissions also occur, so not every rejection on this record is a false positive. |
| Main `036.json` | Luna low | Calls Maushold's redirection Rage Powder while its supplied move is Follow Me. |
| Main `050.json` | Luna low | Warns that Garchomp's Earthquake damages its Flying-type Charizard partner; also reuses Mawile as both lead and reserve. |
| Main `051.json` | Luna medium | Says both Garchomp and Basculegion supply physical spread attacks, although Basculegion's selected attacks are single-target. |
| Main `052.json` | Luna high | Names a four-member alternative without Staraptor, then instructs replacing Staraptor in that alternative with Skarmory. |
| Main `060.json` | Luna low | Suggests Incineroar as a pivot to absorb Rock pressure despite the supplied Rock weakness. |
| Main `067.json` | Luna high | Replaces Ninetales with Basculegion in a four-member lineup that already contains Basculegion, creating a duplicate rather than a usable four-member selection. |
| Main `078.json` | Terra low | Invents a 4x Grass weakness for Wash Rotom (2x); the candidate input only states a Grass weakness, without a multiplier. Strict validation accepts this answer. |

Sol's three team repetitions consistently identify allied Charm/Contrary, the
protected setup win condition, and the Pixilate Round chain. The Illusion disguise
varies: apparent Armor Tail or baiting a Ghost attack with a Dragapult disguise.
Different plausible plans should not be penalized merely for differing from a
fixture's preferred example. This observation is not a guarantee of error-free
answers on unseen teams.
Language polish is not perfect either: one Sol recommendation calls Reflect/Light
Screen setup a literal "screen" translation, and one Pokemon answer retains
English "Stat Points". Several models repeat a generic Yawn-to-Whirlwind loop
without explaining when forcing a switch is worth giving up the pending sleep.
These need practical and localization review, not only schema validation.

## Input and Validator Confounders

The prompt requires models to treat missing effects as unknown and not replace
missing mechanics with remembered knowledge. However, selected mechanics often
contain only short descriptions:

- `src/api/showdownData.ts` prefers `shortDesc` over `desc` for moves.
- `src/api/showdownCatalog.ts` prefers short descriptions for abilities.
- `src/utils/copilotMechanics.ts` additionally limits effect text to 500 characters.
- Frozen Rain Dance text only says rain powers Water moves. It omits Fire reduction.
- Snow Warning only says it activates on switch-in; generic Mega ability acquisition
  and activation timing are not explicitly supplied.
- Tailwind's text says allies have doubled Speed without explicitly spelling out
  own-side/user targeting. Prankster's opponent-target restriction can be overextended.

Some Terra answers explicitly decline to infer Mega weather activation timing.
That is consistent with the missing-effect instruction, not automatically a
model hallucination. Likewise, failing to name the fixture's specific anti-sun
opponent is not proof of failure when that opponent's relevant effects are absent
from the request. Improve neutral mechanics and align evaluator expectations with
the actual model inputs before drawing strong conclusions about reasoning limits.

The defensive-coverage validator in
`src/utils/copilotStrategyAuditCandidateValidation.ts` applies positive resistance
evidence requirements to all mentioned teammates in a coverage recommendation,
without distinguishing a warning against using one of them. Keep this as a
regression case. Do not simply disable grounding validation to raise pass rates.

A second confirmed validator defect is in `copilotStrategyAuditCore.ts`:
`getUnconditionalItemSpeedMultiplier` recognizes ASCII `1.5x`, but the frozen
Choice Scarf effect uses Unicode `1.5\u00d7`. It therefore compares raw Speed 155
against Dragapult's 213 instead of applying the item. The supplied modifier makes
Zoroark faster; several rejected speed assertions are correct, even when the rest
of the analysis has strategic problems.

An offline control replaces only that character in a cloned validator input; it
does not regenerate responses, edit saved artifacts, or alter the production
validator. Main records `065`, `102`, `104`, and `105` change from strict rejection
to full strict acceptance. Other records retain independent audit errors. Thus
at least four rejections cannot be attributed purely to model failure. The
normalization control does not certify those answers' semantic quality.

Reproduce final aggregate statistics and the control without any API key or calls:

```powershell
npx tsx scripts/review-ai-comparison.ts artifacts/ai-evaluation/comparison-2026-09-20T03-34-44-678Z artifacts/ai-evaluation/comparison-2026-09-20T03-39-35-907Z artifacts/ai-evaluation/comparison-2026-09-20T03-50-18-763Z
```

No prompt, mechanics payload, or validator was changed during the frozen run.
Production model selection and deployment are unchanged.

## Release Decision

Quality-first provisional preference: Sol medium. Terra medium is the narrower
cost/latency alternative to re-evaluate after input and validator fixes. Luna high
is not a reliable substitute for moving to a stronger model: substantial extra
reasoning time still leaves missing central interactions and invalid lineup prose.
Do not promote a configuration solely because its JSON/audit acceptance improved.

Before rollout:

1. Supply neutral, sufficiently complete mechanics, including exact targets,
   priority, field effects, and Mega ability activation semantics. Avoid inserting
   fixture-specific strategy answers into production prompts.
2. Fix the negative-mention defensive-coverage false positive with regression tests,
   handle Unicode item multipliers, and check concrete public claims against the
   structured audit. Keep hard ownership,
   typing, form, and lineup checks rather than bypassing them for a higher pass rate.
3. Test unseen Singles/Doubles teams, English, new M-C forms, and sample optimization.
   Compare Sol medium and Terra medium again on identical corrected inputs.
4. Align generation timeout/output cap and end-to-end request handling with observed
   latency. Sol exceeded 60 seconds in 5 of 24 completed requests in this pilot.
5. Do not silently replace a failed AI result with a canned strategic answer. A
   bounded AI repair/retry and an honest retryable error state are preferable,
   but require their own quality and latency validation before release.

The direct evaluation bypasses account quotas, Redis, D1, and the production
analysis endpoint; provider API usage is charged to the evaluation credential.

## Verification

- Full unit suite: 112 files, 808 tests passed.
- TypeScript project build and ESLint passed.
- Completed-record resume exercised without repeating API calls.
- Raw outputs and frozen inputs retained locally; no commit, push, or deployment.
