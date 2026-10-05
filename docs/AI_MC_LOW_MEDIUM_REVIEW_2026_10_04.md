# M-C Low Versus Medium: Quality and Before/After Cost

## Method

This follow-up evaluates the current v99 product pipeline with GPT 6 Luna
medium on the same 40 requests previously evaluated with low: five Singles
and five Doubles teams, four scopes each. Source teams and reconstruction
limitations are in [the expanded review](AI_MC_EXPANDED_REVIEW_2026_10_04.md).
Public Doubles sheets omit Stat Points; zero-point reconstructions are not the
players' actual spreads. Korean outputs only, selected Pokemon only, and no
matchup-scope or multi-seed accuracy study are claimed.

The before/after cost comparison uses the original four teams and 16 scopes,
not all 40 new outputs against 16 older outputs. "Before" means v93 at commit
`046c47483eb334a2fd75776c61fbe0f5b1d0c94f`, before this published-team prompt/input
improvement series. "After" means v99 with verified fresh detailed mechanics.
Original low results are historical. No original medium results existed, so
the original adapter, prompt and serializer were restored into an ignored
evaluation-only directory and run against the saved original request JSONs.
Production files were not rolled back and no production credentials were used.

This is a product-pipeline comparison, not a prompt-only ablation. It includes
the low-only inline representation, detailed move descriptions, cache migration
and the corrected Lucario Z projection in four cases. The machine-readable
report also excludes those four cases as a sensitivity check. Current medium
retains shared-reference encoding, as in the actual product; it does not use
the new low-only repeated owner-local mechanics.

Provider-reported usage is retained. Reasoning tokens are part of output
tokens and are not added twice. Estimated costs use the repository's Luna
price table, not invoices. A second calculation charges all input at the
ordinary uncached rate and removes cache read/write pricing differences;
this normalized figure is a comparison aid, not an observed bill. Runs were
sequential, but cache state, service load and generated output length vary.
One response per case/condition cannot establish a stable accuracy percentage.

The result artifact is
[mc-low-medium-2026-10-04.json](evaluations/mc-low-medium-2026-10-04.json).
Its quality groups overlap the 16-case comparison groups and must not be
summed as separate paid calls. Provider response IDs and credentials are omitted.

## Review Rules

Review public paragraphs and recommendation reasons, not only private audit
warnings. Distinguish a fact correctly explained from a wrong claim merely
not repeated. New medium errors count even when it fixes a known low error.
Do not silently repair stored model responses or turn a warning-free result
into a claim of factual accuracy.

## Qualitative Findings

The following are observations from individual v99 low/medium outputs, not
permanent capability claims or an accuracy percentage:

| Case | Low observation | Medium observation |
| --- | --- | --- |
| Mugepome team | Cites absent Archaludon's Electro Shot in its selected trio | Includes Archaludon in the rain trio and connects rain to its actual move |
| Mugepome Pokemon | Calls Dark Pulse a Ghost attack | Does not repeat that claim, but does not explicitly explain Dark Pulse's type either |
| Danjinesu recommendation | Calls Wash Rotom's Volt Switch Flip Turn | Correctly names Volt Switch and Levitate, but wrongly calls Primarina Grass-resistant in the same recommendation |
| Kiran recommendation | Calls Charizard Ice-weak | Does not repeat that weakness claim; this is non-recurrence, not an explicit correction |
| Rios team | Invents a blanket same-turn Tailwind order restriction | Describes Tailwind support without that restriction; does not explain exact turn-order timing |
| Tagerau optimization | Retains Aerilate Double-Edge but proposes Fire Blast to Roost | Explicitly weighs the lost special coverage and ranks keeping the current mixed set first |
| Liuzzo team | Correct switch-out counter removal and Soundproof value | Also correct, with a four-member lineup and an explicit warning that Gengar leaving weakens trapping |
| DDee team | Generic terrain/Fake Out and Mega-branch advice | Identifies Grassy Terrain, Grassy Seed consumption and Unburden as the main opening chain |
| Lloyd team | Says sand can break Excadrill's Focus Sash despite immunity | Explicitly says sand alone does not break its full-HP condition; also explains Psychic Seed/Unburden |
| Lloyd optimization | Calls `usage-move-scald-1` a Hypnosis replacement | Correctly identifies the candidate as replacing Muddy Water and retaining Hypnosis/Coil; verified against `moveChanges`, not inferred from the ID |

