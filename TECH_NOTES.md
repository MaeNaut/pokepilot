# PokePilot AI Technical Notes

## Recommended Stack

- Frontend: React + TypeScript
- Styling: Tailwind CSS or a small custom CSS system
- Framework option: Next.js if API routes and deployment simplicity are useful
- AI: OpenAI API or another LLM provider through a server-side API route
- Data: localStorage first; Supabase-managed PostgreSQL is the leading server-persistence candidate, with Neon as the primary alternative
- Deployment: Vercel or another simple web deployment platform

## Skills This Project Can Demonstrate

- TypeScript
- React component architecture
- API route design
- AI prompt / response structuring
- JSON parsing and validation
- data visualization
- responsive UI
- product thinking
- game-system analysis
- deployment workflow

## Skill Gap Coverage

This project is also meant to fill practical skill gaps that have appeared repeatedly in job postings.

- TypeScript: Build the app in TypeScript from the start so the project can support TypeScript claims honestly.
- API routes: Keep AI calls server-side through API routes instead of calling model APIs directly from browser code.
- PostgreSQL / SQL: Add persistence later through Supabase or PostgreSQL for saved teams, shared builds, user preferences, and bounded analysis caches.
- AI API integration: Use an LLM API for structured team analysis and recommendations, then render the output as product UI.
- Deployment: Deploy the app publicly through Vercel or a similar platform and keep a live link for the portfolio.
- GitHub Actions: Add a simple lint/build workflow later to demonstrate basic CI/CD experience.
- Testing: Use Vitest for deterministic stat, parser, alias, legality, team-diagnostic,
  and local Copilot-contract regression tests. Keep live PokeAPI, Showdown, and
  Smogon requests out of the unit-test suite.
- Legality fixtures: Keep small Showdown, PokeAPI, and compact M-B snapshot
  fixtures under `src/test/fixtures`. Use them to exercise snapshot hydration,
  source normalization, and form aliases without making network requests during
  tests. Add cases when a newly fixed Pokemon, form, item, ability, or move could regress.
- Data visualization: Use type coverage, weakness matrices, and team balance charts to show frontend and product depth.

Avoid forcing these skills into the project too early:

- Python: Not necessary for the MVP unless a later backend or data-processing need clearly appears.
- AWS: Useful in some job postings, but too heavy for the first version compared with Vercel/Supabase.
- Custom ML training: Out of scope; the goal is AI-assisted product development, not model training.

## Data Strategy

Current direction:

- Start a first-time session with six empty team slots. Restore the last active
  saved team when one exists, but do not hydrate a bundled demo team on cold start.
- Build the full Pokemon picker index from the locally cached Showdown Pokedex
  snapshot instead of issuing a separate PokeAPI `/pokemon?limit=5000` request.
- Keep canonical Showdown IDs on index entries while preserving the current dashed
  Pokemon IDs required by saved teams, imports, UI form logic, and PokeAPI assets.
- Preserve each hydrated Pokemon's canonical Showdown species ID and display name
  separately from PokePilot's UI ID and label. Showdown text export must use the
  canonical name, while gender markers such as Pyroar `(M)` or `(F)` remain explicit
  header metadata and survive import/export round trips.
- Load and normalize Showdown `pokedex.json` and `moves.json` through one shared,
  in-flight-deduplicated loader with a 12-hour local cache.
- Use Showdown as the selected Pokemon's primary source for types, abilities,
  base stats, legal move IDs, move metadata, descriptions, and tags.
- Fetch PokeAPI Pokemon details only when the user selects a Pokemon, using the
  response for artwork and icon sprite URLs and as a fallback when Showdown data
  is unavailable. Cache fully hydrated Showdown-backed Pokemon in `localStorage`.
- Remove legacy per-move PokeAPI caches during the battle-data cache migration;
  move details now come from the single Showdown move snapshot instead of one
  PokeAPI request per move.
- Generate compact item and ability catalogs plus the Regulation M-B legality
  snapshot with `npm run data:showdown`, then serve the checked-in JSON from
  `public/data`. The generator may consume Showdown's large teambuilder table,
  base learnsets, and Champions mod files, but end-user browsers do not. The
  browser loads each compact artifact once through an
  in-flight-deduplicated promise and normal HTTP caching rather than issuing one
  PokeAPI request per item or ability.
