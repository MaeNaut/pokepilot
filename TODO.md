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

- [ ] Add a Pokemon sample card / team view switch.
  - [ ] Keep the current single-Pokemon editor as the sample card view.
  - [ ] Design a compact whole-team view without duplicating team-management controls.
  - [ ] Preserve the selected slot and unsaved edits when switching views.
- [x] Replace the Copilot panel placeholder with a working local analysis preview.
  - [x] Add team and selected-Pokemon analysis scopes.
  - [x] Keep deterministic team diagnostics outside the future AI response area.
  - [x] Contain long analysis inside a panel-local scroller instead of growing the desktop page.
- [x] Add team-level non-AI diagnostics.
  - [x] Type weakness/resistance summary.
  - [x] Apply fixed type-immunity abilities to defensive matchups and alerts.
  - [x] Offensive coverage summary.
  - [x] Set-based physical attacker, special attacker, wall, supporter, and setter summaries.
  - [x] Classify field, weather, screen, terrain, and hazard setup as the sixth Setter role.
  - [x] Detect Trick Room, Tailwind, Gravity, rain, sun, sand, and snow team concepts.
  - [x] Distinguish concept setters, dependent aces, and independent off-mode attackers.
  - [x] Treat setup-only detection as informational data, not a reason to demand a dedicated ace.
  - [x] Warn about explicit weather dependency without a setter and complete modes without an off-mode attacker.
  - [x] Duplicate type warnings.
  - [x] Role-based physical/special attacker imbalance warnings.
  - [x] Role-based physical/special wall imbalance warnings.
  - [x] Avoid false completion warnings for intentional no-item or sub-four-move sets.
  - [x] Unify matchup, coverage, role, and alert surfaces with the builder UI.
- [ ] Improve move editing.
  - [x] Keep the current move visible when opening the move dropdown.
  - [x] Preserve natural keyboard scrolling and prevent hover-triggered scroll loops.
  - [x] Reorder selected moves with desktop drag, touch hold-and-drag, or keyboard shortcuts.
  - [x] Add a clear action and a stable empty state for each of the four move slots.
  - [ ] Decide whether selected moves should show PP or only power.
- [ ] Improve item editing.
  - [ ] Keep Mega Stone auto-lock behavior tested after future item changes.
  - [x] Allow ordinary held items to be cleared while preserving locked Mega Stones.
- [x] Improve EV editing with desktop value scrubbing, touch controls, and allocation gauges.
- [x] Put compact team diagnostics between the Pokemon card and Copilot panel.
  - [x] Keep the Pokemon card focused on the selected set.
  - [x] Reserve Copilot for future AI interpretation and recommendations.

## Team Management

- [ ] Design a serializable `TeamBuildState`.
  - [x] Include Pokemon slot identity.
  - [x] Include item, ability, nature, EVs, moves, and Mega/form state.
  - [x] Add a saved-team schema version for future migrations.
  - [ ] Keep the format compatible with future Supabase/Postgres storage.
    - [x] Separate user-owned team data conceptually from PokeAPI, Showdown, and Smogon caches.
    - [ ] Draft normalized `teams` and `pokemon_sets` tables with active/bench location and ordering.
    - [ ] Reduce persisted Pokemon sets to canonical IDs plus editable build values when the server migration begins.
    - [ ] Add a regulation/format identifier so saved teams can be revalidated against later rule data.
    - [x] Enforce current limits of 30 saved teams and six bench Pokemon per team without deleting legacy over-limit data.
    - [ ] Revisit the limits from real usage before treating them as permanent public-product rules.
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
  - [x] New team icon opens blank-team and direct Showdown-import actions.
  - [x] Treat a direct Showdown import as a new unsaved team and preserve pasted text when its discard warning is cancelled.
  - [x] List icon opens team management.
- [x] Add bench Pokemon support.
  - [x] Keep bench Pokemon outside the six active team slots.
  - [x] Preserve the complete item, ability, nature, EV, move, Mega, and form build while benched.
  - [x] Move or swap Pokemon between bench and active slots with pointer drag, touch hold-and-drag, or direct selection.
  - [x] Persist bench entries with saved teams while excluding them from team previews and Showdown text.
  - [x] Keep validity, diagnostics, and PokePilot analysis focused on the active six.

## Data And Legality

- [x] Fix Showdown text species-name compatibility for Pokemon forms and Mega Evolutions.
  - [x] Export canonical Showdown species names instead of PokePilot-only form labels or IDs.
  - [x] Cover Mega, regional, gender, and selectable form names without changing their saved canonical identity.
  - [x] Add import-export round-trip fixtures whose output can be pasted into Pokemon Showdown without species-name errors.
