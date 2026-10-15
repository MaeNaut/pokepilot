# Prompt Reduction Review - October 14, 2026

## Decision

Keep only the Singles Pokemon scope correction: do not send the procedure for
simultaneous allied shared-move sequencing to a Singles analysis. Final prompt
version is v109, core v13, Pokemon scope v16. The common instructions, Korean
and English locale instructions, and other scope bodies are unchanged from
v103. The Doubles Pokemon body is also unchanged, apart from its version header.

Rollback both the output/locale duplication reduction and the removal of
set-fact audit instructions from recommendation/sample analysis. Less text did
not provide enough assurance that the explanations remained equally useful.
This is not evidence that longer prompts are intrinsically better or worse.

## Protocol

- No target word count. Test one instruction group at a time.
- Existing evaluation key only; GPT-6 Luna low, Standard, store=false, zero
  provider retries. No production-key calls or private account data.
- Freeze current M-C requests, model settings, compact encoding and strict
  response schema. Repeat each input three times and review every public
  paragraph and recommendation title/reason against its exact supplied data.
- Count responses with confirmed public factual errors, not individual errors.
  Track omissions, unclear wording and private audit flags separately.
- Reject an increase in confirmed errors in the affected matched suite, or a
  repeatedly weaker explanation of a critical strategy. A lower aggregate error
  count does not compensate for losing an important win condition.
- Reuse the previous 30-call current-input baseline. New calls total **90**,
  estimated at **$0.20354207** using the application's usage calculator, not an
  independently reconciled provider invoice.

The main suite covers Singles/Doubles team analysis, selected-Pokemon analysis,
five-member additions, six-member replacements, and sample recommendations.
Five extra strategy fixtures cover allied Charm/Contrary, protected setup aces,
Illusion/Round team and Pokemon analysis, and manual weather counterplay. Some
fixtures originate in older regulations; their current M-C legality was checked.
They are regression inputs, not claims about today's top-ranked teams.

## Trials

| Group | Before / After | Result |
| --- | --- | --- |
| A: duplicate output/style/locale wording | Confirmed errors 4/30 -> 3/30 | Rejected after targeted strategy review |
| A: extra dual-weather repeats | Confirmed errors 0/3 -> 0/3 | Entry/activation wording concern remains |
| A: five strategy inputs | Confirmed errors 4/15 -> 2/15; final audit flags 2/15 -> 4/15 | Setup-win-condition omission 2/3 -> 3/3; reject conservatively |
| B: scope-unused set-fact audit procedure | Confirmed errors 2/18 in A -> 3/18 | Rejected |
| C: Singles-only sequencing omission, with A | Confirmed errors 0/3 -> 0/3 | Require isolated replay after restoring A/B |
| Final C: original common/locale instructions | Confirmed errors 0/3 -> 0/3; final audit flags 0/3 -> 1/3 | Retain narrow format correction; no general accuracy claim |

A initially looked acceptable: input tokens fell 0.88%, and the main suite had
one fewer erroneous response. But the protected Floette/Delphox team omitted
both Calm Mind and Nasty Plot in all three modified outputs. Two outputs shifted
toward a Tailwind/Fake Out identity. Two of three original outputs already
underexplained setup, so this small difference is not proof of causation; it is
insufficient reassurance for accepting the change. Restoring A is conservative.

B introduced these confirmed problems:

- Tinkaton's Fire weakness was described as overlapping Ceruledge's, although
  Ceruledge's supplied profile resists Fire.
- The model said no supplied effect established Aerilate's Normal-to-Flying
  conversion, although that effect was present.
- Current Salamence was said to carry Roost, although it carried Substitute.

All 90 new outputs were renderable. Structural success did not imply factual
correctness. The final C replay's public Speed comparisons were correct, but
one private audit fact reversed Archaludon/Golisopod; the validator flagged it.
That internal regression is recorded rather than counted as a public prose error.

## Final Change Measurements

For the isolated Singles Archaludon input, common+scope instructions fall from
3,139 to 2,830 whitespace-delimited words, including the scope header. This is
an outcome, not a word-count target. Schema, locale and data are excluded from
that word count. Actual full provider input falls **13,385 -> 13,011 tokens**
per call, or **2.79%**.

| Three matched calls | v103 | Final v109 |
| --- | ---: | ---: |
| Input tokens | 40,155 | 39,033 |
| Output tokens | 2,817 | 3,206 |
| Estimated billed cost | $0.004293245 | $0.004433515 |
| No-cache equivalent cost | $0.005424 | $0.0055063 |
| Median duration | 9.116 s | 13.453 s |

Input decreased, but output grew and neither cost nor latency improved in this
small replay. Do not promise a faster or cheaper analysis from this patch.
There is no medium evaluation in this task, and no general accuracy-rate estimate.

## Candidates Not Removed

- Repeated ownership, current/Mega state, defensive relation and selected-move
  checks protect different failure paths; they are not assumed redundant.
- Rare-strategy procedures remain intact. A nonempty tactics list can contain
  ordinary Protect or Weather Ball relationships, while a missing structured
  relationship is not evidence that the mechanic is absent. Request-dependent
  pruning needs its own coverage and experiment; it was not promoted here.
- Imprison-first, beneficiary thresholds and supported-Mega prioritization are
  strategic policy, not pure wording duplication. They remain separate untested
  candidates rather than being silently removed in a length cleanup.

## Evidence And Verification

Machine-readable ledger: [prompt-ablation-2026-10-14.json](evaluations/prompt-ablation-2026-10-14.json).
Previous baseline: [quality-regression review](AI_QUALITY_REGRESSION_REVIEW_2026_10_14.md).
Raw frozen inputs, provider requests/responses and trial prompts remain ignored
under `.tmp/prompt-ablation-2026-10-14/`; no secrets are recorded in the ledger.
Two early frozen-override manifests had their effective version metadata
corrected; their captured requests, responses and result metadata were unchanged.

Final `npm run check`: lint, **1,411 tests / 164 files**, TypeScript and Vite build
passed. The existing large-chunk warning remains. Static comparison confirms
all non-Singles-Pokemon instruction bodies and both locale messages are restored.
No new browser QA, commit, push or deployment was performed for this task.
