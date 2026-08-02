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

## Phase 4 - Damage Calculator

- [x] Add a dedicated Calculator mode while preserving the shared team-management header.
- [x] Keep PokePilot available beside the Calculator and retain the temporary
      opponent, field, and battle state when moving between app modes.
- [x] Keep My Pokemon and Opponent Pokemon in fixed left/right panels and reverse
  only the damage direction.
- [x] Reuse the active team's complete build state and normal save/dirty workflow
  for My Pokemon.
- [x] Keep the opponent build local to the calculator with direct set and battle-state editing.
- [x] Add a shared, persisted Singles/Doubles header setting that switches
      calculator rules, PokePilot context, and BSS/VGC usage rankings.
- [x] Adapt `@smogon/calc` to Pokemon Champions level 50, fixed IV 31, and
  0-32 stat-point assumptions.
- [x] Support doubles spread damage, weather, terrain, Magic Room, Wonder Room,
  Gravity, Fairy Aura, critical hits, Helping Hand, Tailwind, Friend Guard,
  Plus/Minus activation, burn, defensive screens, current HP, and stat stages.
- [x] Show the damage range, percentage range, current-HP KO chance, multi-hit KO
  summary, and the attacking/defending stats used.
- [x] Restrict calculator Pokemon and items to the Regulation M-B legality
  snapshot and lock matching Mega Stones for Mega forms.
- [x] Lazy-load the calculator UI and engine so it does not join the initial Team
  Builder module.
- [x] Reuse builder visual primitives for Pokemon types, items, moves, and the
  searchable Regulation M-B opponent selector.
- [x] Add an offline external-reference fixture suite for representative
  Regulation M-B singles damage ranges and the combat stats used by each result.
- [ ] Verify additional Pokemon Champions-only mechanics against live reference
  cases and add explicit overrides where upstream generation-9 data is incomplete.
- [ ] Revisit simultaneous two-way results, usage-based opponent defaults,
  opponent presets, and dedicated power/bulk summaries after MVP playtesting.

## Phase 5 - AI Assistant

- [x] Start with structured analysis of the active team and selected Pokemon.
- [x] Feed deterministic field/weather concept summaries into local team analysis and recommendations.
- [x] Keep deterministic diagnostics, legality, stat calculations, and future damage
  calculations as the factual source of truth.
- [x] Define provider-independent request and response types so the Copilot UI can be
  built and tested before committing to a hosted model provider.
- [x] Add an attributed offline evaluation suite with 10 Regulation M-B Singles
  teams, 10 Regulation M-B Doubles teams, and explicit archetype-boundary cases.
- [x] Add a separate four-team deep-strategy regression group for ace funnels,
  ally-triggered stat reversal, same-turn Round sequencing, and manual weather
  counterplay, with a targeted paid-run command.
- [x] Add a GPT-5.6 Luna Standard evaluation adapter, strict output validation,
  token/cost reporting, and reproducible Singles/Doubles smoke runner.
- [x] Enrich hosted-model requests with deterministic localized labels,
  pre/post-Mega states, complete Mega options, move ownership, defensive
  profiles, final stats, ability-immunity causes, normalized move categories,
  physical/special/spread move summaries, and neutral Showdown-backed effects
  and tags for every selected move, ability, and item.
- [x] Establish GPT-5.6 Luna Standard low reasoning as the historical 20-team
  baseline, trial medium after live interaction failures, and return production
  to low after a six-case Prompt v17 A/B found no dependable quality gain for
  medium's higher cost and latency.
- [x] Repeat the four deep-strategy cases three times at Luna Standard low to
  separate schema and cache stability from semantic stability; retain Contrary
  ally targeting and same-turn Round sequencing as explicit prompt regressions.
- [x] Add prompt v22's provider-neutral ally-target, shared-move sequencing,
  effective-Speed, deception, and Imprison-denial audits; resolve the Contrary
  regression and narrow Round to a remaining responder-ranking regression.
- [x] Add prompts v23-v25's private evidence contract: bind interactions to
  legal plans and element owners, validate deterministic ownership/Mega/type/
  Speed facts, require every recommendation to cite verified audit evidence,
  and confirm the clarified contract with a 2/2 live Low smoke test.