- Keep only canonical legal and known Pokemon IDs, legal item IDs, and the
  ability/move maps needed by legal Pokemon and their base species in the M-B
  snapshot. Hydrate these arrays into Set/Map structures at runtime. Do not keep
  a second localStorage legality cache for the checked-in file; normal HTTP cache
  and the in-memory request promise are sufficient.
- Keep canonical compact Showdown IDs beside dashed PokeAPI-compatible item asset
  IDs. Detect Mega Stones from Showdown's actual `megaStone` metadata instead of
  category requests or item-name heuristics.
- Keep canonical ID normalization and fallback display-label formatting in
  `src/api/showdownIds.ts`. Data, legality, catalog, usage, and editor code should
  not maintain separate punctuation-stripping implementations.
- Run the one-time browser-cache migration through `legacyDataCache.ts` instead of
  making each data adapter rescan localStorage independently. Current Pokemon
  cache entries remain intact while obsolete Pokemon, move, item, ability, index,
  and legality keys are removed.
- Construct item image URLs from the `PokeAPI/sprites` generation-9 item directory
  and fall back to the general item directory when an image is missing. PokeAPI
  remains an asset source here, not the item metadata source.
- Normalize the Showdown Pokemon index into UI metadata:
  - regional forms stay in the main Pokemon picker but sort under the original
    species dex number
  - form-change variants generally stay in the main Pokemon picker so usage stats,
    legal moves, and form-specific data can load independently
  - cosmetic or battle-only forms that should not be selected directly, such as
    Pikachu caps, Castform weather forms, Mimikyu Busted, Mimikyu Totem forms,
    Aegislash Blade, and Palafin Hero are hidden from the main picker
  - battle-triggered Aegislash, Morpeko, and Palafin forms use compact controls
    beside the Pokemon name while Shield, Full Belly, and Zero remain their
    main-picker defaults
  - default battle-state suffixes are hidden from picker display names for
    Aegislash Shield, Mimikyu Disguised, Morpeko Full Belly, and Palafin Zero;
    their internal form IDs remain unchanged, and regional/gender suffixes stay visible
  - mega evolutions are hidden from the main picker and exposed through the
    selected Pokemon's mega control
- Keep PokeAPI as the current selected-Pokemon sprite/artwork source and as the
  item-image repository. Item metadata and ability descriptions now come from
  the generated Showdown catalogs.
- Use PokeAPI generation-specific icon sprites first. If that path is missing,
  fall back to PokeAPI `front_default` before older generation icon paths so
  Pokemon without current icons can still use the more detailed 96x96 sprite in
  team tabs and previews. Keep the large card artwork on PokeAPI artwork/front
  sprite URLs.
- Use Pokemon Showdown as the current battle-data and Regulation M-B legality
  source for:
  - Pokemon types, base stats, and abilities
  - move type, category, power, accuracy, PP, description, and tags
  - legal Pokemon
  - legal items
  - legal abilities per Pokemon
  - legal moves per Pokemon
- Use Smogon monthly moveset usage stats as the first popular-set source. The
  app tries the latest month first, falls back through recent months, and prefers
  the 1630 cutoff before lower cutoffs.
- Fetch Smogon usage stats through the same-origin `/smogon-stats` path. In local
  development this is handled by the Vite dev proxy because Smogon does not send
  browser CORS headers.
- Keep external-data feedback local to the control that needs it. Pokemon and
  item pickers show loading or Retry rows, Smogon usage-order failures leave
  normal Pokemon search available, and Showdown failures are retried from the
  validity popover instead of occupying the global footer. Preserve already
  loaded data while a retry is in progress so the builder does not blank itself.
- Keep Showdown battle-data normalization, compact legality hydration, and
  PokeAPI asset lookup as separate adapters so source mapping stays maintainable.
- Generate Mega Floette's move map from Eternal Floette's learnset. The current
  Champions source exposes the Mega form without that parent relationship, so
  this explicit generation-time override keeps Light of Ruin legal and selected
  across Mega toggles without adding a UI-only exception.
- Retain a successfully hydrated Regulation M-B snapshot for the browser session.
  Failed loads are not memoized, so the existing Retry flow can request the file
  again. Form Pokemon already receive their legal base-species move union from the
  Pokemon data adapter; the editor should not issue a second base-form request.
