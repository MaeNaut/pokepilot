# Input Encoding x Reasoning: Controlled M-C Evaluation

## Design Fixed Before Execution

This comparison uses twelve saved v99 requests, three in each public analysis
scope, across eight published M-C teams. Cases deliberately target observed
errors and non-obvious strategy; this is a stress-test set, not a random sample
of production traffic. Team source/reconstruction limits remain those in
[the expanded review](AI_MC_EXPANDED_REVIEW_2026_10_04.md).

Each case runs twice in all four conditions: compact-low, inline-low,
compact-medium and inline-medium, for 96 paid calls. Condition order rotates
by case and repetition. All calls use GPT 6 Luna, Standard service, the existing
evaluation key and no automatic retry. Stored request facts, v99 common/scope/
locale instructions, schema and 16,000-output-token cap are fixed. Only request
representation and reasoning effort vary. No model is used as an API judge.

Both encodings receive identical instructions explaining references and local
canonical copies. Both explicitly receive the same derived battle-size rules;
this removes the previous product pipeline's inline-only rule-field difference.
Compact records are expanded and deep-compared to the original enriched
request. Removing the inline local canonical copies restores that same request.
The serialized message hash is recorded: low and medium must receive byte-identical
messages within each case/encoding, including both repetitions. The common
cache key is fixed across all four conditions. Cache effects are recorded,
but ordinary uncached input/output pricing is the primary cost comparison.

This measures the two representation strategies, not the exact currently
deployed product payload: the latter uses effort-dependent encoding instructions
and different default output caps. Inline combines reference expansion with
owner-local repetition, so any improvement cannot be assigned solely to either
of those two subchanges. Selected facts are equivalent; their placement differs.

## Review Rubric

Review displayed paragraphs and recommendation text without showing condition
labels. After review, map opaque response IDs back to conditions. Keep the raw
output and post-processed displayed output where they differ. A response counts
as having an identified substantive error when it contains a demonstrably wrong
name/type/effect/owner/selection/candidate change, an internal contradiction,
or exposed drafting instructions. A merely debatable strategy preference does
not count as a factual error. Missing discussion is not a correct demonstration.
Private validation warnings are not an accuracy score.

Specific checks fixed before results are examined:

| Case | Checks |
| --- | --- |
| Mugepome team | Selected trio agrees with cited owners; rain/Electro Shot; nature versus allocation |
| DDee team | Terrain/seed/Unburden chain; legal four-member Mega branches; typing |
| Lloyd team | Excadrill sand immunity and Focus Sash; Psychic Seed/Unburden; conditional speed modes |
| Nautilasu Pokemon | Wish position transfer and user-HP basis; Foul Play attack source; typing |
| Mugepome Pokemon | Special attacks and actual investment; rain Electro Shot; move names/types |
| Liuzzo Pokemon | Mega-only trapping; Perish counter persistence; no drafting leaks |
| Danjinesu recommendation | Candidate identities and owned moves; Volt Switch if selected; defensive typing |
| DDee recommendation | Wide Guard protects own side if selected; terrain/support relations; ownership |
| Lloyd recommendation | Candidate names match IDs; weather effects if discussed; owned support mechanics |
| Tagerau optimization | Actual changed slot; Aerilate main attack tradeoff; mixed-investment interpretation |
| Lloyd optimization | Actual candidate moveChanges; Coil's Defense/accuracy utility; candidate stats |
| Kiran optimization | Weather Ball/Hurricane dual-weather utility; actual changed slot; base versus Mega stats |

Report identified errors per response rather than calling unflagged responses
"accurate". Two draws per case remain too few for a stable production error-rate
estimate. Blinding reduces expectation bias but the reviewer is the same coding
assistant, not an independent human adjudicator. Tactical benefits and omissions
are described with concrete examples rather than an uncalibrated numeric score.

Before unblinding, potentially ambiguous wording findings are marked separately.
Report the main rubric count and a sensitivity count excluding responses whose
only identified error depends on that wording. This avoids making the decision
depend on whether an awkward phrase means stat-point allocation or general role.
Explicitly false mechanics, names, lineup sizes and lost ability effects remain
substantive findings. Review notes record input checks and any corrected finding.

Price normalization uses the repository's Standard short-context rates:
$0.10 per million uncached input tokens and $0.50 per million output tokens.
Output includes billed reasoning tokens; do not add reasoning to output again.
Cache-adjusted estimates include the recorded cache-read/write counts and are
reported separately. These are calculated estimates, not a billing invoice.

