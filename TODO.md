# PokePilot AI TODO

This file is for active implementation notes and small follow-up tasks. Keep larger product direction in `ROADMAP.md`.

## Now

- [ ] Keep keyboard and mouse picker behavior consistent as new controls are added.
  - [ ] Preserve the current hover-to-keyboard active-selection flow for future dropdowns.
  - [ ] Re-test Pokemon, item, ability, nature, and move pickers after major TeamBuilder refactors.
- [x] Replace temporary CSS move category icons with EssentiarumVG Gen 8 glyphs.
- [x] Add explicit team slot controls.
  - [x] Add a clear Pokemon delete/remove action.
  - [x] Add a Pokemon add action for empty slots.
  - [x] Reorder Pokemon slots while keeping each complete build attached.
- [x] Add short third-party source credit in the footer and notices document.
- [x] Finish the current builder-card desktop layout pass.
  - [x] Fit header, body, and footer without accidental page scroll on the target desktop layout.
  - [x] Move Pokemon tabs to the card side.
  - [x] Keep long names, Mega controls, type icons, and card artwork from crowding the editor controls.

## Next

- [ ] Improve the Copilot panel placeholder.
  - [ ] Decide what should appear before AI features are implemented.
  - [x] Keep deterministic team diagnostics outside the future AI response area.
  - [ ] Keep the panel compact enough to avoid vertical overflow.
- [x] Add team-level non-AI diagnostics.
  - [x] Type weakness/resistance summary.
  - [x] Apply fixed type-immunity abilities to defensive matchups and alerts.
  - [x] Offensive coverage summary.
  - [x] Set-based physical attacker, special attacker, wall, and supporter summaries.
  - [x] Duplicate type warnings.
  - [x] Role-based physical/special attacker imbalance warnings.
  - [x] Role-based physical/special wall imbalance warnings.
  - [x] Avoid false completion warnings for intentional no-item or sub-four-move sets.
  - [x] Unify matchup, coverage, role, and alert surfaces with the builder UI.
- [ ] Improve move editing.
  - [x] Keep the current move visible when opening the move dropdown.
  - [x] Preserve natural keyboard scrolling and prevent hover-triggered scroll loops.
  - [x] Reorder selected moves with desktop drag, touch hold-and-drag, or keyboard shortcuts.
  - [ ] Add a clearer empty-move state.
  - [ ] Decide whether selected moves should show PP or only power.
- [ ] Improve item editing.
  - [ ] Keep Mega Stone auto-lock behavior tested after future item changes.
- [x] Put compact team diagnostics between the Pokemon card and Copilot panel.
  - [x] Keep the Pokemon card focused on the selected set.
  - [x] Reserve Copilot for future AI interpretation and recommendations.

## Team Management

- [ ] Design a serializable `TeamBuildState`.
  - [x] Include Pokemon slot identity.
  - [x] Include item, ability, nature, EVs, moves, and Mega/form state.
  - [x] Add a saved-team schema version for future migrations.
  - [ ] Keep the format compatible with future Supabase/Postgres storage.
- [x] Lift or expose TeamBuilder slot edit state so it can be saved.
  - [x] Avoid saving only the visible Pokemon slots while losing item/ability/nature/EV/move choices.
  - [x] Keep existing picker behavior stable during the state refactor.
- [x] Add localStorage-backed team persistence.
  - [x] Save the current team with the header team name field.
  - [x] Store created/updated timestamps.
  - [x] Handle empty or partially filled teams.
- [x] Add team load functionality.
  - [x] Restore Pokemon slots.
  - [x] Restore per-slot build details.
  - [x] Warn before overwriting the current unsaved team.
- [x] Add a saved team list / management interface.
  - [x] Open from the header list icon.
  - [x] Show saved team names and compact Pokemon previews.
  - [x] Support load, rename, duplicate, delete, and Showdown text actions.
  - [x] Reorder saved teams with pointer, touch, or keyboard controls.
- [x] Wire the header team action buttons.
  - [x] Add the left-side header layout: team list, team name, save.
  - [x] Add a header team name field for draft names and future rename flow.
  - [x] Save icon saves the current team with the header name.
  - [x] New team icon starts a blank team with unsaved-change protection.
  - [x] List icon opens team management.
- [ ] Add bench Pokemon support.
  - [ ] Decide whether bench Pokemon live outside the six active team slots.
  - [ ] Support moving Pokemon between bench and active team slots.
  - [ ] Keep Copilot/team analysis focused on active slots unless bench analysis is explicitly requested.