- Keep set validation in a deterministic utility separate from picker filtering.
  The first pass validates configured Pokemon, items, abilities, moves, natures,
  Champions EV limits, active Mega Stone matching, Species Clause, and Item
  Clause. Missing optional items and sets with fewer than four configured moves
  are intentionally not treated as errors. A failed or incomplete legality
  snapshot produces an unavailable state rather than a false invalid result.
- Treat this validity layer as coverage for the current editor surface, not as a
  complete replacement for Pokemon Showdown's full team validator. Add level,
  gender, and complex rule checks only when those fields enter the app model.

The user is comfortable using Pokemon names and sprites/artwork for this unofficial
portfolio tool. Continue to avoid official logos, official UI branding, and any
claim of affiliation.

## Builder UX Notes

Desktop UX decisions after the wide-builder layout change:

- Evaluate replacing fine-pointer horizontal EV scrubbing with six vertical sliders
  placed above their corresponding stats. The goal is to use the open right side of
  the card without making EV allocation slower or less precise.
- The compact header team-management group shares the Pokemon card's left edge,
  the team-name field is capped at 240px, and the PokePilot wordmark occupies the
  original left-side header position.
- Revisit the relationship between Team View and Pokemon View before adding a
  one-off back button. The final navigation should make editing and returning
  obvious, preserve access to the Bench tab, and avoid undersized edit targets on
  pointer or touch devices.
- Keep Team View EV allocations separated into compact stat-value pairs with a
  stronger label, darker values, and a subtle divider from the move grid.
- In Team View, keep the item beneath the Pokemon name and pin type icons to the
  upper-right corner. Reinvest the removed item row in larger metadata and move
  typography while preserving the shared card height used by Pokemon View.

- The main builder switches between the existing single-Pokemon editor and a
  compact two-column overview of the active six. Both views read the same live
  team and `useTeamBuildState` records, so switching does not copy, reset, or
  persist a second version of unsaved edits.
- Clicking an overview slot returns to the single-Pokemon editor with that slot
  selected. Empty overview slots use the same Pokemon-search entry flow.
- Team members are shown as compact tabs/bookmarks on the left side of the card.
- The displayed Pokemon is changed by clicking a team tab.
- Filled team tabs can be reordered with desktop drag, touch hold-and-drag, or
  `Alt+Arrow` keyboard controls. The Pokemon and its item, ability, nature, EVs,
  moves, and Mega/form state move together, including when moved through empty slots.
- The Pokemon name itself is the selector. In closed state it is large text; when
  opened, it becomes a same-style editable search field with a filtered dropdown.
- With usage stats available, the empty-query name dropdown shows Pokemon in
  Smogon usage order, 20 at a time, and appends more entries as the user scrolls.
- Opening/closing the name picker must not shift the rest of the card layout.
- Clicking outside the name picker closes it and clears the temporary search query.
- Form-change variants are selected from the main Pokemon dropdown, while Mega
  evolutions remain adjacent controls next to the Pokemon name.
- If the selected Pokemon has mega evolutions, show compact original mega controls
  beside the Pokemon name rather than listing mega Pokemon in the main search.
- The large Pokemon name header should show only the base species name; regional,
  form-change, gender, and mega state should avoid lengthening the header text
  unnecessarily.
- The item control should render as an icon-only button inside the card. Opening
  it should show a searchable dropdown backed by the compact Showdown item catalog.
- Pokemon-specific Mega Stones should be filtered from the item dropdown unless
  they belong to the currently selected Pokemon. Use Showdown's explicit Mega
  Stone metadata so newly added stones stay hidden by default. If a Mega form is selected, the held item should
  automatically lock to that Mega Stone when it can be matched. New Mega forms
  whose stone names are not exact species-name matches use a best-prefix match
  against known Mega Stone names.
- Z-A and Champions Mega forms now enter the picker metadata through Showdown
  rather than depending on high-numbered PokeAPI index entries. PokeAPI remains
  responsible for their selected artwork and icon lookup where assets exist.
- The Pokemon sprite/artwork should sit on the right side of the card and be
  intentionally cropped off the card edge.
- The card should contain only Pokemon editing information. Avoid putting app
  metadata such as "Team Builder", "Build your six", sample buttons, validity
  status, or data-source notices inside the Pokemon card.

## Current Builder Data Model

- Team has six slots.
- Slots can be empty. Each filled slot stores a selected Pokemon plus local UI
  choices for item, ability, nature, EVs, moves, and Mega/form state.
