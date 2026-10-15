# Owner-Bound Input Review - October 14, 2026

## Decision

This initial v111 decision is superseded by the
[expanded uniform-layout follow-up](AI_UNIFIED_OWNER_REVIEW_2026_10_14.md).
The measurements and rationale below remain the historical pilot record.

Keep owner-bound mechanic references for **team, Pokemon recommendation and
sample recommendation** only. Restore the original encoding for selected-Pokemon
analysis, and leave the untested internal matchup scope unchanged. Final code
uses prompt v111/core v13; common, scope and locale prose remain unchanged.

This is a narrow input-layout pilot, not a claim that hallucinations are fixed.
The retained scopes had fewer confirmed public factual-error responses in this
fixed test, but qualitative concerns increased. The selected-Pokemon trial was
not promoted despite a slightly better factual-error count.

## Input Change

At the API serialization boundary, `set.mechanics` links only that set's selected
moves, active ability and held item to existing canonical mechanic records.
`megaEvolution.mechanics` links the projected Mega ability separately. Shared
records remain complete and are referenced rather than copying their effect
text for each owner. No candidate menu is treated as a selected set.

Missing or ambiguous IDs do not receive guessed effects. Original data, including
the global mechanic catalog, is preserved. Stats and Stat Points were already
inside their owning sets and Mega projections; they were not duplicated into a
new fact table. The change does not add new battle knowledge or alter schema,
model, reasoning effort, stored teams, history, or validation/postprocessing.

The layout hypothesis is that nearby owner/state boundaries can reduce reference
mistakes. [OpenAI's prompt-engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering#message-formatting-with-markdown-and-xml)
discusses clear context boundaries; it does not establish that this particular
JSON layout improves PokePilot. The experiment below is the relevant evidence.

## Controlled Evaluation

Use the previously authorized evaluation key, GPT-6 Luna low, default/Standard
tier, store=false, no provider retries. Freeze ten public-team inputs with
current M-C data and run each three times before and after: **60 new calls**,
estimated **$0.122953005** using the application's usage calculator, not a
reconciled provider invoice. No production-key calls or private user teams.

Inputs cover the four public scopes plus Charm/Contrary, protected setup aces,
and Illusion/Round. The strategy fixtures include older-regulation source teams
whose current M-C legality was checked in the previous preparation. They are
failure-focused regressions, not a random sample of users or a current rank list.

All public paragraphs and recommendation titles/reasons were manually reviewed
against frozen requests. Review was not blinded. Count responses with confirmed
public factual errors; keep unclear wording, omissions and private audit flags
separate. Structural success is not a factual-accuracy score.

| Matched subset | Before | Owner-linked trial |
| --- | ---: | ---: |
| All scopes, confirmed-error responses | 10/30 | 6/30 |
| Retained scopes, confirmed-error responses | 6/21 | 3/21 |
| Retained scopes, concern responses | 7/21 | 12/21 |
| Retained scopes, final audit-flagged responses | 3/21 | 2/21 |
| Selected Pokemon, confirmed-error responses | 4/9 | 3/9 |
| Renderable outputs | 30/30 | 30/30 |

These are small, stochastic, targeted samples. Do not describe them as a general
50% reduction in user errors or proof that ownership alone caused the difference.

## Why The Scope Rollback

The selected-Pokemon trial correctly qualified Thunder Wave as a teammate's move,
but lost useful detail in two different outputs: one gave no exact Illusion
disguise, another omitted Mega Gardevoir's Pixilate payoff. Both observations
were present in all three original outputs and only two of three modified ones.
An impossible three-allied-user Round sequence also remained. Korean Flower Veil
status terminology became less readable, and new timing/state mistakes appeared.
The lower aggregate factual count does not justify promoting this mixed result.

For retained scopes, Charm/Contrary remained correct in all three repeats.
The protected-ace team explicitly explained Nasty Plot in two modified outputs,
versus none before; Calm Mind remained underexplained. Remaining concerns include
incomplete Mega-branch explanations, an omitted Special Attack tradeoff, and
loose speed-tier language. Retention is based on the factual reduction and
preserved core interactions, not an across-the-board quality improvement.

## Remaining Confirmed Errors

The three retained-scope trial errors were:

- Archaludon's 145 Special Attack described as invested despite zero points.
- Heat Wave called the team's physical attack instead of special; Spirit Break
  is the supplied physical attack.
- Incineroar described as resisting Rock before later correctly calling it weak.

These remain open. Reference binding does not verify natural-language claims.
The rejected Pokemon trial also discussed simultaneous allies in Singles and
made Drizzle-before-attack depend on move Speed, said Mega Evolution lowers
Floette's stats despite showing increases, and retained the three-ally Round
sequence. Do not hide these behind private audit passes or generated fallback.

## Cost And Time

For the **21 calls per side in retained scopes**:

| Measure | Before | Trial |
| --- | ---: | ---: |
| Input tokens | 401,655 | 415,737 |
| Output tokens | 32,830 | 31,903 |
| Estimated billed cost | $0.04682479 | $0.04725521 |
| No-cache equivalent cost | $0.0565805 | $0.0575252 |
| Median duration | 22.243 s | 20.055 s |

Input grew **3.51%**, estimated billed cost **0.92%**, and no-cache equivalent
cost **1.67%**. Median latency was lower in this run, but output variation,
caching and service conditions prevent a reliable speed claim. No word-count
target or medium-model comparison was used.

## Final Verification

The final encoder matches the original encoder byte-for-byte for all three
frozen Pokemon inputs, and the tested modified encoder for the seven retained
inputs. Common/scope/locale text and SDK settings were checked unchanged.
There was no separate new thirty-call v111 replay: the source records retain
their observed v109/v110 metadata rather than being relabeled. Matchup receives
the original encoding and was not live-tested here.

Removing owner metadata and expanding references recovers all ten original
requests exactly. Unit tests cover selected-only ownership, current versus Mega,
already-Mega sets, unknown/conflicting IDs, no mutation, record sharing, and
scope rollback. Final `npm run check`: lint, **1,416 tests / 164 files**,
TypeScript and Vite build passed. The existing large-chunk warning remains.
No UI change, new browser QA, commit, push or deployment.

Machine-readable evidence: [owner-binding-2026-10-14.json](evaluations/owner-binding-2026-10-14.json).
Raw frozen requests, wire payloads, provider responses and trial modules remain
ignored under `.tmp/owner-binding-2026-10-14/`. They are local artifacts, not
versioned reproduction data. The ledger preserves hashes, settings, per-output
findings and decisions for later review.
