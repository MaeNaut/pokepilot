# Expanded Published M-C Teams: Luna Low Review

## Scope And Sources

Follow-up to [the initial four-team review](AI_MC_PUBLISHED_REVIEW_2026_10_04.md).
Six additional teams bring the corpus to ten teams, five per format. These
are sourced high-placing examples, not an objectively ranked list of the
six most popular or strongest teams in the world.

| Format | Published result | Distinctive test | Source |
| --- | --- | --- | --- |
| Singles | Nautilasu, September monthly 37th | Wish passing, Foul Play, special Mega Salamence | [Author report](https://note.com/db_nautilasu/n/nfb208a7ca747) |
| Singles | Mugepome, September monthly 91st, rating 1797 | Rain Electro Shot, two Mega choices, mixed defensive investment | [Author report](https://note.com/mugepome/n/n66d700149daa) |
| Singles | Danjinesu, September monthly 71st, 35-9 | One-attack Substitute / Dragon Dance / Roost Mega Salamence | [Author report](https://ameblo.jp/danjinesu-club/entry-12979542246.html) |
| Doubles | Eric Rios, Frankfurt champion, 17-0, 1,129 Masters | No Guard Zap Cannon, alternative Mega branches | [Public team sheet](https://standings.limitlessvgc.com/0039/player/1025/teamlist) |
| Doubles | Kiran Singh, Brisbane champion, 14-1, 327 Masters | Sun/rain switching, Chlorophyll and Electro Shot | [Public team sheet](https://standings.limitlessvgc.com/0038/player/267/teamlist) |
| Doubles | Anthony Liuzzo, Frankfurt 5th, 12-3 | Perish trapping, Soundproof, redirection and pivots | [Public team sheet](https://standings.limitlessvgc.com/0039/player/0219/teamlist) |

Singles sets and Stat Points were transcribed from author text/screenshots.
Nautilasu uses the tournament Metagross Iron Head set, not the author's later
Psychic Fangs rental revision. Doubles open sheets disclose no Stat Points:
all three are explicitly zero-point reconstructions, not the players' exact
spreads. They test mechanics and strategy, not championship damage benchmarks.
Optimization of these zero-point sets must not be represented as finding
faults in the champions' actual builds.

## Protocol

- Evaluation key, GPT 6 Luna, low reasoning, Standard service only.
- Four scopes per team: team; first Pokemon; addition with the sixth slot
  removed; general sample optimization for the first Pokemon.
- First Pokemon: Umbreon, Archaludon, Salamence, Raichu, Charizard, Gengar.
- Baseline v96, owner-local evidence / Singles separation v97, attempted
  detailed mechanics v98, then a narrower delayed-effect instruction v99.
  A final payload inspection found that v98/v99 still read normalized v4
  cached data: the new detailed descriptions had not reached those calls.
  The `v99-fresh` batch regenerates all 40 inputs after the cache migration.
- The initial Mugepome import used an unrecognized `Golisopodite` spelling.
  Its four original v96 calls are excluded from quality comparisons but
  included in spending. `Golisopite` was corrected and all four rerun before
  comparison. The runner now rejects missing items or invalid imports.
- Two v98 attempts encountered provider TPM limits. Error records were kept
  and only those requests were retried. No hidden retries.
- Existing four teams are rerun separately as regression cases. They are
  not held-out evidence because earlier work already used them.
- The same request hash does not mean the exact provider prompt is identical:
  the model-boundary serializer and instructions changed. `v99-fresh` changes
  the actual canonical descriptions. This is a product before/after review, not a
  prompt-only controlled trial.
- Outputs are manually checked against the request and source. Private audit
  warnings measure grounding completeness, not truth of every public sentence.
- English, every individual slot, exact-opponent and meta-threat scopes, and
  repeated stochastic accuracy estimates remain outside this batch.

## Implemented Changes

1. Low/none input repeats exact ability, item and move mechanics next to each
   owning set, including projected Mega ability separately. It explicitly
   states active/selected team sizes. It does not invent strategic labels.
2. Singles team analysis gets its own concise instructions rather than the
   Doubles lead-pair/action template. Persistent field support remains valid,
   but simultaneous allied attacks and friendly fire do not.
3. Canonical full move descriptions are retained separately from short UI
   descriptions, and used for selected moves, recommendation common sets and
   optimization mechanics. Wish's position recipient and Perish Song's
   switch-out removal were missing from short summaries. Existing bounded
   mechanic truncation still applies; this is not unlimited full-text input.
   The normalized cache advances from mc-v4 to mc-v5 and removes the old
   derived cache so returning users receive the new fields without retaining
   two large snapshots. Team/account storage is not touched.
4. Shared moves do not imply both users should act with them simultaneously.
   Immunity to a harmful team-wide effect can enable a plan. Candidate ability
   options must not be treated as simultaneously active.
5. Delayed position effects and Pokemon-bound counters are distinguished;
   the v98 wording was narrowed after one response transferred Wish-style
   position reasoning to Perish Song. No team names or expected winners were
   hard-coded into the product prompts.

## Intermediate Findings

| Observation | Outcome / limitation |
| --- | --- |
| v96 missed Aerilate Hyper Voice and warned about allied Earthquake in Singles | v97/v98 examples explain the transformed Flying STAB and omit friendly fire. |
| v97 Umbreon denied Wish passing | v98 explains recovery for a later occupant after switching. |
| v96 recommended both Perish Song users act together | v97/v98 divide Song and protection/disruption actions. |
| v97 excluded Soundproof Kommo-o because Song does not affect it | v98 recognizes immunity as useful support for the Perish plan. |
| One-attack Salamence was treated as generic coverage optimization | v98 preserves Substitute / Dragon Dance / Roost / Double-Edge. |
| v98 Stamina discussion mentioned physical hits without explaining that special hits also trigger it | Incomplete explanation despite a correct supplied trigger; do not classify the true physical-hit example alone as a false claim. |
| v98 Iron Head was described as non-contact | Incorrect despite the supplied Contact tag. |
| v98 Nautilasu recommendation called Gholdengo Ground-immune by typing | Incorrect; its current immunity is conditional on Air Balloon. |
| v98 Kiran team forced Pelipper out of sun selections | Overly rigid handling of intentional weather switching; strategy depth remains weak. |
| v98 Tagerau optimization said Earthquake was retained and lost | Candidate-edit prose can contradict its exact structured diff. |
| v98 Lloyd team claimed Sneasler Ground immunity and warned about sand breaking Excadrill's Sash | Incorrect; other sentences even contradicted those claims. No automatic warning caught them. |

These observations are not universal pass rates. Prompt additions improved
specific outputs but did not establish reliable factual accuracy. Keep raw
outputs, corrected-input exclusions and remaining failures visible.

## Pre-Cache-Fix Qualitative Review

The v99 examples retain useful improvements, but this batch **does not
establish an overall accuracy improvement**. Low-effort output remains unstable
even when the required facts are explicitly present in the input.

- Singles team responses no longer prescribe allied Earthquake/Surf avoidance
  in these final cases. The separated format instructions address that observed
  mistake, not every Singles strategy error.
- Gengar team/Pokemon responses now treat Soundproof Kommo-o as a useful Perish
  Song partner. The Pokemon response no longer transfers the count to an
  ordinary switch-in as the v98 response implied.
- Archaludon correctly separates a Bold nature from HP/Special Defense point
  investment. Rain Electro Shot and optional Mega forms are generally recognized.
- Charizard Pokemon/optimization responses recognize Hurricane and Weather
  Ball's rain utility. Team responses still simplify dual weather into rigid
  branches rather than explaining the full switching plan.
- Wish passing is no longer denied, but is explained less explicitly in v99
  than in the positive v98 response. Do not claim a stable tactical pass.

High-priority residual failures include:

| Case | Public-output error | Evidence / input limitation |
| --- | --- | --- |
| Nautilasu team | Wave Crash recoil described as a fraction of the user's maximum HP | Cached input only said 33% recoil; raw canonical description gives damage dealt as the basis. This helped expose the stale-cache bug. |
| Rios team | Rillaboom described as Rock-weak; base Garchomp described as Ground-immune | Neither current profile has the claimed relation; base Garchomp does not have its projected Mega's Levitate. |
| Rios recommendation | Three Grass candidates collectively described as Grass-weak; Garchomp described as Ground-weak | Candidate types/fit and the current set's defensive profile contradict these claims. |
| Liuzzo team | Lead Gengar + Incineroar plus Politoed + Rillaboom + a fifth branch member | The format explicitly selects four; the private plan does not validate every public lineup sentence. |
| Danjinesu optimization | Prose concludes that keeping Substitute is reasonable but ranks its removal above the keep-current card | Exact changed move is correct; recommendation priority and narrative judgment disagree. |
| Tagerau regression team | Swampert described as Ground-immune | Its current profile is neutral to Ground, not immune. |
| Tagerau regression optimization | Again recommends dropping Aerilate Double-Edge for Roost despite recognizing it as the main attack | The primary-STAB preservation instruction alone does not reliably influence ranking. |

These are model reasoning/output failures, not evidence that the sourced
championship teams are bad. Do not silently correct the stored original
responses or relabel a warning-free response as factually accurate.

The next intervention should target the specific public claim failure, not add
more generic warnings: distinguish candidate offensive coverage from defensive
relations, tie named public lineups to the exact selected slots, and ensure
sample-change prose agrees with the chosen candidate's retained/removed moves.
Any regeneration or stricter output handling needs separate product decisions
and repeated live evaluation; it was not introduced in this follow-up.

## Verified Fresh-Input Findings

`v99-fresh` is the final product-input run. Before paid execution, all 40
requests were regenerated and Wish, Wave Crash and Perish Song effects were
inspected directly. They now contain the canonical position, recoil-basis and
switch-out rules respectively, rather than the cached short summaries.

Specific observed improvements in the added teams:

- Nautilasu team and Umbreon Pokemon analysis both explicitly explain that
  Wish can heal the replacement occupying Umbreon's position next turn.
- Rain-team output correctly describes Wave Crash recoil as proportional to
  damage inflicted, and Archaludon describes Stamina as triggering after move
  damage rather than discussing only physical hits.
- Selected physical/special investment is distinguished from nature in the
  Archaludon and Salamence Pokemon analyses.
- Salamence optimization preserves Aerilate Double-Edge, explains the actual
  Substitute-to-Earthquake tradeoff, and includes a keep-current option.
- Kiran Charizard analysis explains Hurricane's 50% sun accuracy versus its
  rain behavior and treats retaining Hurricane as a real alternative in
  optimization, rather than assuming it is a misplaced sun-team move.
- Liuzzo team/Pokemon analysis explicitly removes Perish Song's counter on
  switching and recognizes Soundproof as an escape from the team's harmful
  effect rather than rejecting the partner.

Persistent errors in these final fresh-input responses include:

- Mugepome team names Pelipper/Basculegion/Floette as its three selections but
  cites absent Archaludon's Electro Shot as a benefit of that selection.
- Mugepome Pokemon analysis calls Dark Pulse a Ghost attack despite the Dark
  type supplied on that exact move.
- Danjinesu recommendation again calls Wash Rotom's Volt Switch Flip Turn.
  Its common-set move ID and Korean display name are both correct in input.
- Kiran recommendation describes Charizard as Ice-weak; the current profile
  does not show that weakness.
- Rios team prose introduces a blanket prohibition on Tailwind changing
  same-turn order, which is not supported by its supplied mechanics. This
  needs a dedicated turn-order case rather than being accepted as evidence.

The improvements above are individual observed outputs, not a measured
overall factual-accuracy uplift. Public-prose semantic mistakes remain even
when private audits have no warnings. The new canonical-data retention and
cache migration are independently verified code fixes; their correctness
does not imply every model interpretation is correct.

### Fresh Regression Review

- Tagerau's optimization now replaces Fire Blast rather than Aerilate Double-Edge
  when suggesting Roost, explicitly retaining the physical main attack. Its team
  response also explains Wish passing correctly.
- DDee's team response keeps each proposed lineup to four members, separates its
  two Mega branches, and no longer treats Sneasler as Ground-immune. However, its
  recommendation calls Wash Rotom's Ground protection a property of Electric/Water
  typing instead of Levitate, and its optimization says Calm Mind raises Attack
  in the opening sentence. These are still factual attribution errors.
- Lloyd's Milotic analysis preserves Coil's Defense/accuracy value despite having
  no physical attack. Its team and recommendation responses still suggest sand
  compromises Excadrill's Focus Sash, even while the team response explicitly
  says Excadrill is immune to sand damage. This is an unresolved contradiction,
  not an acceptable tactical caveat.

## Final Verification and Usage

All calls used `gpt-6-luna` with `low` reasoning. The expanded corpus contains
five Singles and five Doubles teams, each exercised across team, Pokemon,
Pokemon recommendation and sample optimization scopes.

| Measurement | Result |
| --- | --- |
| Follow-up completed calls, including intermediate experiments | 172 |
| Follow-up attempts | 174; two rate-limit failures subsequently retried |
| Recorded total tokens | 3,686,679 |
| Estimated cost from recorded usage | USD 0.39779807 |
| Final fresh-input run | 40/40 completed |
| Final fresh-input tokens / estimated cost | 946,039 / USD 0.10150525 |
| Final fresh-input median response time | 12.525 seconds |
| Final responses with internal warnings | 9/40; not an accuracy score |
| Code checks | 1,217 tests across 154 files, lint and production build passed |

These costs exclude the earlier published-team evaluation and reflect known
usage multiplied by the repository price table, not a provider invoice. Missing
usage on failed requests is not proof that those attempts cost nothing. Four
initial calls with an invalid imported item remain in spending totals but are
excluded from quality comparisons and were rerun with the corrected import.

The final run was made after verifying the actual serialized detailed move
mechanics and migrating the normalized data cache to v5. Earlier v98/v99 runs
still consumed the stale short-description cache and must not be treated as
evidence for the full-description change. No overall accuracy percentage or
causal improvement estimate is justified by these exploratory single outputs.
No deployment was performed as part of this follow-up.

## Reproduction

Run from the repository root with the existing evaluation-key configuration:

```text
npx tsx scripts/run-mc-published-evaluation.ts --fixtures=src/test/fixtures/aiMcExpandedTeams.json --output=.tmp/mc-final-expanded --requests=requests-fresh --phase=v99-fresh --run
npx tsx scripts/run-mc-published-evaluation.ts --output=.tmp/mc-final-regression --requests=requests-fresh --phase=v99-fresh --run
```

Omit `--run` to prepare inputs without paid calls. `--only=<case-prefix>`
restricts calls. Existing result files are never overwritten; use a new phase
for a repeat. Use a new requests basename to rebuild inputs after data changes.
Run batches sequentially to avoid consuming the project's TPM allowance with
overlapping evaluation processes. Raw local inputs/results are in ignored
`.tmp` folders; the checked-in compact result artifact excludes credentials
and provider account identifiers.