- `useTeamBuildState` owns slot-level patch, clear, reorder, replacement, and
  snapshot operations. Callers should not repeat the same mutation across all six
  per-slot records.
- IV is fixed through the Pokemon Champions-style displayed stat assumption.
- Stat calculation uses Pokemon Champions-style EV limits, fixed IV assumptions,
  and nature modifiers.
- Nature definitions, EV limits, and displayed-stat calculation live in
  `src/data/natures.ts` so the editor and role diagnostics use the same rules.
- EV cells keep direct keyboard entry. Fine-pointer desktop users can scrub the
  number horizontally at one EV per five pixels. Touch layouts retain the
  anchored slider and one-point buttons. Every path clamps against the per-stat
  maximum and remaining 66-point budget.
- Nature options use the full nature table with raised/lowered stat visualization.
- Item options are filtered through the Regulation M-B legality layer, with
  Pokemon-specific Mega Stone hiding and Mega form auto-lock behavior on top.
- Move options are filtered through the Regulation M-B legality layer and display
  Showdown-backed type, power, accuracy, PP, description, and tags.
- Shared move-pill content and tooltip markup live in `MoveDetails.tsx`; the
  selected move and dropdown preview should not maintain separate copies.
- Move category icons use the EssentiarumVG Gen 8 glyph mapping: `J` for physical,
  `T` for special, and `U` for status. The font is restricted to personal,
  non-commercial use unless the creator grants additional permission.
- Pokemon, item, ability, nature, and move pickers support keyboard navigation
  with hover-to-keyboard active selection continuity.
- The move picker opens scrolled to the current move, uses natural nearest-scroll
  behavior for keyboard navigation, and prevents mouse hover from triggering
  scroll loops.
- Selected moves can be reordered from the card. Mouse pointers activate after a
  short movement threshold, touch pointers activate after a brief hold, and
  `Alt+ArrowUp` / `Alt+ArrowDown` provides the keyboard equivalent. Reordering
  updates the stored move array, so saved teams and Showdown export preserve it.
- Move, active-team-slot, bench, and saved-team reordering share
  `useLongPressReorder`. The hook owns mouse thresholds, touch hold activation,
  click suppression, keyboard-independent pointer state, and the short drop
  settling animation so all four surfaces keep the same interaction feel.
- Pokemon picked from the main name dropdown can auto-apply a popular Smogon
  moveset usage sample. Form changes, Mega toggles, saved-team loads, and
  Showdown imports do not trigger usage auto-application.
- Saved teams are currently persisted in localStorage with a schema version,
  team name, timestamps, six active slots, bench entries, and per-Pokemon build
  details. Saved-team types, normalization, serialization helpers, fallback
  hydration data, and localStorage keys live in `src/utils/teamStorage.ts` rather
  than the app shell. The model is kept plain-JSON so it can later move to
  Supabase/Postgres without changing UI state shape too aggressively.
- Bench entries store a Pokemon identity and a complete build snapshot. Moving an
  active Pokemon to the seventh Bench tab clears its active slot; moving a bench
  entry onto an occupied slot swaps the two complete sets. Bench entries remain
  outside active-team previews, Showdown export, validity, diagnostics, and
  PokePilot input unless a future feature explicitly opts into bench analysis.
- Saved-team cards can be reordered with desktop drag, touch hold-and-drag, or
  `Alt+Arrow` keyboard controls. The new array order is written to localStorage
  immediately, while expanded rename, delete, or Showdown tools temporarily lock
  reordering to avoid accidental edits.
- Showdown text import/export exists at both Pokemon-slot and saved-team level.
  The compact header new-team menu also accepts a full Showdown team without an
  intermediate save. A successful direct import becomes an unsaved
  `Imported Team`, clears the bench, and still uses the normal discard warning
  before replacing another unsaved draft. Saved-team-card imports continue to
  overwrite that saved team's active six instead. `NewTeamControl.tsx` owns only
  the menu and import-form presentation; `App.tsx` remains responsible for
  parsing, unsaved-change protection, and team-state replacement.
- Empty move slots are stored as empty strings inside the fixed four-position
  move array. This preserves slot order for saving and reordering while
  Showdown export, validity, and diagnostics ignore the empty entries. Showdown
  imports pad missing moves to the same four-position representation.
- Held items may be explicitly cleared. Active Mega forms keep their required
  Mega Stone locked and do not expose the no-item action.

## Server Persistence Direction