## Results

All 96 calls completed and all 96 displayed responses were reviewed. No transport,
timeout or unrenderable-output failures occurred. Message hashes match across
effort and repetition for every case/encoding. Input-token counts also match
exactly between low and medium within each encoding.

The result does **not** support expanding whole-input duplication as a reliable
quality upgrade. Inline adds 23.2% input tokens. At low, unambiguous error-response
counts are identical. Medium shows a clearer reduction than representation changes,
especially for team analysis, but neither effort eliminates factual failures.

Machine-readable evidence, raw/displayed public text, per-response review notes,
usage and message hashes are in
[the frozen comparison](evaluations/mc-encoding-factorial-2026-10-04.json).

### Equal-Weight Summary

Each condition has 24 calls: twelve cases twice. Token/cost values below are
per-call means; latency is the median. Output includes reasoning.

| Condition | Input tokens | Output tokens | Total tokens | No-cache USD/call | Median seconds | Unambiguous error responses | Full rubric count |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compact low | 18,278 | 1,443 | 19,722 | 0.002549 | 11.3 | 7/24 | 9/24 |
| Inline low | 22,524 | 1,441 | 23,966 | 0.002973 | 12.0 | 7/24 | 8/24 |
| Compact medium | 18,278 | 4,960 | 23,239 | 0.004308 | 37.5 | 3/24 | 3/24 |
| Inline medium | 22,524 | 5,106 | 27,631 | 0.004806 | 33.6 | 2/24 | 4/24 |

Five responses have wording-dependent findings and are excluded only from the
unambiguous column. Their full rubric findings and explanations remain in the
data. In particular, whether medium inline looks slightly better or worse than
medium compact reverses with this distinction; a reliable quality win is not
established. Unflagged is not synonymous with correct or complete.

Total recorded cache-adjusted estimated spend was **$0.310773** for 96 calls
(2,269,347 total tokens). The same usage at no-cache pricing is $0.351266.
Cache-adjusted per-condition totals were $0.051217, $0.061077, $0.093752 and
$0.104727 respectively. This interleaved evaluation's cache hit rate is not a
forecast of personal-key production traffic.

### Duplication Versus Compression

| Change, same effort | Input | Total tokens | No-cache cost | Median latency |
| --- | ---: | ---: | ---: | ---: |
| Compact low -> inline low | +23.2% | +21.5% | +16.6% | +5.9% |
| Compact medium -> inline medium | +23.2% | +18.9% | +11.5% | -10.3% |

The additional estimated expense is about **$0.424 per 1,000 low calls** or
**$0.498 per 1,000 medium calls** with this equal-weight case mix and no cache.
Absolute cost is modest, but measurable quality benefit is not demonstrated.
At low, four matched responses have an unambiguous error only in compact and
four only in inline. At medium that split is three versus two, too small to
support a firm representation decision.

Duplication did not meaningfully replace reasoning work: mean reasoning tokens
were 294 versus 283 at low and 3,535 versus 3,532 at medium. The medium latency
advantage is not consistent by scope or repetition, so do not claim duplication
reliably speeds up requests.

### Same Input, Different Effort

| Change | Input tokens | Total tokens | No-cache cost | Median latency |
| --- | ---: | ---: | ---: | ---: |
| Compact low -> compact medium | unchanged | +17.8% | +69.0% | 3.31x |
| Inline low -> inline medium | unchanged | +15.3% | +61.6% | 2.81x |

Output tokens rise by 244-254%, mainly because reasoning tokens are billed as
output. This explains why total-token growth understates cost growth.
The unambiguous error count drops from 7 to 3 with compact and 7 to 2 with
inline. In paired reviews, six low-only flagged responses become unflagged in
either encoding, while two compact-medium-only and one inline-medium-only
failures appear. Medium is a more promising quality lever here, not a guarantee.

### Scope Differences

Six outputs per scope/condition; cells show unambiguous error responses.

| Scope | Compact low | Inline low | Compact medium | Inline medium |
| --- | ---: | ---: | ---: | ---: |
| Team | 3/6 | 3/6 | 0/6 | 0/6 |
| Pokemon | 0/6 | 1/6 | 1/6 | 0/6 |
| Pokemon recommendation | 3/6 | 3/6 | 2/6 | 2/6 |
| Sample optimization | 1/6 | 0/6 | 0/6 | 0/6 |