New or persistent medium problems must not be hidden by those positive cases:

- Nautilasu Pokemon: Wish is described as healing half the recipient's maximum
  HP. The supplied canonical effect says half the user's maximum HP. The
  position-based transfer is correct; the numeric basis is not.
- Danjinesu recommendation: Primarina is said to resist Grass while explaining
  how to cover Wash Rotom. Primarina is Grass-weak.
- Tagerau team: replacing Sylveon with Kingambit is said to also lose Swampert's
  Stealth Rock and Flip Turn, although Swampert remains in the selected trio.
  This is still an owner/lineup consistency failure.
- Liuzzo Pokemon: a public paragraph contains English drafting instructions
  beginning with an item-name correction and instructions to avoid names.
  Its private validation warnings are empty and the reviewed public output is
  identical, so the existing product validation would not remove this leak.
- Kiran optimization: a public paragraph prints `usage-spread-1`. Existing
  post-processing flags `content-repaired` and replaces the whole paragraph
  with generic text. The raw and reviewed versions are both retained in the
  artifact; the useful detail loss is not counted as a perfect output.
- DDee recommendation: says Wide Guard should be used on a different turn
  from allied Make It Rain or Dazzling Gleam because it blocks those attacks.
  Wide Guard protects its own side; it does not cancel allied attacks aimed
  at opponents. This is a new operationally harmful misunderstanding.
- Lloyd recommendation: the `sinistcha` card and its prose call Sinistcha
  Golisopod ("갑주무사") while assigning it Hospitality and Rage Powder. The
  candidate ID and canonical supplied name are correct; public naming is not.

All 80 current low/medium input hashes match their saved request JSONs. Thus
the move-change discrepancy above is a model interpretation difference, not
different optimization candidates. The latest historical low report did not
previously identify this particular move-slot error; the direct input check
in this follow-up supplies the correction.

## Current Pipeline: 40 Matched Cases

| Metric | Low | Medium |
| --- | ---: | ---: |
| Completed / attempted | 40 / 40 | 40 / 40 |
| Input tokens | 884,806 | 719,496 |
| Cached input tokens | 195,465 | 183,517 |
| Cache-write tokens | 0 | 11,948 |
| Output tokens, including reasoning | 61,233 | 179,393 |
| Reasoning tokens, subset of output | 12,370 | 120,778 |
| Total tokens | 946,039 | 898,889 |
| Estimated recorded cost, USD | 0.10150525 | 0.14542827 |
| Normalized no-cache cost, USD | 0.11909710 | 0.16164610 |
| Median response time | 12.525 s | 35.1095 s |
| Private-warning responses | 9 | 5 |

Medium used about 5.0% fewer total tokens because its input remained compact,
but its recorded estimated cost was 43.3% higher and normalized cost 35.7%
higher. Output tokens cost more than input tokens. Median latency was 2.80x.
The 9-versus-5 warning count is structural/private validation, not factual
accuracy: serious public mistakes above had no corresponding warning.

Per-scope current-pipeline averages use ten cases each. Time is the median;
cost is the mean of the recorded usage-based estimates, including cache effects.

| Scope | Low USD/call | Medium USD/call | Cost ratio | Low median | Medium median |
| --- | ---: | ---: | ---: | ---: | ---: |
| Team | 0.00236108 | 0.00447859 | 1.90x | 16.42 s | 45.11 s |
| Pokemon | 0.00189151 | 0.00259678 | 1.37x | 10.44 s | 25.51 s |
| Pokemon recommendation | 0.00391429 | 0.00507714 | 1.30x | 13.88 s | 48.84 s |
| Sample optimization | 0.00198365 | 0.00239031 | 1.21x | 8.51 s | 20.73 s |

