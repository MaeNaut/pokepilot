# Unified Owner Layout Follow-Up - October 14, 2026

## Decision

Use the same owner-bound mechanic encoding for every analysis scope, including
selected-Pokemon and internal matchup. Remove the scope exception introduced by
the [initial pilot](AI_OWNER_BINDING_REVIEW_2026_10_14.md). Final prompt version is
**112/core 13**; instruction prose, schemas, model and reasoning are unchanged.

This is a consistency decision with mixed quality evidence, not a demonstrated
quality upgrade or statistically proven noninferiority. The earlier three-repeat
omissions were insufficient grounds for declaring this layout unadoptable.
The expanded run found fewer erroneous responses but more explanation omissions.

## Protocol

Freeze eight selected-Pokemon requests from six public-team rosters: Archaludon
and Pelipper in Singles; Floette, Charizard, Staraptor, Hisuian Zoroark, Delphox
and Vivillon in Doubles. Reuse the current-M-C snapshots from the initial pilot.
For derived cases, change only scope/selected slot and clear unused candidate,
optimization and matchup fields. No new battle data enters either arm.

Run each request five times per arm with the previously authorized evaluation
key: **80 new GPT-6 Luna low calls**, Standard/default tier, store=false,
provider retries disabled. Before uses frozen v109 encoding/instructions, which
match the selected-Pokemon path in v111; after uses frozen all-scope v110.
The final v112 encoder matches the observed after payload exactly. Do not relabel
these paid results as a fresh v112 run.

The gate was recorded before calling either arm:

- Hold adoption if the candidate adds at least four confirmed-error responses
  out of forty, or a new severe mechanics mistake repeats in at least three of
  five outputs of one case.
- Hold adoption if at least two cases each lose at least two of five successful
  core-tactic explanations.
- Keep ambiguous wording, omissions and private audit failures separate from
  confirmed public false statements.

These are exploratory product tolerances, not confidence bounds or a guarantee
that smaller regressions are harmless. Runs were sequential (before then after),
not randomized or blinded. All paragraphs and recommendation titles/reasons
were manually reviewed against the frozen inputs; no paid AI judge was used.

Core checks concern each case's intended explanation: rain/Electro Shot,
current-versus-Mega state, weather options, Charm/Contrary, concrete Illusion
disguise plus Pixilate/Round payoff, or a named setup opportunity enabled by
allied protection. A core explanation can be present in a response that also
contains a separately counted factual mistake. For Vivillon, generic support
alone does not count as explaining an allied setup turn.

## Results

| Measure | Original | Unified |
| --- | ---: | ---: |
| Renderable responses | 40/40 | 40/40 |
| Responses containing confirmed factual errors | 7/40 | 6/40 |
| Responses with wording/omission concerns | 20/40 | 23/40 |
| Sufficient case-specific core explanations | 33/40 | 30/40 |
| Raw/final audit-flagged responses | 6/40 | 7/40 |
| Input tokens | 532,250 | 559,795 |
| Output tokens | 46,742 | 47,789 |
| Estimated billed cost | $0.059863875 | $0.0624122 |
| Median duration | 12.899 s | 13.149 s |

Total estimated new cost: **$0.122276075**. Input grew **5.18%** and estimated
billed cost **4.26%**; cache-hit variation is included. These are application
usage-calculator estimates, not reconciled provider invoices. No production-key
calls or private user teams were used.

| Case | Error responses, before -> after | Core explanations, before -> after |
| --- | ---: | ---: |
| Archaludon Singles | 0 -> 2 | 5 -> 5 |
| Floette Doubles | 2 -> 1 | 5 -> 5 |
| Zoroark Illusion/Round | 3 -> 1 | 2 -> 3 |
| Pelipper Singles | 0 -> 0 | 5 -> 4 |
| Charizard weather | 0 -> 0 | 5 -> 5 |
| Staraptor Charm/Contrary | 0 -> 1 | 5 -> 5 |
| Delphox protected setup | 0 -> 0 | 5 -> 3 |
| Vivillon enabling setup | 2 -> 1 | 1 -> 0 |

No rejection threshold was crossed. Delphox is the sole case losing two core
explanations; Pelipper and Vivillon each lose one. These are real weaknesses in
the observed outputs, not proof of equivalence. The initial pilot's two lost
Zoroark details did not recur as an aggregate decline: concrete Illusion disguise
remains 5/5 in both arms, and the Mega Gardevoir/Pixilate payoff is 2/5 -> 3/5.

## Remaining Problems

The unified arm still produced six responses with confirmed false statements:

- Archaludon: simultaneous allied actors in Singles; a contradictory Fighting
  resistance claim followed by a correction left in the public paragraph.
- Floette: calls Mega Raichu Y's Special Attack higher than Mega Floette's,
  although supplied values are 180 versus 192.
- Zoroark: explicitly sequences three allied Round users in Doubles.
- Staraptor: calls Speed 167 faster than Garchomp's 169.
- Vivillon: attributes the displayed pre-item Speed 155 partly to Choice Scarf.

Korean status terminology, generic warnings and invented trigger/responder
framing for ordinary shared moves also remain concerns. Delphox sometimes loses
the connection between Nasty Plot and allied redirection. Vivillon's setup
explanation is weak in both arms despite discussing its support moves.

Audit flags are not a proxy for these prose errors: multiple false public
statements passed the audit, while correct descriptions received missing-private-
evidence flags. This patch neither rewrites those paragraphs nor adds fallback.

## Verification And Scope

- All eighty results are renderable, reviewed and linked to their exact request,
  provider payload and output hashes in the evidence ledger.
- Expanding references and removing owner metadata recovers every original
  request exactly. Matched SDK parameters/instruction prose are identical after
  excluding the intended encoding messages; all repeat payload hashes match.
- Every analysis scope now has an owner-link/round-trip unit test. Existing
  current/Mega, missing/conflicting-ID, ownership and direction tests remain.
- `npm run check`: lint, **1,419 tests / 164 files**, TypeScript and Vite passed.
  The existing large-chunk warning remains. No frontend change requires a new
  browser session here.
- Internal matchup encoding is covered structurally, not by paid prose-quality
  cases in this follow-up. Team/recommendation/optimization already used the same
  candidate encoding in the initial pilot and are unchanged from v111.
- No commit, push or deployment was performed.

Evidence: [unified-owner-2026-10-14.json](evaluations/unified-owner-2026-10-14.json).
Raw requests, provider transcripts, protocol and harness artifacts are ignored
locally under `.tmp/unified-owner-2026-10-14/`; the ledger does not make those
local-only artifacts independently reproducible from Git.
