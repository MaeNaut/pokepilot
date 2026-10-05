# Recommendation Data A/B Review (2026-10-05)

## Decision

- Keep the expanded general sample candidate pool: it makes current-nature alternatives available and the model uses them. This is an improvement in available choices, not proof of globally more accurate prose.
- The Pokemon recommendation expansion has **not demonstrated a quality gain** in this trial. Do not expand it further on the assumption that more input necessarily helps. The existing bounded enrichment remains in the working tree; no silent rollback or production promotion was made.
- Fix one verified input defect: Psychic Surge/Psychic Terrain were missing from priority-denial responsibility classification. Supply canonical grounded-target terrain conditions as well as the role count.
- Keep Luna low/optional medium, compact encoding, existing prompts and validation behavior. No Sol, paid AI judge, prose replacement, or new fallback was introduced.
- No commit, push, or deployment was performed.

## Method

The main experiment used 48 evaluation-key calls: four public M-C teams, Pokemon addition and general sample recommendation, two data conditions, three repetitions. All calls used `gpt-6-luna`, low effort, prompt v102, an 8,000-output-token limit, and zero automatic retries. All 48 returned usable output.

| Team | Format / language | Sample target |
| --- | --- | --- |
| Tagerau | Singles / Korean | Mixed Salamence |
| Danjinesu | Singles / English | Substitute Salamence |
| Kiran Singh | Doubles / Korean | Charizard |
| Lloyd Villar | Doubles / English | Milotic |

Pokemon addition used the same five-member team and **identical 30-candidate shortlist** in both arms. The only request change was omission/presence of `usageOptions`. This isolates extra detail, not the entire historical candidate-ranking pipeline.

Sample recommendation used the same source snapshot and actual current build, with the pre-expansion selection rules versus the expanded rules. The former produced 11-12 candidates, the latter 24. The baseline reconstruction preserves the earlier partial-point allocation, current-nature inheritance, role-stat, and usage-form provenance fixes. It is not an unchecked checkout of an older commit and not a slice of the first 12 expanded candidates.

Developer messages, output schema, and generation settings were checked for equality. Requests and provider parameters were frozen and hashed, arm order alternated, and each result was written once. Every raw output was manually compared with supplied facts; review was not blinded. The raw and publicly reviewed analysis text and recommendation lists were identical in all 54 calls, including the follow-up below.

Some tournament sources omit allocations; the corresponding fixtures contain zero points. Those are evaluation inputs, not claims about the players' actual tournament spreads. This trial does not cover full-roster replacement or matchup-specific sample optimization.

## Tokens, Cost, And Time

Means across 12 calls per cell:

| Scope | Condition | Input tokens | Output tokens | Estimated billed cost | No-cache equivalent | Wall time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Pokemon | Representative data only | 27,153 | 1,536 | $0.003001 | $0.003483 | 12.30 s |
| Pokemon | Expanded data | 61,184 | 1,435 | $0.006404 | $0.006836 | 11.76 s |
| Sample | Previous selection | 17,859 | 750 | $0.001746 | $0.002161 | 7.63 s |
| Sample | Expanded selection | 21,896 | 748 | $0.002133 | $0.002564 | 7.18 s |

- Pokemon input increased **125.3%**; no-cache-equivalent cost increased **96.2%**.
- Sample input increased **22.6%**; no-cache-equivalent cost increased **18.7%**.
- The small observed latency decrease is not evidence that larger inputs are faster. Output variability, cache behavior, and service timing are not controlled enough for that claim.
- Main comparison total: **$0.159408**. Targeted six-call follow-up: **$0.037749**. Total: **54 calls, $0.197158** estimated.

Costs use response usage and the repository adapter's existing rates, not an invoice or a newly verified price sheet. The no-cache equivalent treats all input as ordinary input and excludes cache-write pricing, making the data-size comparison less dependent on warm-cache ordering.

## Findings

### Expanded Sample Choices Are Used

Expanded-only candidates were selected in **9/12** sample outputs:

- Tagerau: all three chose the new Naive Attack-focused spread, keeping the current nature and Speed while explicitly trading some Special Attack.
- Kiran: all three chose a Timid Special Attack/Speed spread that the old pool lacked. Two also compared the new bulkier Timid alternative.
- Lloyd: all three chose the new Calm HP/Special Attack spread while retaining the current moves. One also compared a Calm HP/Defense spread.
- Danjinesu: the selected alternatives were already in the old pool; extra candidates did not establish a benefit here.

These are evidence of useful option availability. They do not establish which spread wins more games without matchup benchmarks or justify replacing the original teams' purposes automatically.

### Extra Pokemon Statistics Are Not Yet Earning Their Input Cost

None of the 12 expanded Pokemon outputs cited a `usage-move`, `usage-item`, or `usage-nature` audit fact. Manual review likewise found explanations mostly using the representative set and existing fit signals. Absence of an explicit citation cannot prove the model ignored the extra data internally, but the trial does not demonstrate a meaningful quality improvement.