Qualitatively, medium explains some tactical chains and tradeoffs better and
corrects particular low errors, notably Excadrill's sand immunity. It is not
a reliable remedy for public factual accuracy: new typing, ownership, Wide
Guard, naming and drafting-leak failures remain. Do not promote the default
model or promise an accuracy improvement based on this single exploratory run.

A spot check of restored v93 medium also shows non-monotonic outcomes: its
DDee recommendation described Wide Guard normally, while v99 medium invented
the allied-offense restriction. The original Tagerau optimization ranked the
current set first but still offered removing Aerilate Double-Edge; v99 medium
more explicitly preserves that main attack. These single samples neither
isolate a causal prompt effect nor support claiming every new instruction
improves both effort levels.

## Before/After: 16 Matched Cases

These totals cover the same original four teams, v93 to v99. They include
prompt and input-pipeline changes together, not just extra instruction text.

| Metric | Low before | Low after | Change | Medium before | Medium after | Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Input tokens | 266,996 | 353,279 | +32.32% | 266,996 | 287,448 | +7.66% |
| Output tokens, including reasoning | 21,900 | 24,811 | +13.29% | 69,687 | 73,534 | +5.52% |
| Reasoning tokens, subset of output | 5,839 | 5,148 | -11.83% | 45,780 | 50,341 | +9.96% |
| Total tokens | 288,896 | 378,090 | +30.87% | 336,683 | 360,982 | +7.22% |
| Recorded estimated cost, USD | 0.03230438 | 0.04069666 | +25.98% | 0.05619788 | 0.05847506 | +4.05% |
| Normalized no-cache cost, USD | 0.03764960 | 0.04773340 | +26.78% | 0.06154310 | 0.06551180 | +6.45% |
| Median response time | 14.0075 s | 12.6125 s | -9.96% | 37.0775 s | 35.329 s | -4.72% |

The observed median decreases are not evidence that longer prompts speed up
the service. Runs occurred at different times and generated different outputs.
Low's input grew more because it now expands shared records and repeats local
mechanics; medium retains reference-based compression. Both receive updated
instructions and detailed move effects.

Excluding all four Lucario cases affected by the Mega projection correction
leaves twelve matched cases. Low's total tokens/cost/no-cache cost change by
+32.49%/+32.15%/+28.17%; medium's by +8.29%/+8.59%/+8.68%. The qualitative cost
conclusion remains: the input changes raise low costs more than medium costs,
but the exact percentage depends on case mix and cache state.

## Execution and Verification

- New paid calls in this follow-up: 56 medium calls, all completed, no retries
  or failed requests. Forty current quality cases plus sixteen baseline cases.
- Known usage total for these new calls: 1,235,572 tokens, USD 0.20162615
  estimated at repository rates. Historical low calls are not charged again.
- Verified all 80 current low/medium input hashes; verified all sixteen restored
  baseline medium input hashes, v93 metadata and medium effort.
- Evaluation runner lint and project TypeScript build check passed. The product
  code was not changed in this follow-up; the prior full 1,217-test check is
  historical, not a newly rerun full test suite.
- Only the evaluation runner and evaluation reports/artifacts changed in this
  follow-up. No default-model change, commit, push or deployment was performed.

## Reproduction

The runner accepts `--effort=medium` and an optional evaluation-only
`--adapter=<restored-adapter-path>`. Its default remains low/current code.
Use saved original requests for v93 and saved fresh requests for v99;
regenerating original requests with current code would invalidate the baseline.
Use a new phase for repeats because existing results are not overwritten.

```text
npx tsx scripts/run-mc-published-evaluation.ts --output=.tmp/mc-medium --requests=requests-after --phase=after-medium --effort=medium --run
npx tsx scripts/run-mc-published-evaluation.ts --output=.tmp/mc-medium --requests=requests-before --phase=before-medium --effort=medium --adapter=.tmp/mc-medium/baseline/openAiLuna.ts --run
```
