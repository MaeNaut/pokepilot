# PokePilot AI Roadmap

## MVP Scope

The MVP should prove the core loop:

1. Select team members from a Pokemon data index.
2. Edit one displayed Pokemon at a time through a polished builder card.
3. Validate Pokemon, item, ability, move, and stat choices against the target format.
4. Surface team-level diagnostics.
5. Ask Copilot to analyze the team and answer follow-up questions.
6. Deploy the app publicly.

## Phase 1 - Static Prototype

- Create the app shell.
- Build the mockup-driven builder screen.
- Add 6 compact team tabs beside a single Pokemon editor card.
- Keep the header compact and focused on team-management actions.
- Reserve a full-height Copilot panel on the right.
- Keep the first screen focused on actual builder controls, not marketing copy.

## Phase 2 - Data and Visualization

- [x] Load the full PokeAPI Pokemon index and cache it locally.
- [x] Fetch selected Pokemon details on demand.
- [x] Display Pokemon types, sprite/artwork, abilities, base stats, and move names.
- [x] Implement Pokemon Champions-style EV editing with fixed IV assumptions and nature modifiers.
- [x] Add reliable move details: type, power, accuracy, PP, description, and tags.
- [x] Add searchable item and move selectors.
- [x] Add keyboard navigation for Pokemon, item, ability, nature, and move selectors.
- [x] Add item, ability, and move detail tooltips.
- [x] Add team-level defensive matchup, offensive coverage, set-role, and setup-alert visualization.

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

## Phase 4 - AI Assistant

- Add an API route for AI analysis.
- Send structured team data to the AI model.
- Request JSON output with clear fields.
- Parse and validate the response.
- Display recommendations in the right-side Copilot panel.
- Support constrained follow-up chat tied to the current team state.

## Phase 5 - Persistence and Polish

- [x] Save and load teams through localStorage.
- [x] Persist Pokemon slots plus item, ability, nature, EV, move, Mega, and form state.
- [x] Add saved-team management: load, rename, duplicate, delete, and last-opened restore.
- [x] Add Showdown text import/export for individual Pokemon sets and saved teams.
- [x] Add shared pointer, touch-hold, and keyboard reordering for moves, team slots, and saved teams.
- [ ] Keep the saved-team schema compatible with future Supabase/Postgres storage.
- [ ] Add shareable team links if reasonable.
- [ ] Add Korean UI localization.
- [ ] Decide whether Japanese localization belongs in the initial public release.
- [ ] Add dark mode and persist the user's theme preference.
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
- Add user accounts only if persistence becomes important.

## Definition of Done for Portfolio

- Deployed link works.
- README explains purpose, stack, and features.
- No API keys or secrets are committed.
- UI looks polished on desktop and mobile.
- Team builder works with real Pokemon data.
- Regulation legality behavior is clearly documented, even if partial.
- At least one Copilot/AI feature works end-to-end.
- Portfolio case study includes screenshots, problem, solution, technical choices, and future improvements.
