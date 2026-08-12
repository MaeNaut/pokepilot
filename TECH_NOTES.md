# PokePilot Technical Notes

## Recommended Stack

- Frontend: Vite + React + TypeScript
- Styling: the current custom CSS design system
- Server option: add a small server-side API route or deployment function when hosted AI begins
- AI: OpenAI API or another LLM provider through a server-side API route
- Data: localStorage first; Supabase-managed PostgreSQL is the leading server-persistence candidate, with Neon as the primary alternative
- Damage engine: a typed Pokemon Champions adapter around `@smogon/calc`
- Image export: `html-to-image` for rendering dedicated share-card DOM into PNG blobs
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
  remains an asset source here, not the item metadata source. The generation-9
  directory already includes the added Z-A Mega Stones; Pokemon Showdown's small
  legacy item PNGs are not a higher-quality or more complete replacement.
- Normalize the Showdown Pokemon index into UI metadata:
  - regional forms stay in the main Pokemon picker but sort under the original
    species dex number
  - form-change variants generally stay in the main Pokemon picker so usage stats,
    legal moves, and form-specific data can load independently
  - cosmetic or battle-only forms that should not be selected directly, such as
    Pikachu caps, Castform weather forms, Mimikyu Busted, Mimikyu Totem forms,
    Aegislash Blade, Palafin Hero, and Sinistcha Masterpiece are hidden from the
    main picker
  - battle-triggered Aegislash, Morpeko, and Palafin forms use compact controls
    beside the Pokemon name while Shield, Full Belly, and Zero remain their
    main-picker defaults
  - default-form suffixes are hidden from picker display names for Aegislash
    Shield, Mimikyu Disguised, Morpeko Full Belly, Palafin Zero, Furfrou Natural,
    Gourgeist Average, Lycanroc Midday, and Maushold Family of Four; their
    internal form IDs remain unchanged, and regional/gender qualifiers stay visible
  - Korean picker labels place regional and gender qualifiers before the species
    name, such as `히스이 윈디` and `암컷 냐오닉스`, without changing canonical IDs
  - mega evolutions are hidden from the main picker and exposed through the
    selected Pokemon's mega control
- Keep PokeAPI as the current selected-Pokemon sprite/artwork source and as the
  item-image repository. Item metadata and ability descriptions now come from
  the generated Showdown catalogs.
- Use PokeAPI's Pokemon Champions icon sprites first, followed by the current
  generation icon, `front_default`, and older generation icon paths. Retain the
  ordered fallback list on hydrated and saved Pokemon. At render time, derive a
  Champions candidate from known PokeAPI sprite URLs so legacy saved-team previews
  adopt the new priority without requiring a load-and-resave migration. Keep the
  large card artwork on PokeAPI artwork/front sprite URLs.
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

### Known Showdown / PokeAPI Mapping Exceptions

- PokePilot keeps dashed UI and asset IDs while Showdown uses compact canonical
  IDs. Shared lookup helpers normalize pairs such as `rotom-wash` / `rotomwash`
  instead of letting individual adapters invent their own punctuation rules.
- Showdown represents several gender forms with a base male ID and an `f`
  suffix for the female form. PokePilot exposes explicit `-male` / `-female`
  IDs for Basculegion, Indeedee, Meowstic, and Oinkologne. Pyroar Female is a
  synthetic display and sprite variant based on the shared Pyroar battle-data
  entry; gender remains separate Showdown header metadata during text export.
- Showdown base entries map to explicit PokeAPI-compatible default-form IDs for
  Aegislash Shield, Mimikyu Disguised, Morpeko Full Belly, Palafin Zero,
  Furfrou Natural, Gourgeist Average, Lycanroc Midday, and Maushold Family of
  Four. Their default-state suffixes may be hidden in picker labels without
  changing the stored ID.
- Aegislash Blade, Morpeko Hangry, and Palafin Hero are battle-only alternates.
  They share usage lookup identity with their default forms and are selected
  through compact form controls rather than separate main-picker entries.