- The database engine should remain PostgreSQL. Supabase is the leading managed
  provider because it combines Postgres, authentication, generated APIs, and
  row-level security in one portfolio-friendly stack. Neon remains the main
  alternative if the app later prefers a database-focused serverless service and
  assembles authentication and API routes separately.
- Keep the current localStorage schema as the working client model, not as the
  final relational schema. The server model should start with `teams` and
  `pokemon_sets`; each set should carry a team owner, active or bench location,
  ordering, canonical Pokemon/form ID, item, ability, nature, EVs, moves, and
  pre-Mega identity where needed.
- Current local saves include display names, sprite URLs, icon URLs, and complete
  item objects for convenient offline fallback. Server rows should normally store
  canonical IDs and editable values only, then hydrate shared display metadata
  from the current data layer.
- Do not copy per-browser PokeAPI Pokemon caches, generated Showdown catalogs,
  the shared M-B legality snapshot, or Smogon usage snapshots into each user's database data.
  Keep them in client caches or a shared TTL cache if a server proxy later owns
  those requests.
- Showdown text, calculated stats, validity results, team diagnostics, role and
  concept classifications, and PokePilot request input are derived from the saved
  team. Recompute them so rule and data updates do not leave persisted results
  stale. Store AI output only when a product feature explicitly needs history;
  otherwise keep the latest result as a bounded cache.
- Likely future user-owned records include team folders/tags, a separate Pokemon
  sample library, share visibility and links, limited calculator presets, and
  user preferences. Avoid storing unlimited calculator history, chat transcripts,
  or generated analysis by default.
- Current local guardrails are 30 saved teams per user and six bench Pokemon per
  team. New saves and duplicates stop at the team limit, while active Pokemon
  cannot be added to a full bench. Existing over-limit local data is preserved
  instead of being truncated. These limits are primarily for list UX and abuse
  prevention, not because team records are expected to exhaust a free Postgres
  tier. A larger collection should become a dedicated Sample Library rather than
  an oversized bench.
- A free managed-Postgres plan should cover portfolio deployment and early public
  use when records are normalized and generated assets remain external. Recheck
  official provider storage, egress, inactivity, backup, and authentication limits
  immediately before deployment because plan details are time-sensitive.

## Regulation Target

The intended competitive target is Pokemon Champions Regulation M-B. The current
implementation uses Pokemon Showdown data as the M-B legality source for:

- legal Pokemon
- legal items
- legal moves per Pokemon
- legal abilities per Pokemon

Still needed:

- extend the representative fixtures whenever a new legality-sensitive Pokemon,
  item, ability, or move exception is discovered
- documentation for any known Showdown/PokeAPI naming exceptions
- any newly discovered Pokemon Champions-specific battle-rule differences

## Team Diagnostics

- Keep deterministic team diagnostics as a compact factual surface directly
  below the selected Pokemon editor in the left desktop workspace.
- Render the visible surface as a headerless type report: a 6-by-3 defensive
  matchup matrix on the left and a circular offensive-coverage score on the right.
  Label uncovered-type icons so their meaning is clear without restoring a larger
  explanatory panel.
- Keep the diagnostics panel visually consistent with the builder: use one-line
  panel and section headers, shared 6-8px radii, thin neutral borders, restrained
  gray surfaces, and semantic accent colors only for matchup meaning. Matchup
  cells and coverage gaps should read as parts of one compact reference surface.
- Limit the visible panel to defensive matchups and uncovered defending types.
  Do not show the attacking-type inventory, role summaries, role placeholders,
  or a duplicate alert list.
- Continue calculating roles and alerts as structured PokePilot inputs even
  though they are no longer rendered inside Team Diagnostics.
- Calculate defensive matchups from the shared type chart and the current form's
  displayed typing, then apply selected abilities that fully negate an attacking
  type: Levitate and Earth Eater for Ground; Lightning Rod, Volt Absorb, and Motor
  Drive for Electric; Water Absorb, Storm Drain, and Dry Skin for Water; Flash Fire
  and Well-Baked Body for Fire; and Sap Sipper for Grass. Use the same adjusted
  matchup counts for the defensive table and alert generation. Conditional
  move-family immunities and non-immunity damage modifiers remain outside this
  calculation.
- Calculate offensive coverage from the currently selected damaging move types.
  The displayed score measures how many of the 18 single types can be hit super
  effectively; it is not a full dual-type matchup or damage simulation.
