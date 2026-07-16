# PokePilot AI Roadmap

## MVP Scope

The MVP should prove the core loop:

1. Select team members from a Pokemon data index.
2. Edit one displayed Pokemon at a time through a polished builder card.
3. Validate Pokemon, item, ability, move, and stat choices against the target format.
4. Surface team-level diagnostics.
5. Ask PokePilot to analyze the team and eventually answer follow-up questions.
6. Deploy the app publicly.

## Phase 1 - Static Prototype

- Create the app shell.
- Build the mockup-driven builder screen.
- Add a persistent six-member Team Rail beside a single Pokemon editor card.
- Keep the header compact and focused on team-management actions.
- Stack a wide, low builder and compact matchup diagnostics beside a persistent full-height PokePilot panel.
- Cap the desktop workspace at 1920px so ultrawide layouts retain readable line lengths and scanning distance.
- Keep the first screen focused on actual builder controls, not marketing copy.

## Phase 2 - Data and Visualization

- [x] Load the full Pokemon index from the shared cached Showdown Pokedex snapshot.
- [x] Fetch selected Pokemon details on demand.
- [x] Display Pokemon types, sprite/artwork, abilities, base stats, and move names.
- [x] Implement Pokemon Champions-style EV editing with fixed IV assumptions and nature modifiers.
- [x] Add reliable move details: type, power, accuracy, PP, description, and tags.
- [x] Make Showdown the primary selected-Pokemon battle-data source for types,
  base stats, abilities, legal move IDs, and complete move details.
- [x] Reduce PokeAPI selected-Pokemon usage to artwork/icon lookup and fallback,
  eliminating per-move PokeAPI requests.
- [x] Add searchable item and move selectors.
- [x] Add keyboard navigation for Pokemon, item, ability, nature, and move selectors.
- [x] Use 20-at-a-time infinite loading with hidden scrollbars across Pokemon,
  item, ability, and move option lists, including empty-slot candidate filters.
- [x] Show Smogon usage rank instead of Pokedex number in Pokemon picker results.
- [x] Add item, ability, and move detail tooltips.
- [x] Add compact defensive matchup and coverage-gap visualization while retaining roles and alerts as structured PokePilot input.
- [x] Add a sixth Setter role for field, weather, screens, terrain, and hazard setup.
- [x] Detect major field and weather concepts, their setters and aces, and whether a complete core has an off-mode attacker.

## Phase 3 - Regulation Legality

- [x] Identify Pokemon Showdown data as the current Pokemon Champions Regulation M-B legality source.
- [x] Restrict Pokemon selection to currently legal Pokemon.
- [x] Restrict items to legal M-B items.
- [x] Restrict abilities to abilities available to the selected Pokemon.
- [x] Restrict moves to legal M-B moves for the selected Pokemon.
- [x] Add compact validity status and detailed warnings for configured set choices.
- [x] Add regression checks for representative legality cases.
- [x] Introduce Vitest with deterministic stat, diagnostics, and Showdown text regression tests.
- [x] Add first validity regression fixtures for legal sets, illegal choices, Mega Stones, EVs, and team clauses.
- [x] Expand Vitest coverage to representative raw Showdown legality and alias/form cases.
- [x] Move the main Pokemon index and form metadata to a Showdown-backed model
  carrying canonical Showdown IDs and PokeAPI-compatible asset lookup IDs.
- [x] Replace PokeAPI item and ability detail requests with compact generated
  Showdown catalogs while retaining PokeAPI item sprite assets.
- [x] Replace the large runtime legality-table download with a compact Regulation
  M-B snapshot.
- [x] Complete the post-migration cleanup: share canonical Showdown ID helpers,
  consolidate legacy browser-cache cleanup, memoize the hydrated legality snapshot,
  and remove redundant base-form move requests from the editor.

## Phase 4 - AI Assistant

- [x] Start with structured analysis of the active team and selected Pokemon.
- [x] Feed deterministic field/weather concept summaries into local team analysis and recommendations.
- [x] Keep deterministic diagnostics, legality, stat calculations, and future damage
  calculations as the factual source of truth.
- [x] Define provider-independent request and response types so the Copilot UI can be
  built and tested before committing to a hosted model provider.