- Paldean Tauros IDs add the PokeAPI-style `-breed` suffix in PokePilot while
  lookup aliases also accept the corresponding Showdown name without it.
- Mega forms retain their canonical Showdown species name separately from the
  PokePilot UI ID so exported Showdown text does not reconstruct a name from a
  display label. Mega Floette is also a learnset-source exception: the generated
  M-B snapshot explicitly inherits Eternal Floette's learnset so Light of Ruin
  survives Mega toggles.
- Asset lookup prefers the explicit default-form PokeAPI IDs for Aegislash,
  Mimikyu, Morpeko, and Palafin when the canonical Showdown base ID does not
  identify the intended sprite directly.

The user is comfortable using Pokemon names and sprites/artwork for this unofficial
portfolio tool. Continue to avoid official logos, official UI branding, and any
claim of affiliation.

## Calculator Strategy

- Keep My Pokemon on the left and Opponent Pokemon on the right. Reversing the
  damage direction changes the attacker and defender roles without moving either
  panel, preserving spatial memory while the user tunes a matchup.
- Reuse the active team, selected slot, header team controls, and
  `useTeamBuildState` for My Pokemon. Calculator edits therefore participate in
  the existing unsaved-change and saved-team flow. Keep the opponent build and
  temporary battle state local to `Calculator.tsx`; do not silently add them to a
  saved team.
- Lazy-load `Calculator.tsx` and its `@smogon/calc` dependency so opening the Team
  Builder does not require parsing the damage engine. After the first Calculator
  visit, keep its component mounted while hidden so the local opponent, field, and
  battle state survive normal Builder/Calculator navigation.
- Render the shared `CopilotPanel` outside the app-mode branch so the same PokePilot
  workspace remains available in both Builder and Calculator modes, including the
  existing tablet and mobile drawer behavior.
- Reuse `PokemonIcon`, `TypeBadge`, `ItemSprite`, and `MoveSummary` in Calculator
  surfaces. Keep the opponent picker searchable and keyboard-navigable rather than
  falling back to a browser-native species select.
- Treat `src/calculator/damageCalculator.ts` as the boundary between PokePilot's
  canonical data model and the third-party engine. Pass local species base stats,
  typing, abilities, and move metadata through engine overrides so newly added
  Champions records do not depend entirely on the package's bundled dex.
- Calculate at level 50 with fixed IV 31. A Champions stat-point value of zero maps
  to zero EV, while values 1-32 map to `statPoints * 8 - 4` EV. This produces the
  displayed Champions formulas used elsewhere in the app: HP is
  `base + 75 + stat points`; other stats are `base + 20 + stat points`, followed
  by the nature modifier.
- Treat the header Singles/Doubles control as shared team context. Persist it with
  each saved team and as the latest browser preference, pass it to PokePilot
  requests, and use separate Smogon BSS/VGC Regulation M-B usage snapshots.
  The calculator follows this shared format, enabling spread damage by default
  only in doubles and removing partner-only controls in singles.
- The field model currently supports singles/doubles, weather, terrain, Magic
  Room, Wonder Room, Gravity, Fairy Aura,
  critical hits, Helping Hand, Tailwind, Friend Guard, Plus/Minus activation,
  burn, a unified defensive-wall control, current HP, and Attack/Defense/Special
  Attack/Special Defense stages. The wall control maps to Reflect for physical
  moves and Light Screen for special moves. Plus/Minus only activates when the
  current attacker actually has Plus or Minus.
- Return structured ranges and KO data from the adapter. React localizes the KO
  summary rather than parsing the engine's English description.
- Status moves and missing battle data return explicit unsupported results.
  Generation-9 mechanics covered by `@smogon/calc` are available immediately, but
  newly introduced Champions-only move, item, or ability behavior needs a checked
  local override and a focused regression fixture before it is claimed as exact.
