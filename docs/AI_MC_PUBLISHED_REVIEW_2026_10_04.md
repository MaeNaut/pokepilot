# Published M-C Teams: Luna Low Review

This is the historical v93-v96 review. The subsequent six-team expansion and
v97-v99 follow-up are recorded in
[the expanded review](AI_MC_EXPANDED_REVIEW_2026_10_04.md).

## Selection And Limits

Four sourced teams, not a claim to the globally best or most popular team.
Ranked Singles placement and community Doubles tournament wins are different
forms of evidence. Popularity counts refer only to the Pokemon Zone snapshot.

| Format | Team | Evidence |
| --- | --- | --- |
| Singles | Rillaboom / Lucario Z / Dragonite / Empoleon / Baxcalibur / Glimmora | [Game8 M-C sample](https://game8.jp/pokemon-champions/779319), a popular reference, no player placing claimed |
| Singles | Swampert / Salamence / Sylveon / Kingambit / Glimmora / Metagross | [Tagerau's published report](https://tagerau.hatenablog.com/entry/2026/09/21/151620), September monthly 82nd, 1799.516 |
| Doubles | Floette / Sneasler / Incineroar / Rillaboom / Gholdengo / Raichu Y | [DDee, Talon Fight Club 101](https://www.pokemon-zone.com/champions/tournaments/talons-fight-club-101-pokemon-champions-reg-m-c/), 1st, 12-0, 98 players |
| Doubles | Sneasler / Salamence / Tyranitar / Excadrill / Indeedee / Milotic | [Lloyd Villar's public sheet](https://play.limitlesstcg.com/tournament/6a7ba8f62b308b6067b5199c/player/lloyd5/teamlist), Make It Rain 1st, 13-1, 266 players |

[Pokemon Zone's team index](https://www.pokemon-zone.com/champions/teams/)
listed 126 teams / 717 matches for the DDee six and 103 teams / 582 matches
for the Lloyd six when researched. These counts do not prove identical sets.

Singles spreads were transcribed from the published sets/screenshots. Doubles
public sheets did NOT disclose Stat Points or IVs. The test explicitly uses
zero Stat Points and the app's normal stat assumptions for those teams. These
are reproducible roster/strategy reconstructions, NOT the champions' exact
spreads. Do not publish their numeric benchmarks as player builds.

## Method

- Evaluation key only; every paid call used GPT 6 Luna, low effort, Standard.
- Four scopes per team: team, selected Pokemon, addition recommendation with
  slot 6 removed, and general sample optimization. Selected Pokemon were
  Lucario, Salamence, Floette and Milotic, respectively.
- Exact-opponent/meta-threat analysis, English and all six individual Pokemon
  were NOT evaluated. There was no production deployment or user-data access.
- 16 original v93 calls, 16 v94 calls, 16 v95 calls, four v95 full-input probes,
  then 16 final v96 calls. No failed calls or hidden retries in this run.
- Twelve of sixteen request JSONs remained byte-identical between original
  and corrected inputs. Four Lucario-team requests changed because their
  projected Mega form was wrong. Do not call those four prompt-only A/B tests.
- Original provider output and post-processing output were retained separately.
  Automatic validation warnings are NOT a factual accuracy metric.

| Batch | Calls | Estimated USD | Median wall time | Calls with validation warnings |
| --- | ---: | ---: | ---: | ---: |
| Original v93 | 16 | 0.032304380 | 14.01 s | 2 |
| v94 | 16 | 0.033005720 | 12.31 s | 0 |
| v95 | 16 | 0.033744845 | 13.77 s | 4 |
| v95 full-input probe | 4 | 0.007232940 | 11.45 s | 0 |
| Final v96 | 16 | 0.033291380 | 12.60 s | 3 |

Total: **68 calls, USD 0.139579265, 1,262,743 total tokens**. Costs use provider
usage with the repository price table, not an invoice. Cache conditions varied;
this is not a controlled cost or latency benchmark. One v96 call took 60.3 s.

## Changes

1. Fixed a real Mega projection bug: compact `lucarionitez` was considered an
   unsuffixed fuzzy stone match and selected ordinary Mega Lucario first.
   Normalize compact X/Y/Z stone suffixes before matching. The corrected
   fixture projects Mega Lucario Z, Aura Shield, SpA 237 and Speed 191 instead
   of ordinary Mega Lucario, Adaptability, SpA 211 and Speed 152.
2. Prompt v96 / core v9 adds public-prose owner/name/type checks, isolates
   Singles from allied targeting rules, distinguishes conditional speed control,
   evaluates every component of multi-effect support moves, and checks whether
   Trick Room actually benefits a fast team. Optimization scope v34 asks the
   model to preserve ability-transformed primary STAB before secondary coverage.
3. Low and none now receive inline request evidence rather than shared-record
   references. Four probes improved the specific owner/type and Aerilate cases,
   but the full rerun still contained errors. This is a provisional readability
   improvement, NOT proof that compression caused every error. Medium retains
   its existing encoding and was not live-tested here.
4. Added source fixtures, qualitative expectations, a repeatable low-only runner,
   and regression tests for compact Mega suffixes and effort-specific encoding.

## Observed Improvements

- Lucario Z name, ability and exact projected stats were correct after the code fix.
- Tagerau recommendation used Volt Switch for Wash Rotom instead of U-turn.
- Final Salamence optimization preserved Aerilate Double-Edge rather than
  recommending its removal as the cheapest recovery swap.
- Milotic Pokemon analysis recognized Coil's Defense and Hypnosis-accuracy role.
- Lloyd team analysis no longer prescribed Trick Room as the default sand plan.
- Final optimization outputs did not expose internal candidate IDs in prose.

These are individual response observations, not stable pass rates.

## Unresolved Errors In Final v96

| Scope | Example and consequence |
| --- | --- |
| Team | Tagerau raw output again warned about allied Earthquake/Sludge Wave in Singles. Post-processing emitted content-repaired; raw compliance still failed. |
| Team | Lloyd's Tailwind selection omitted the Psychic Seed setter; alternatives did not consistently preserve the seed/Unburden plan. It also said base Salamence evidence was absent even though supplied. |
| Pokemon | Milotic correctly linked Coil to Hypnosis, but falsely said it does not improve Muddy Water accuracy. No automatic warning caught this. |
| Recommendation | Tagerau output called Wash Rotom weak to Water, contradicting its supplied profile. Naming corrected Volt Switch did not fix all type claims. |
| Recommendation | DDee additions omitted relevant Psychic Terrain conflicts with the existing Grassy Seed / Fake Out / Grassy Glide plan. Lloyd recommendations still overvalued a slow Trick Room identity. |
| Optimization | Salamence kept Double-Edge, but its explanation incorrectly implied every Roost candidate loses Dragon Dance, Earthquake or Double-Edge; the Fire Blast replacement exists. |
| Optimization | Milotic still preferred removing Coil despite recognizing accuracy support. Its Recover + Sitrus explanation conflated repeatable move recovery with one-time berry recovery. |
| Optimization | Floette prose called the current set invested, then correctly said all points were zero. The reconstruction exposed an internal contradiction. |

Do not advertise this batch as fully accurate or publish an unreviewed response.
In particular, zero warnings in v94 did not mean zero factual errors.

## Next Quality Work

Prioritize deterministic, owner-local evidence for field activation/seed support,
effective move typing, nature modifiers and accuracy dependencies. Evaluate
candidate changes against those responsibilities instead of adding unlimited
prose instructions. Grounded audit validation does not currently cover every
user-facing sentence; prompt-only warnings have demonstrated limits.

Repeat the same failure cases multiple times and include a held-out team before
claiming a stable gain. Do not replace failed original records with successful
reruns. Missing Doubles spreads should eventually be replaced with a separately
published complete build, not guessed into the winner's record.

## Reproduction And Evidence

- Source inputs: `src/test/fixtures/aiMcPublishedTeams.json`.
- Prepare only: `npx tsx scripts/run-mc-published-evaluation.ts --expanded`.
- Explicit paid execution: add `--run`; the script always selects low and the
  evaluation key. Existing result files are retained rather than overwritten.
- Frozen requests and all raw/reviewed results: `.tmp/mc-evaluation/` (ignored).
  `before`, `after`, `final`, `plain`, `expanded` correspond to the table above.
- Compact permanent evidence: `docs/evaluations/mc-low-2026-10-04.json` includes
  batch metrics and original/final response excerpts with request fingerprints.
- Full suite: 1,210 tests / 154 files passed. Final affected-file rerun: 81 tests
  passed. Lint and TypeScript/Vite build passed; the existing large-chunk warning
  remains. No paid analysis was run by the automated tests.