- [ ] Add a server-side API route and send structured team, diagnostic, and validity
  data to the AI model.
- [ ] Request JSON output with clear summary, strength, weakness, priority, and
  recommendation fields, then validate it before rendering.
- [x] Display local analysis as structured product UI in the right-side Copilot panel rather
  than as an unrestricted chat transcript.
- [ ] Recheck actionable AI suggestions with deterministic legality logic before they
  can be applied to a set or team.
- [ ] Add constrained follow-up chat tied to the current team state only after the
  first analysis flow is stable.
- [ ] Add request limits, response caps, caching, and graceful API-unavailable behavior
  before public deployment.

## Phase 5 - Persistence and Polish

- [x] Save and load teams through localStorage.
- [x] Persist Pokemon slots plus item, ability, nature, EV, move, Mega, and form state.
- [x] Add saved-team management: load, rename, duplicate, delete, and last-opened restore.
- [x] Add Showdown text import/export for individual Pokemon sets and saved teams.
- [x] Use a persistent Team Rail for active-six selection, reordering, and Bench access
  while keeping the single-Pokemon editor as the sole build surface.
- [x] Split the compact new-team action into blank-team creation and direct Showdown team import.
- [x] Add shared pointer, touch-hold, and keyboard reordering for moves, team slots, and saved teams.
- [x] Add a persisted bench outside the active six, with full-build move/swap interactions and no effect on active-team previews, diagnostics, validity, or Showdown export.
- [x] Add shareable PNG build images for individual Pokemon sets and complete active teams.
  - [x] Ship the individual Pokemon preview, clipboard-copy, and PNG-download flow.
  - [x] Add the complete active-team image template and shared preview navigation.
- [ ] Prepare account-backed server persistence after the local MVP is stable.
  - [x] Keep Supabase-managed PostgreSQL as the leading candidate, with Neon as the main database-focused alternative.
  - [ ] Normalize teams and Pokemon sets into server-owned records with active/bench location and ordering.
  - [ ] Store canonical Pokemon, item, ability, nature, and move IDs instead of duplicating display text and asset URLs.
  - [ ] Keep PokeAPI, Showdown, and Smogon responses in client or shared caches rather than user-owned database rows.
  - [ ] Recompute validity, diagnostics, Showdown text, and PokePilot inputs from source team data instead of persisting stale derived output.
  - [ ] Recheck provider free-plan storage, egress, inactivity, and backup limits immediately before deployment.
  - [x] Enforce initial guardrails of 30 saved teams per user and six bench Pokemon per team.
  - [ ] Revisit persistence limits from real usage before public deployment.
- [ ] Add shareable team links if reasonable.
- [ ] Add Korean UI localization.
- [ ] Decide whether Japanese localization belongs in the initial public release.
- [ ] Add dark mode and persist the user's theme preference.
- [ ] Complete the post-layout desktop detail pass for EV editing density, header
  alignment and branding, and Team Rail navigation.
- [ ] Begin the dedicated responsive-design phase only after Team Builder features and desktop UI/UX are stable.
  - [ ] Treat the current responsive CSS as provisional rather than final tablet/mobile design.
  - [ ] Complete a tablet layout and touch-interaction pass.
  - [ ] Complete a mobile layout and touch-interaction pass.
  - [ ] Verify popovers, pickers, reordering, diagnostics, and team management across target viewport sizes.
- [x] Add loading, error, and empty states for the builder's external data sources and pickers.
- [ ] Write a strong portfolio case study.

## Phase 6 - Optional Enhancements

- Compare two teams.
- Lock selected team members and ask AI to fill the rest.
- Add playstyle selection such as casual, balanced, offensive, defensive, or competitive.
- Add format selection if the project later supports specific rule sets.
- Add collaborative or social account features only after basic account-backed persistence proves useful.

## Definition of Done for Portfolio

- Deployed link works.
- README explains purpose, stack, and features.
- No API keys or secrets are committed.
- UI looks polished on desktop and mobile.
- Team builder works with real Pokemon data.
- Regulation legality behavior is clearly documented, even if partial.
- At least one Copilot/AI feature works end-to-end.
- Portfolio case study includes screenshots, problem, solution, technical choices, and future improvements.