- Keep external calculator checks offline and repeatable in
  `src/test/fixtures/damageCalculatorFixtures.ts`. The initial suite captures
  eight Regulation M-B singles matchups with complete builds, combat stats, and
  damage ranges. It uses the
  [Pokemon Champions battle-mechanics research](https://www.smogon.com/forums/threads/champions-battle-mechanics-research.3780372/)
  as the mechanics reference and records live
  [PkmnChamps](https://pkmnchamps.com/calculator) ranges only as comparison
  metadata.
- Do not change modifier ordering merely to match a third-party calculator. The
  initial comparison exposed three one-point boundary differences, while the
  mechanics research reports that Champions follows the Scarlet/Violet damage
  formula and includes the full 0.85-1.00 random range. Keep the standard
  `@smogon/calc` results unless an in-game capture demonstrates a real
  Champions-specific exception.
- Do not persist damage output. It is derived from the two current builds, battle
  state, direction, and field controls and should be recalculated whenever an input
  changes.

## Builder UX Notes

Desktop UX decisions after the wide-builder layout change:

- Use six always-visible vertical EV sliders in the card's right-side stat editor.
  Each stat column reads from base stat to EV allocation to final displayed stat,
  while retaining direct numeric entry and keyboard slider controls.
- The compact header team-management group shares the Pokemon card's left edge,
  the team-name field is capped at 240px, and the PokePilot wordmark occupies the
  original left-side header position.
- Keep the single-Pokemon editor as the sole active build surface. The former
  compact Team View and view switch were removed because the persistent Team Rail
  already provides whole-team context without duplicating the editing UI.
- Team members are shown in the vertical Team Rail to the left of the card. The
  rail changes the displayed Pokemon, reorders active sets, opens empty-slot search,
  and remains the entry point for Bench interactions.
- Filled Team Rail entries can be reordered with desktop drag, touch hold-and-drag, or
  `Alt+Arrow` keyboard controls. The Pokemon and its item, ability, nature, EVs,
  moves, and Mega/form state move together, including when moved through empty slots.
- The Pokemon name itself is the selector. Filled slots show large text until the
  picker is opened; empty slots keep the editable field and candidate list visible.
- With usage stats available, the empty-query name dropdown shows Pokemon in
  Smogon usage order and labels each result with its usage rank rather than its
  Pokedex number. It loads 20 entries at a time and appends more on scroll.
- Opening/closing the name picker must not shift the rest of the card layout.
- Clicking outside or pressing Escape closes a filled-slot picker and clears its
  temporary query. For an empty slot, those actions clear the query but keep the
  picker visible so Pokemon selection remains the primary task.
- Form-change variants are selected from the main Pokemon dropdown, while Mega
  evolutions remain adjacent controls next to the Pokemon name.
- Keep selected move pills optimized for quick scanning: show the type icon,
  move name, and power in the pill, while PP, accuracy, category, description,
  and tags remain available in the hover and keyboard-selection detail tooltip.
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
- Keep image sharing outside the editor card as a card-toolbar utility. Render a
  dedicated 540-by-540 Pokemon share component in a portal-backed preview rather
  than screenshotting the live editor, then use `html-to-image` at pixel ratio 2
  for a stable 1080-by-1080 PNG. Clipboard copy and file download must share the
  same blob-generation path so their output cannot drift. The same dialog also
  renders a 960-by-540 active-team card and navigates between the team and all six
  available Pokemon previews without resizing the dialog shell.

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
- EV columns pair a native vertical range with direct numeric entry. Pointer,
  touch, and keyboard changes share the same update path, which clamps every edit
  against the 32-point per-stat maximum and remaining 66-point budget.
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
- Keep the MIT-licensed local SVG type symbols instead of PokeAPI's current
  Scarlet/Violet or Pokemon Showdown raster PNG symbols. The local assets scale
  cleanly and support CSS color control; the available upstream PNG sets do not
  improve that workflow. PokeAPI and Showdown also do not currently expose a
  newer modern move-category set that warrants replacing EssentiarumVG.
- Pokemon, item, ability, nature, and move pickers support keyboard navigation
  with hover-to-keyboard active selection continuity.
- Pokemon, item, ability, and move result surfaces hide their visual scrollbars
  while retaining wheel, touch, and keyboard scrolling. Render at most 20 options
  initially and append 20 more near the scroll boundary; apply the same rule to
  ability and move candidate-filter menus in empty slots.
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
  settling animation so all four surfaces keep the same interaction feel. A
  drop swaps only the source and target entries; intervening entries stay in
  place while both swap targets animate to their new positions.
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

## Localization Strategy

- Keep UI copy in the typed flat dictionaries under `src/i18n/translations.ts`.
  The Korean dictionary must satisfy the complete English key set at build time,
  so missing keys and misspelled identifiers fail TypeScript verification.
- Write Korean app-owned UI copy as concise status or action phrases rather than
  polite full sentences. Preserve full prose for official game descriptions and
  legal or attribution text where sentence form improves clarity.
- Persist only the selected locale under `pokepilot:locale`; never duplicate team
  or Pokemon data per language. Saved builds and Showdown import/export continue
  to use canonical English IDs.
- Generate `src/i18n/data/ko-game-data.json` with `npm run data:locales` from the
  official PokeAPI CSV dataset. The checked-in snapshot covers Pokemon species and
  forms, moves, items, abilities, types, natures, and available Korean flavor text,
  so ordinary app use does not request localization records from PokeAPI.
- Put deliberate terminology corrections in `src/i18n/data/koOverrides.ts` rather
  than editing generated data. Missing or newly introduced game records fall back
  to their English display text.
- The Korean desktop QA baseline covers the empty builder, configured sets,
  selection popovers, validity, Showdown text, image previews, team management,
  and PokePilot analysis at 1440x900 and 1920x1080 without page overflow.
- Keep grammar-heavy deterministic PokePilot output in the typed locale packs in
  `src/i18n/copilotText.ts`. Generate the local response in the active locale while
  leaving the provider-independent request data and canonical game IDs unchanged.
- Validity issues retain a stable issue code, canonical fallback message, and
  structured display values. `validityTranslations.ts` localizes the visible
  message and resolves Pokemon, item, ability, move, nature, and stat names through
  the same game-data catalogs used by the editor.
- Anchor the validity popover inside the validity control so its panel and pointer
  follow the trigger instead of relying on Team Rail or card-width offsets.

## Theme Strategy

- Keep theme state independent from localization and team persistence. Store the
  `system`, `light`, or `dark` preference under `pokepilot:theme`; when no
  supported value exists, use `system`. System mode resolves from
  `prefers-color-scheme` and listens for operating-system changes while the app is open.
- Apply `data-theme="light"` or `data-theme="dark"` to the document root and keep
  the browser `color-scheme` property in sync. Components should consume shared
  semantic surface, border, text, and muted-color tokens instead of branching in
  React for visual styling.
- Keep state and game-meaning colors more specific than generic dark surface
  overrides. Nature increase/decrease axes, validity states, destructive actions,
  move-type rows, and matchup weak/resist values must retain their semantic colors;
  saved-team text, slots, and actions need explicit dark contrast rather than
  inheriting light-only values.
- Keep the header theme control icon-only and expose system, light, and dark in a
  localized menu. Its desktop, sun, or moon icon reflects the stored preference.
- Scope dark overrides away from the Pokemon and team share-card templates. Their
  captured PNG output remains a stable light design while the surrounding preview
  dialog follows the active app theme.
- Recheck all three preferences and both resolved visual themes with English and
  Korean UI at the 1440x900 and 1920x1080 desktop baselines. Include theme-menu
  selection and dismissal, semantic status colors, pickers, popovers, saved-team
  management, PokePilot output, image previews, and document-level overflow.

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
- any newly discovered Pokemon Champions-specific battle-rule differences

## Desktop QA Baseline

- Run `npm run lint`, `npm run test:run`, and `npm run build` before closing a
  major Team Builder refactor.
- Manually recheck Pokemon, item, ability, nature, and move pickers for mouse-to-
  keyboard continuity. Move selection must open at the current move without a
  hover scroll loop, and keyboard navigation must keep its natural nearest-scroll
  behavior.
- Recheck Mega form changes for matching-stone auto-selection, locking while Mega,
  and editable stone state after returning to the base form.
- Recheck Pokemon Showdown text as a round trip: opening the popover focuses and
  selects the full text, canonical form names import again, and the complete build
  survives the import.
- Recheck saved-team order, bench persistence, last-opened restore, and the rule
  that bench Pokemon remain outside team Showdown export.
- Keep horizontal overflow clipped at the app shell. The right-side background
  extension intentionally reaches beyond the capped 1920px workspace on ultrawide
  displays, but must never create a document-level horizontal scrollbar at the
  1920px boundary.

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

The current implementation keeps one provider-independent product contract
across deterministic fallback and hosted analysis:

- `src/utils/copilotAnalysis.ts` creates request-contract v12 containing active
  sets, the selected slot, deterministic diagnostics, field/weather concept
  summaries, validity summaries, and all 18 localized type labels.
- The same module returns structured summary, strength, focus, playstyle, and
  recommendation fields from local rules when the hosted route is unavailable.
- `POST /api/pokepilot/analyze` sends the same validated request to Luna at
  Standard low reasoning. Prompt v34 places stable common instructions at the
  first explicit cache breakpoint, stable Team/Pokemon/Recommend instructions
  at a second breakpoint, and variable request JSON after both. The cache key is
  versioned by the shared core so different scopes and users can reuse the
  common prefix while scope revisions invalidate only their later segment.
- Hosted Team and Pokemon output includes a private strategy audit. The server
  validates selected-element ownership, legal active states, Mega states,
  defensive facts, supported Speed comparisons, and recommendation evidence,
  then strips the audit before returning the public analysis. Pokemon-scope
  validation also cross-checks public exact-weakness coverage prose and negative
  "no teammate covers this type" claims against every current defensive profile.
- Team and selected-Pokemon scopes keep separate results. A request fingerprint marks
  an existing result stale after relevant edits without rerunning analysis on every
  keystroke; changing only the displayed slot does not stale team-scope analysis.
- `CopilotPanel.tsx` renders the structured response and owns idle, loading,
  hosted/fallback error, refresh, stale, cooldown, and persisted-history states.
- On the desktop workspace, cap the content shell at 1920px. Stack a wider,
  shorter builder and compact diagnostics in the left column, and keep the
  full-height PokePilot panel visible in the right column. The Pokemon editor
  places moves and stats side by side.
  Long analysis and future chat history scroll inside `copilot-content` so they
  do not increase the document height.
- Keep the edge-filled PokePilot treatment through 1920px-wide desktop
  viewports. Above 1920px, preserve the same 480px panel width but render it as
  a self-contained dark card with 16px vertical margins, rounded corners, and a
  height that stretches to the footer. This keeps QHD and UHD layouts centered
  without turning the panel into an oversized wall.
- From 761px through 1420px, remove PokePilot from the workspace grid and expose
  it as a right-edge overlay drawer. The persistent handle keeps the feature and
  brand visible without shrinking the Pokemon card, so the duplicate header
  wordmark is hidden at this breakpoint. The drawer closes through
  the handle, backdrop, or Escape. When open, it spans the full dynamic viewport,
  dims the header, workspace, and footer together, locks background scrolling,
  and keeps analysis scrolling internal so document scroll cannot clip the panel.
- On short landscape tablets, preserve the 490px editor card and compact the
  secondary matchup report and footer so the document fits the dynamic viewport.
  Portrait tablets may continue below the fold for diagnostics, but the complete
  Pokemon card must remain visible in the initial viewport. Widths at or below
  760px remain provisional until the dedicated mobile pass.

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

## Meta Benchmarks, Threats, And Set Optimization

Treat the future meta benchmark pool as a reusable domain layer, not as a list
owned by one PokePilot feature. Meta-backed team threat analysis, empty-slot and
replacement recommendations, calculator opponent presets, and robust set
optimization should refer to the same versioned set identities and deterministic
evidence. Exact-target Calculator flows must remain usable without this pool.

Threat analysis and set optimization form a symmetric product matrix:

| Feature | General mode | Dedicated mode |
| --- | --- | --- |
| Threat analysis | Scan weighted meta sets for team-wide risks | Audit the active six against one configured opponent and battle state |
| Set optimization | Balance several weighted meta targets | Tune one current member for explicit damage, survival, Speed, or ally-order goals |

Both modes normalize their inputs into the same contract:

```ts
type MatchupScenario = {
  opponentBuild: PokemonBuild
  battleState: BattleState
  direction: "attack" | "defend" | "speed"
  objective: "ohko" | "two-hit-ko" | "survive" | "outspeed" | "ally-order"
  moveId?: string
  weight: number
  source: "meta" | "explicit"
}
```

The Calculator creates an explicit scenario directly from user input. The meta
layer is an adapter that produces an array of the same scenarios with usage and
confidence weights. Deterministic engines should depend on `MatchupScenario`,
not on `MetaBenchmarkSet`, so exact optimization can ship first and meta support
can be added without creating a second optimizer.

A benchmark entry represents an observed or curated set rather than a species:

```ts
type MetaBenchmarkSet = {
  id: string
  regulation: string
  format: "singles" | "doubles"
  usageMonth: string
  pokemonId: string
  itemId?: string
  abilityId: string
  natureId: string
  statPoints: Record<string, number>
  moveIds: string[]
  finalStats: Record<string, number>
  usageWeight: number
  confidence: "observed" | "inferred" | "curated"
  roleIds: string[]
  mechanicIds: string[]
}
```

- Monthly usage is a soft prior for finding plausible sets, not an authoritative
  answer. Preserve whether a complete set was observed together or assembled
  from marginal item, move, nature, or spread distributions.
- Freeze opponents to the selected monthly distribution. Do not recursively
  optimize opposing spreads in response to the user's optimization, which would
  create an unbounded Speed and bulk adjustment race.
- Include simple extreme-investment sets in every optimization frontier. A tuned
  spread is preferred only when deterministic breakpoints show a meaningful gain
  without losing a more important outcome; returning "no justified tuning" is a
  valid result.
- Generate Speed, offense, and bulk candidates from stat and damage breakpoints
  rather than brute-forcing every cross-product. Evaluate item, ability, move-core,
  and field choices as separate supported branches, then remove candidates that
  cost at least as many points while satisfying no additional benchmark.
- Treat hard Trick Room, dual-mode Trick Room, pre-room support, mirror Speed,
  and ally action order as distinct Speed objectives. Ordinary outspeed coverage
  must not be applied automatically to a Trick Room set.

Threat findings should separate fast offensive losses from progress denial and
strategy disruption. Usage can raise exposure, but a lower-usage wall or control
set can still rank highly when the team has no reliable answer. Deterministic
evidence should distinguish hard counters, reliable checks, conditional checks,
and unsupported matchups. A finding should retain the benchmark set, failure
mode, current responders, confidence, and supported next actions.

The dedicated threat-audit decision ladder is:

1. Check whether a current set already provides a reliable answer.
2. Search EV and nature breakpoints without changing the set's tools.
3. Search supported legal move and item changes when tuning alone is insufficient.
4. Check whether another current team member can take over the responsibility.
5. Offer a targeted Pokemon recommendation only when the roster has no verified
   answer under the entered assumptions.

Avoid claiming that a new Pokemon is categorically required. State that the
current roster has no verified answer against the configured opponent and battle
state. In Doubles, preserve partner and field assumptions and later allow a two-
Pokemon opposing core when a one-on-one scenario cannot represent the threat.

The connected meta product flow is:

1. PokePilot identifies and explains a grounded team threat.
2. If the roster cannot answer it, open a targeted Pokemon recommendation.
3. If an existing member can plausibly answer it, open the Calculator with the
   opponent set, battle state, direction, move, and objective prefilled.
4. The deterministic engine produces extreme, minimal-investment, balanced, and
   robust candidates. PokePilot ranks and explains only those verified options.
5. The user previews gained and lost benchmarks, then applies the set or stores
   it as a bench variant.

### Payload And Runtime Budget

The compact benchmark catalog itself should remain manageable. The main risks
are shipping raw upstream statistics, duplicating localized display data, or
embedding a detailed all-versus-all matchup matrix in the browser.

- Generate normalized snapshots offline or on the server and keep only canonical
  IDs, numeric stats, weights, confidence, roles, and mechanics. Resolve names,
  descriptions, and assets through catalogs already shipped by the app.
- Split snapshots by regulation, format, and month. Keep only a small manifest in
  the initial application and lazy-load the requested Singles or Doubles snapshot
  when a benchmark-backed feature opens.
- Cache versioned snapshots in Cache Storage or IndexedDB rather than localStorage,
  whose synchronous reads and smaller practical quota are a poor fit for this data.
- Do not ship a complete pairwise matrix. Evaluate the active six against the
  relevant benchmark subset on demand, cache repeated damage/stat results, and
  move heavier scans to a Web Worker or server job if profiling shows main-thread
  stalls.
- Send only ranked threat evidence or a small target subset to the model. The LLM
  interprets and prioritizes verified facts; it does not receive raw monthly data
  or calculate damage combinations itself.
- Measure compressed snapshot size, parse time, scan latency, and cache hit rate
  before selecting the final pool depth. Reduce equivalent spreads and low-value
  tails before sacrificing important strategic archetypes solely by usage rank.

## Security Notes

- Keep API keys in `.env.local`.
- Do not call paid AI APIs directly from browser code.
- Keep prompts and model calls server-side.
- Sign the anonymous analysis cookie on the server and hash IP addresses before
  they enter limiter state. Never log raw IP addresses, cookie IDs, or team
  request contents.
- Serve an identical validated analysis from the 24-hour canonical cache before
  consuming rate-limit capacity. The first five uncached calls in a rolling day
  have no client cooldown; later calls progress through one-minute, five-minute,
  fifteen-minute, and one-hour waits. A more generous IP policy limits browser-ID
  resets and bursts.
- Reserve rate-limit capacity before an uncached model call to prevent concurrent
  bypasses, then move the event timestamp to validated completion so the user
  receives the full cooldown after the result arrives. Cancel the reservation on
  upstream, validation, or cache-write failure so failed attempts do not count.
- Keep the in-memory implementation for local development. When both Upstash
  REST credentials exist, select the shared adapter automatically. It stores
  canonical responses with a 24-hour TTL, evaluates client/IP rolling limits in
  one Redis Lua script, and coordinates identical requests with a token-owned
  distributed lease and short-lived shared result.
- Set `POKEPILOT_SHARED_STORE_REQUIRED=true` for public deployment so missing or
  partial Redis configuration fails closed. Use distinct
  `POKEPILOT_REDIS_PREFIX` values for preview and production. Redis outages
  should return the existing rules-based fallback rather than bypass shared
  controls and issue unbounded model calls.
- Keep routine `npm run dev` isolated on process-local memory. Load real Redis
  credentials only from ignored `.env.shared.local` through
  `npm run dev:shared`; this mode retains production-like safeguards, forces the
  shared-store requirement, and uses a development-only key prefix. Vite modes
  other than `shared` deliberately discard Redis environment values before
  selecting the operations adapter; the deployed server runtime still selects
  Upstash automatically from its server-side secrets.
- Keep the OpenAI project hard budget as the final cost ceiling and complete a
  live multi-instance Redis test before treating the adapter as production-
  verified.
- Select local safeguard test behavior only through server-start Vite modes:
  production-like `dev`, cached/unlimited `dev:ai`, uncached/unlimited
  `dev:ai:fresh`, and one-call/10-second `dev:cooldown`. Unknown and production
  modes always fall back to enforced safeguards; never accept a browser query,
  cookie, or localStorage override for this setting.

## Resume Angle

Possible future resume bullet direction:

- Built an AI-assisted team-building web app in React and TypeScript with structured API responses and interactive team analysis.
- Implemented type coverage and weakness visualization to help users evaluate team composition and strategy.
- Designed a deployable product workflow that converts AI-generated recommendations into structured, user-facing UI.