## Data And Legality

- [ ] Harden the Pokemon Champions Regulation M-B legality layer.
  - [x] Keep PokeAPI as the display/detail source and Pokemon Showdown data as the legality source.
  - [ ] Add regression checks for representative Pokemon, item, ability, and move legality.
  - [ ] Document any known Showdown/PokeAPI name mapping exceptions.
- [ ] Improve usage-stats default sets.
  - [x] Fetch and parse Smogon monthly moveset stats for Regulation M-B.
  - [x] Auto-apply popular usage sets only from the main Pokemon picker.
  - [x] Show empty-query Pokemon dropdown suggestions in Smogon usage order with 20-at-a-time scroll loading.
  - [ ] Add a small non-card status or debug surface for the selected usage source if needed.
  - [ ] Decide how aggressively base Pokemon should auto-upgrade into their most-used form or Mega.
- [ ] Add reverse candidate filters to Pokemon search.
  - [ ] Let preselected type filters narrow the Pokemon dropdown.
  - [ ] Let preselected ability filters narrow the Pokemon dropdown.
  - [ ] Let preselected move filters narrow the Pokemon dropdown after a legal move-to-Pokemon index exists.
  - [ ] Keep item, nature, and EV filters out of Pokemon search unless a clear strategy-recommendation UI is designed.
- [ ] Add validity warnings only after the legality UI is designed.

## AI / Copilot

- [ ] Decide the first AI feature shape.
  - [ ] Structured analysis cards.
  - [ ] Limited follow-up chat.
  - [ ] Recommendation generation from locked team slots.
- [ ] Add an API route for AI analysis.
- [ ] Send structured team data rather than raw UI text.
- [ ] Validate AI output before rendering it.
- [ ] Keep AI output clearly advisory, not authoritative legality data.

## Calculator

- [ ] Add a calculator mode to the app.
  - [ ] Decide whether it should be a damage calculator, stat calculator, or both.
  - [ ] Add navigation between Team Builder and Calculator.
  - [ ] Reuse the same Pokemon/item/move data model where possible.
  - [ ] Keep the calculator compatible with Pokemon Champions assumptions.

## Polish

- [ ] Add a real app icon / logo mark.
- [ ] Review mobile layout after desktop builder stabilizes.
- [ ] Add loading states for Pokemon, item, and move fetches.
- [ ] Add error states for failed PokeAPI requests.
- [ ] Clean up generated assets and keep third-party notices current.
- [ ] Run `npm run lint` before wrapping UI work.
- [ ] Run `npm run build` before public deployment.

## Done Recently

- [x] Centralize slot mutations, nature/stat rules, and repeated move-detail UI.
- [x] Load real Pokemon data from PokeAPI.
- [x] Add Pokemon name search with type-to-filter behavior.
- [x] Add regional form, form-change, and Mega selection handling.
- [x] Add item search and Mega Stone auto-lock behavior.
- [x] Add all natures with a stat alignment table.
- [x] Switch EV/stat calculation to Pokemon Champions-style EV assumptions.
- [x] Load real move details and legal-by-PokeAPI move lists.
- [x] Sort moves by type, then alphabetically.
- [x] Add move detail tooltips.
- [x] Add item and ability detail tooltips.
- [x] Add custom type icons from third-party SVG assets.
- [x] Add `THIRD_PARTY_NOTICES.md` for MIT-licensed type icons.
- [x] Add Font Awesome and Pokemon Showdown third-party notices.
- [x] Compact team tabs and use small icon sprites.
- [x] Rework Pokemon artwork as a translucent card background layer.
- [x] Add Pokemon Showdown-backed Regulation M-B legality filtering for Pokemon, items, abilities, and per-Pokemon moves.
- [x] Verify M-B move legality against a real Pokemon Champions Charizard learnset check.
- [x] Add keyboard navigation for Pokemon, item, ability, nature, and move pickers.
- [x] Make hover-to-keyboard selection flow consistent across Pokemon, item, ability, and move pickers.
- [x] Add fallback item display for items without sprites.
- [x] Replace the header brand with Font Awesome team action icon buttons.
- [x] Add Showdown text import/export and move Pokemon slot tabs to the card side.
- [x] Add Smogon monthly usage stats fetching for popular Pokemon default sets.
- [x] Add localStorage saved-team management with load, rename, duplicate, delete, reorder, and last-opened team restore.
- [x] Add Pokemon-level and team-level Showdown text import/export.
