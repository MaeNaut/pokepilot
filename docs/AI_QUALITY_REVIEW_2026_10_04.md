# Kabamanda Quality Follow-up

## Scope

This is a targeted quality investigation, not a general model accuracy score.
It uses the public five-member Kabamanda example with Primarina absent.
Prompt-v92 records and screenshots were subsequently archived during the public
example refresh; see PUBLIC_ANALYSIS_EXAMPLES.md for the selected v93 publication.
No production deployment is included in this follow-up.

## Code Changes

- Optimization post-processing distinguishes usage percentages from damage/KO
  statements. An affected paragraph no longer discards unrelated paragraphs.
  Existing damage/KO and private-candidate-ID safeguards remain in place.
- Recommendation names are localized again at the request boundary, including
  species, types, abilities, moves and replacement targets. Canonical catalogs
  take precedence over previously localized labels.
- Generated general-sample candidates with maximum investment in an unused
  attacking stat are excluded conservatively. Current user sets, mixed bulk,
  unknown moves and unusual stat-scaling descriptions remain available.
  This is a shortlist coherence screen, not proof of strategic optimality.
- Weather descriptions retain full canonical rules instead of short summaries.
  Sand Stream receives the Sandstorm reference without assigning that move to
  its owner. The Showdown data cache advances to mc-v4 to avoid stale summaries.
- Prompt v93 (core v7, team v8) separates nature effects from point allocation,
  asks for concrete candidate tradeoffs, checks internal conflicts, qualifies
  unverified switch-ins and separates Mega selections when base-form evidence
  is unavailable. These instructions do not guarantee model compliance.

## Verification

- Replayed all 12 frozen v92 provider outputs through the new post-processing.
  All original paragraphs were preserved. In particular, the English training
  example's valid 14.5% usage explanation no longer erases both paragraphs.
- The sample shortlist changed from 10 to 8 candidates. Both full Special Attack
  spreads paired with exclusively physical/status moves were excluded. Mixed
  bulk is covered by regression tests and was not banned.
- Nine real GPT 6 Luna low calls used only the evaluation key: an initial five
  covering all four public analysis types and English recommendation, followed
  by two Pokemon/team pairs while investigating missing weather information.
  Provider-reported estimated cost totals USD 0.017810635; measured durations
  span 7.930-18.848 seconds. This small, iterative run is not a latency benchmark.
- The initial follow-up correctly separated Hippowdon's Defense-boosting nature
  from HP/Special Defense investment. The English recommendation had English
  game names. Sample prose compared the actual costs of each move replacement.
- The final team response gave separate Salamence and Lucario Mega selections.
  The final Pokemon response identified sand damage as a Focus Sash risk.
  These are observations from individual responses, not stable pass rates.
- Final lint, 1,195 tests across 154 files, Cloudflare build and deployment
  dry-run passed. The existing large-chunk build warning remains.

## Remaining Problems

Do not mark these resolved merely because structural validation passes:

1. The final Pokemon response still described allied Earthquake positioning in
   Singles and incorrectly grouped Meowscarada with Flying types. No automatic
   warning was emitted. The sentence-level Singles repair can miss an error
   when unrelated negation appears in the same sentence.
2. Weather/Focus Sash coverage remains inconsistent. The final Pokemon response
   mentioned it but used an ambiguous title about the last weather turn; the
   final team response still omitted the specific Sash cost of its Meowscarada
   selection. Full weather input is necessary but not sufficient.
3. Recommendations mostly describe each candidate independently. Clear direct
   comparisons and matchup-specific evidence remain shallow. No new opponents
   or damage benchmarks were invented to fill this gap.
4. Filtering incoherent marginals does not create a correlated observed set or
   prove the retained set is globally optimal. Mixed-attack alternatives such
   as Draco Meteor on a physical set still need qualitative cost assessment.
5. Medium, Doubles, exact-matchup and meta-threat quality were not re-evaluated
   with live calls in this pass. Existing tests are not substitutes for that.

## Local Evidence

Ignored raw evidence is retained under `.tmp/quality-v93/`,
`.tmp/quality-v93-weather/` and `.tmp/quality-v93-weather-full/`.
The middle run exposed that the first weather enrichment still used a short
description. The final directory uses full weather descriptions. These are
iterations of an unreleased v93 draft, not three independently released prompts.
The local runner is `.tmp/quality-v93.ts`; the original frozen v92 evidence stays
under `.tmp/public-examples/`. Do not overwrite public examples to hide failures.