Keep access to bounded source details available; a future experiment should test **selecting relevant alternatives**, not another blanket increase in moves, spreads, or candidate count. Do not infer that the original shortlist rankings are optimal from this detail-only ablation.

### Prose Contradictions Remain

Confirmed examples are preserved in the machine-readable evidence:

| Output | Confirmed issue |
| --- | --- |
| Tagerau sample, before r1 | Says Fire Blast is retained while adding Roost, then says Fire Blast is lost. It conflates the standard and spread-only candidates. |
| Tagerau Pokemon, before r3 | Calls Rotom Wash's pivot move U-turn in the paragraph/title, while the actual set and reason have Volt Switch. |
| Lloyd Pokemon, before r2 | Attributes an Ice weakness to Farigiraf; supplied weaknesses are Bug and Dark. |
| Danjinesu sample, after r3 | Says no faster spread retains all current moves, then recommends exactly that candidate (`usage-spread-1`). |
| Kiran sample, after r3 | Says Timid raises both Special Attack and Speed; the nature raises Speed, while Special Attack investment is a separate change. |
| Lloyd Pokemon, after r2/r3 | Says the current team lacks priority denial, following an incorrect input summary despite Psychic Surge being present. |

In this limited review, outputs with confirmed issues were Pokemon **2/12 before and 2/12 after**, sample **1/12 before and 2/12 after**. These small, correlated observations are not general accuracy estimates or evidence that expansion causes more errors. Ambiguous wording, strategic disagreements, and omissions are recorded separately rather than counted as factual contradictions.

The earlier Milotic smoke-test claim that no HP/Special Attack spread retained the moves did not recur in its three expanded repetitions. The **same error class did recur in Danjinesu**, so it is not resolved.

The sample outputs all passed structural audit, including the contradictory ones. Pokemon outputs with raw audit errors were 7/12 before and 11/12 after; after the existing exact-reference completion, 2/12 and 1/12 still had errors. Audit completion did not edit prose or drop recommendations. Those numbers are not factual-accuracy scores.

## Verified Input Fix And Follow-Up

`inferCopilotResponsibilities` did not classify Psychic Surge or the selected Psychic Terrain move as priority denial. Consequently Lloyd's input explicitly reported a count of zero. The ability description only said that Psychic Terrain was summoned; it omitted the field's targeting conditions.

The patch:

1. Counts Psychic Surge/Psychic Terrain as an **available, conditional** priority-denial role, without treating other terrains as equivalent.
2. Appends the canonical Psychic Terrain detailed description to Psychic Surge mechanics. This preserves the grounded-target restriction and allied-target exception through existing size limits.
3. Does not invent Psychic Terrain as a selected move or claim airborne allies receive its protection.

The production request builder was rerun on Lloyd with the frozen candidate shortlist. An exact comparison confirmed only two changes: `diagnostics.responsibilityCounts.priority-denial` from 0 to 1, and the Psychic Surge effect text. The new input adds **98 tokens**, not another large context expansion.

A fresh three-repeat paired follow-up used six more Luna low calls. The explicit absence claim appeared in **1/3 before and 0/3 after**; it had also appeared in 2/3 of the main expanded-data runs. This supports the input correction but is not a statistically established prose fix. The new outputs still do not consistently explain how Armor Tail differs from terrain protection.

Another unresolved error appeared in one output in **each** follow-up arm: Sinistcha's Ice weakness was described as new to a roster that already contains 4x-Ice-weak Salamence. This points toward ambiguous interpretation of existing versus unanswered weaknesses and should not be hidden by broad prose rewriting.

## Verification And Evidence

- Full test suite: **1,262 tests / 156 files passed**.
- ESLint, TypeScript/Cloudflare build, and diff whitespace checks passed. Existing large-bundle and experimental SQLite warnings remain; no new build failure was introduced.
- Regression tests cover the role mapping, unrelated terrains, duplicate counting, actual request role totals, canonical detailed conditions, and no fabricated selected move.
- Evaluation runner checks frozen inputs/settings, baseline current-build invariants, schema validity, and request size before paid calls.
- Machine-readable raw outputs, usage, selected candidate facts, review annotations, and manifests: [recommendation-data-2026-10-05.json](evaluations/recommendation-data-2026-10-05.json).
- Reusable runner: `scripts/run-recommendation-data-evaluation.ts`.
- Local full requests/provider parameters/source snapshots: `.tmp/recommendation-data-ab-2026-10-05/` and `.tmp/recommendation-priority-ab-2026-10-05/`. Secrets are not recorded in these artifacts.

Next priorities are consistency between selected candidates and their explanations, and accurate distinction between **existing**, **unanswered**, and **newly introduced** team weaknesses. Neither is solved by counting validator passes or appending more prompt instructions.