Team analysis shows the strongest effort-level signal. Recommendation remains
the weakest scope in every condition. There is insufficient evidence to rank
the single-Pokemon conditions from one isolated failure each.

| Scope | Inline input increase | Inline low cost change | Inline medium cost change |
| --- | ---: | ---: | ---: |
| Team | +18.9% | +8.7% | +1.0% |
| Pokemon | +19.6% | +12.9% | +8.8% |
| Pokemon recommendation | +31.0% | +27.9% | +37.1% |
| Sample optimization | +17.5% | +11.2% | -8.1% |

The optimization medium decrease comes from fewer generated output tokens, not
cheaper inline input. Recommendation's large payload/cost increase buys no
observed error-count reduction in this sample.

### Concrete Findings

- Compact low twice struggles with Lloyd's support candidates: Farigiraf's Ice
  weakness is invented once; Helping Hand's action ordering is reversed once.
- Inline low does not reliably solve ownership/selection: Mugepome's named trio
  uses an unselected Rillaboom as a pivot in both repetitions. One answer also
  retains Emergency Exit while describing Mega Golisopod's Tough Claws phase.
- Medium team responses maintain the tested four-member branches and explain
  seed/Unburden or sand roles without an identified substantive error here.
- Compact medium still claims Wide Guard prevents allied Make It Rain, Rock
  Slide and Dazzling Gleam against foes. One Gengar response exposes drafting
  instructions and item-name guesses.
- Inline medium still calls Rotom's Volt Switch Flip Turn and explicitly denies
  the supplied Grassy Seed/Unburden activation in one recommendation each.
- No condition explicitly establishes Wish's **user-max-HP** healing basis in
  these two draws, despite generally getting position transfer right. Missing
  explanation cannot be counted as proof that the fact was understood.

The unambiguous round-1/round-2 counts were compact-low **3/4**, inline-low
**5/2**, compact-medium **2/1**, inline-medium **2/0**, each out of twelve per
round. The low representation ranking reverses between rounds. These are
purposefully difficult cases and repeated draws are not independent new teams;
do not publish these fractions as a production accuracy percentage.

## Decision

1. Do not expand full duplication on the assumption that more repeated facts
   reliably improve low. That benefit was not shown at the measured extra cost.
2. If prioritizing quality, compact medium is the most defensible next candidate
   from this experiment: it improves the tested team reasoning with less cost
   than inline medium. It is still 44.9% more expensive than inline low and
   substantially slower, so this is not a free replacement for the current low.
3. A compact payload with only high-risk owner-specific facts repeated is a
   reasonable **next experiment**, not a proven winner. Test exact move changes,
   active-vs-Mega ability and target-side rules rather than repeating whole
   candidate records. Avoid adding more instructions based on a single failure.
4. No production/default-model or effort-to-encoding policy was changed during
   this evaluation. This evidence alone does not justify silently switching the
   public low/medium interface or deploying a new default.

Verification: twelve compact round trips and inline restoration comparisons
passed; all 24 case/encoding message-hash groups are stable; 96/96 calls and
reviews completed; focused input/prompt/adapter tests **43/43** passed. The
evaluation runner passes ESLint and TypeScript build checking. The initial
sandboxed test launch was blocked by Windows directory access; the authorized
rerun passed. No full product-suite or browser QA rerun was needed for this
evaluation-only change, and no deployment was performed.

## Reproduction

```text
npx tsx scripts/run-mc-encoding-evaluation.ts
npx tsx scripts/run-mc-encoding-evaluation.ts --run
```

The default source is the saved fresh request corpus in
`.tmp/mc-final/requests-v99.json`. Preparation performs equivalence checks without
paid calls. Results and the manifest are written to `.tmp/mc-encoding` and
existing result files are never overwritten. Use a new `--output` directory
for an independent rerun. No default-model or production-setting change is
part of this experiment.

## Subsequent Product Decision

After reviewing this experiment, the user selected compact input for both low
and medium. Prompt v100 implements that policy while preserving explicit
battle-size rules. Low remains the default, medium remains available, and Sol
low remains a future option rather than a new public model choice. This does
not change the v99 measurements above or imply another paid evaluation was run.
The duplicated-input implementation now lives only in the comparison runner.
Reruns use the current prompt, not a frozen v99 prompt: use a fresh `--output`
directory and do not mix those results with this historical report.