- [x] Add a Vitest regression-test foundation for pure application logic.
  - [x] Cover Champions stat and nature calculations.
  - [x] Cover team diagnostic multipliers, ability immunities, roles, concepts, and alerts.
  - [x] Cover Showdown text formatting and parsing.
  - [x] Cover first-pass set validity, Mega Stone matching, EV limits, Species Clause, and Item Clause.
  - [x] Add representative Regulation M-B legality and form-alias fixtures.

- [ ] Harden the Pokemon Champions Regulation M-B legality layer.
  - [x] Share and locally cache normalized Showdown Pokedex and move snapshots.
  - [x] Use Showdown as the primary selected-Pokemon source for types, base stats, abilities, legal move IDs, and move details.
  - [x] Keep PokeAPI selected-Pokemon requests only for artwork/icon URLs and fallback data.
  - [x] Remove per-move PokeAPI requests and deduplicate concurrent Pokemon and legality loads.
  - [x] Add regression checks against representative raw Showdown Pokemon, item, ability, and move snapshots.
  - [x] Move the main Pokemon index and form metadata to a Showdown-backed model carrying canonical source IDs and PokeAPI-compatible asset IDs.
  - [x] Replace PokeAPI item and ability detail requests with compact Showdown-derived data.
  - [x] Replace the large runtime teambuilder-table download with a compact Regulation M-B snapshot.
  - [x] Finish the post-migration refactor and remove duplicate ID, cache, and form-move loading paths.
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
- [x] Add a compact validity trigger, issue popover, and per-slot problem markers.
- [ ] Extend validity beyond the current editor surface if level, gender, or complex format rules are added.

## AI / Copilot

- [x] Decide the first AI feature shape.
  - [x] Start with structured analysis of the active team and selected Pokemon.
  - [x] Keep deterministic diagnostics and legality as the factual source of truth.
  - [ ] Add limited follow-up chat after the first analysis flow is stable.
  - [ ] Add recommendation generation from locked team slots later.
- [x] Define a provider-independent Copilot request and response contract.
  - [x] Send structured team, selected Pokemon, diagnostics, and validity summaries rather than raw UI text.
  - [x] Render summary, strengths, weaknesses, priorities, and recommendations as product UI rather than plain chat text.
  - [x] Add regression tests for compact request snapshots and local team/Pokemon analysis.
- [ ] Add a server-side API route for AI analysis when model integration begins.
  - [ ] Keep API keys out of browser code.
  - [ ] Call analysis explicitly rather than automatically on every team edit.
- [ ] Validate AI output before rendering it.
  - [ ] Recheck suggested Pokemon, items, abilities, and moves with deterministic legality logic before offering an apply action.
  - [ ] Keep AI output clearly advisory, not authoritative legality or calculator data.
- [x] Add local error, refresh, and stale-analysis states for Copilot.
- [ ] Add a remote API-unavailable state when hosted model integration begins.
- [ ] Add deployment-stage cost controls such as request limits, response caps, and team-analysis caching.
  - [ ] Avoid unbounded AI analysis or chat history in the primary team database.
  - [ ] Keep calculator history local or capped unless users explicitly need cloud history.

## Calculator

- [ ] Add a calculator mode to the app.
  - [ ] Decide whether it should be a damage calculator, stat calculator, or both.
  - [ ] Add navigation between Team Builder and Calculator.
  - [ ] Reuse the same Pokemon/item/move data model where possible.
  - [ ] Keep the calculator compatible with Pokemon Champions assumptions.

## Polish

- [ ] Add a real app icon / logo mark.
- [ ] Defer the dedicated tablet/mobile UI pass until Team Builder functionality and desktop UI/UX are complete.
  - [ ] Audit the provisional responsive CSS before treating any current breakpoint behavior as final.
  - [ ] Design the tablet workspace layout and verify touch-first editing interactions.
  - [ ] Design the mobile workspace layout and verify touch-first editing interactions.
  - [ ] Test text fit, overflow, popover placement, drag/hold reordering, and scroll behavior at representative widths.
- [x] Add loading states for Pokemon, item, and move fetches.
- [x] Add local error and Retry states for failed PokeAPI, Showdown legality, and Smogon usage requests.
- [ ] Clean up generated assets and keep third-party notices current.
- [ ] Run `npm run lint` before wrapping UI work.
- [ ] Run `npm run build` before public deployment.

## Done Recently

- [x] Centralize slot mutations, nature/stat rules, and repeated move-detail UI.
- [x] Load Pokemon battle data from Showdown with PokeAPI artwork/icon fallback.
- [x] Add Pokemon name search with type-to-filter behavior.
- [x] Add regional form, form-change, and Mega selection handling.
- [x] Add item search and Mega Stone auto-lock behavior.
- [x] Add all natures with a stat alignment table.
- [x] Switch EV/stat calculation to Pokemon Champions-style EV assumptions.
- [x] Load complete move details and legal move lists from Showdown without per-move PokeAPI requests.
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