- [x] Add a server-side API route and send structured team, diagnostic, and validity
  data to the AI model.
  - [x] Keep the API key and Luna adapter server-only.
  - [x] Accept request-contract v9, call GPT-5.6 Luna Standard at low reasoning,
        and validate the strict response schema at the route boundary.
  - [x] Keep team-combination and phase inference in the model rather than
        encoding fixture-derived partner strategies in the request builder.
  - [x] Require a generic pairwise mechanics audit and opening-turn feasibility
        check before the model commits to a Doubles game plan.
  - [x] Evaluate fast sets as possible hard-Trick-Room leads when their selected
        moves or abilities can secure or exploit the opening turn, without
        treating their lead use as a separate non-Trick-Room mode.
  - [x] Return a private strategy audit with every hosted response and reject
        unowned moves, inactive actors, and malformed selection plans before
        user-facing analysis reaches the browser.
  - [x] Expand the private audit to reject unsupported ability/item/Mega-state
        bindings, impossible simultaneous Mega activations, contradicted
        defensive or final-Speed facts, and ungrounded recommendations.
  - [x] Connect the explicit Analyze Team action while preserving deterministic
        local analysis as the offline/error fallback.
- [x] Request JSON output with clear summary, strength, weakness, priority, and
  recommendation fields, then validate it before rendering.
- [x] Display local analysis as structured product UI in the right-side Copilot panel rather
  than as an unrestricted chat transcript.
- [x] Persist a versioned, bounded local analysis history and restore exact
  team/scope/locale/request matches across reloads and language changes.
  - [x] Render history outside the clipped PokePilot panel and require explicit
        confirmation before deleting the current team's records.
- [ ] Recheck actionable AI suggestions with deterministic legality logic before they
  can be applied to a set or team.
- [ ] Add constrained follow-up chat tied to the current team state only after the
  first analysis flow is stable.
- [ ] Finish request controls for multi-instance public deployment.
  - [x] Key process-local cached analyses by canonical team state, format,
        regulation, locale,
        prompt version, and request-contract version.
  - [x] Add signed anonymous-browser identity, a hashed-IP abuse backstop,
        progressive cooldowns, in-flight deduplication, bounded model output,
        and graceful rules-based fallback UI.
  - [x] Record privacy-safe cache, latency, token, and estimated-cost telemetry.
  - [x] Provide server-start-only cached, fresh-response, and accelerated
        cooldown QA modes while keeping production safeguards as the default.
  - [x] Add an Upstash Redis operations adapter with atomic cross-instance
        limiter decisions, canonical response storage, and distributed request
        leases; retain memory storage for local development.
  - [ ] Provision and require the shared store in public deployment, then verify
        cross-instance concurrency, cold starts, and Redis failure behavior.

## Phase 6 - Persistence and Polish

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
- [x] Complete Korean localization.
  - [x] Add a persisted English/Korean language control and typed UI translations.
  - [x] Generate checked-in Korean Pokemon, form, move, item, ability, type,
    nature, and description catalogs from PokeAPI CSV data.
  - [x] Preserve canonical English IDs and Showdown text regardless of display language.
  - [x] Translate deterministic PokePilot prose and remaining validity/detail messages.
  - [x] Run a dedicated Korean text-fit and terminology review across all builder states.
- [ ] Decide whether Japanese localization belongs in the initial public release.
- [x] Add system, light, and dark modes and persist the user's theme preference.
  - [x] Default cold starts to system mode and follow operating-system changes live.
  - [x] Expose all three preferences through the localized header menu.
  - [x] Preserve semantic nature, validity, danger, move-type, and saved-team contrast in dark mode.
  - [x] Preserve the light share-card output while theming the surrounding preview dialog.
- [x] Complete the post-layout desktop detail pass for EV editing density, header
  alignment and branding, and Team Rail navigation.
- [ ] Complete the dedicated responsive-design phase now that Team Builder features and desktop UI/UX are stable.
  - [x] Establish the first tablet workspace: preserve the complete Pokemon card, move PokePilot into a right-edge overlay drawer, and fit short landscape viewports without page overflow.
  - [x] Complete the tablet popover, picker, team-management, drawer, orientation, and touch-interaction audit across representative emulated devices.
  - [x] Replace hover-dependent compact pickers with shared Pokemon, item, ability, and move selection dialogs that keep previews visible until explicit confirmation.
  - [ ] Run a non-blocking real-device Safari pass for safe areas, dynamic browser chrome, the virtual keyboard, and long-press gestures.
  - [x] Establish the mobile workspace with a compact header, horizontal Team Rail, single-column editor, and near-full-screen PokePilot drawer.
  - [x] Verify core mobile layout, picker, team-management, and orientation behavior across representative emulated phones.
  - [ ] Run a non-blocking real-device mobile pass for long-press reordering, EV sliders, safe areas, dynamic browser chrome, and the virtual keyboard.
  - [x] Verify popovers, pickers, reordering, diagnostics, and team management across target tablet viewport sizes.
- [x] Add loading, error, and empty states for the builder's external data sources and pickers.
- [ ] Write a strong portfolio case study.

## Phase 7 - Optional Enhancements

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