- Classify set roles from the current calculated stats, EVs, nature, and selected
  moves. Roles are multi-label: one Pokemon can be both an attacker and supporter.
  Keep role assignment conservative: attacker roles require offensive EV or nature
  commitment plus matching attacks and a clear physical/special lean. Wall roles
  require at least 24 direct defensive EVs, 48 combined HP-plus-defense EVs,
  sufficient bulk, multiple defensive moves, and a nature or stat lean toward that
  defense. Supporter roles use a maintained list of doubles-oriented support moves
  and can also recognize a support ability paired with utility.
- Treat Setter as a separate sixth role. A selected weather or terrain ability, or
  a field, weather, screen, terrain, or entry-hazard move, is enough to assign it.
  Setter and Supporter remain independent labels so offensive weather setters and
  utility-heavy screen setters can be described accurately.
- Analyze Trick Room, Tailwind, Gravity, rain, sun, sand, and snow as deterministic
  team concepts. Record setup slots, compatible ace candidates, strongly dependent
  aces, and independently classified attackers that can function outside the mode.
  Field concepts require an actual setter before they are inferred; only explicit
  weather-dependent abilities may produce a beneficiary-without-setter warning.
- Keep setup-only concepts observational. Weather, field, or room setup may be used
  for a setter's own value or as counterplay, so its presence alone must not demand
  a dedicated ace. Warn only for explicit weather dependency without setup, or a
  completed mode whose dependent aces have no independently classified attacker
  behind them. Feed the same concept summaries into the local PokePilot playstyle,
  strengths, and recommendation output.
- Continue calculating alerts for shared weaknesses, open team slots, repeated
  typing, and role-based attacker or wall imbalance, but pass them to PokePilot
  instead of repeating them in the visible diagnostics panel. Only flag role
  imbalance when one
  physical/special side has at least two classified members and the opposite side
  has none; teams with neither side represented should not be warned. Prioritize
  danger and warning alerts over informational alerts before applying the display
  limit. Do not treat missing held items or fewer than four moves as automatically
  incomplete because both can be intentional set choices.
- Keep role and concept analysis independent from React rendering so they can be
  regression-tested and reused as structured input for PokePilot.

## AI Response Shape Idea

The preferred AI shape is a team-aware Copilot, not a generic ChatGPT clone. Keep
the Copilot constrained to the current team data and deterministic builder analysis.

The current first slice is a provider-independent local preview:

- `src/utils/copilotAnalysis.ts` creates a versioned, compact request containing
  active sets, the selected slot, deterministic diagnostics, field/weather concept
  summaries, and validity summaries.
- The same module returns structured summary, strength, focus, playstyle, and
  recommendation fields from local rules. The panel footer identifies this as a
  `Rules-based preview` rather than claiming it is a hosted AI response.
- Team and selected-Pokemon scopes keep separate results. A request fingerprint marks
  an existing result stale after relevant edits without rerunning analysis on every
  keystroke; changing only the displayed slot does not stale team-scope analysis.
- `CopilotPanel.tsx` renders the structured response and owns idle, loading, local
  error, refresh, and stale states. A future server route should replace only the
  response provider, not the product UI contract.
- On the desktop workspace, cap the content shell at 1920px. Stack a wider,
  shorter builder and compact diagnostics in the left column, and keep the
  full-height PokePilot panel visible in the right column. The Pokemon editor
  places moves and stats side by side, while Team View uses a 3-by-2 grid.
  Long analysis and future chat history scroll inside `copilot-content` so they
  do not increase the document height.

For the first AI route, ask the AI to return structured JSON such as:

```json
{
  "summary": "Short team assessment.",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": [
    {
      "title": "Add a defensive pivot",
      "reason": "...",
      "priority": "high"
    }
  ],
  "playstyle": "balanced"
}
```

Validate and handle bad AI responses gracefully.

## Security Notes

- Keep API keys in `.env.local`.
- Do not call paid AI APIs directly from browser code.
- Keep prompts and model calls server-side.
- Add basic rate limiting or request guards later if the app becomes public.

## Resume Angle

Possible future resume bullet direction:

- Built an AI-assisted team-building web app in React and TypeScript with structured API responses and interactive team analysis.
- Implemented type coverage and weakness visualization to help users evaluate team composition and strategy.
- Designed a deployable product workflow that converts AI-generated recommendations into structured, user-facing UI.
