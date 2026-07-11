# PokePilot AI Technical Notes

## Recommended Stack

- Frontend: React + TypeScript
- Styling: Tailwind CSS or a small custom CSS system
- Framework option: Next.js if API routes and deployment simplicity are useful
- AI: OpenAI API or another LLM provider through a server-side API route
- Data: static JSON first, then PostgreSQL / Supabase if persistence is needed
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
- PostgreSQL / SQL: Add persistence later through Supabase or PostgreSQL for saved teams, favorite builds, or analysis history.
- AI API integration: Use an LLM API for structured team analysis and recommendations, then render the output as product UI.
- Deployment: Deploy the app publicly through Vercel or a similar platform and keep a live link for the portfolio.
- GitHub Actions: Add a simple lint/build workflow later to demonstrate basic CI/CD experience.
- Testing: Use Vitest for deterministic stat, parser, alias, legality, team-diagnostic,
  and local Copilot-contract regression tests. Keep live PokeAPI, Showdown, and
  Smogon requests out of the unit-test suite.
- Legality fixtures: Keep small raw Showdown and PokeAPI response fixtures under
  `src/test/fixtures`. Use them to exercise the real source parsers and form
  normalization without making network requests during tests. Add cases when a
  newly fixed Pokemon, form, item, ability, or move could regress.
- Data visualization: Use type coverage, weakness matrices, and team balance charts to show frontend and product depth.

Avoid forcing these skills into the project too early:

- Python: Not necessary for the MVP unless a later backend or data-processing need clearly appears.
- AWS: Useful in some job postings, but too heavy for the first version compared with Vercel/Supabase.
- Custom ML training: Out of scope; the goal is AI-assisted product development, not model training.

## Data Strategy

Current direction:

- Load the full Pokemon index from PokeAPI with `GET /pokemon?limit=5000`.
- Cache that index in `localStorage`.
- Fetch detailed Pokemon data only when the user selects a Pokemon.
- Cache looked-up Pokemon in `localStorage`.
- Use PokeAPI detail data for types, abilities, base stats, move names, and artwork URLs.
- Load the full item index from PokeAPI with `GET /item?limit=2500`.
- Load PokeAPI's `item-category/mega-stones` list and mark those entries in the
  item index before caching it in `localStorage`. Also apply a conservative
  mega-stone name heuristic for new PokeAPI items that have Mega Stone-style
  names before their category metadata is reliable.
- Fetch item details only when the user selects an item so the card can display
  the item's sprite. Item detail cache is versioned because category fixes can
  affect whether a selected item is treated as a Mega Stone.
- Normalize the PokeAPI Pokemon index into UI metadata:
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
- Keep PokeAPI as the display/detail source for Pokemon, items, abilities, moves,
  sprites, and artwork.
- When an item response has no default sprite, fall back to the matching
  `PokeAPI/sprites` `sprites/items/gen9/{item-id}.png` asset.
- Use PokeAPI generation-specific icon sprites first. If that path is missing,
  fall back to PokeAPI `front_default` before older generation icon paths so
  Pokemon without current icons can still use the more detailed 96x96 sprite in
  team tabs and previews. Keep the large card artwork on PokeAPI artwork/front
  sprite URLs.
- Use Pokemon Showdown data as the current Regulation M-B legality source for:
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
- Keep the legality layer separate from PokeAPI normalization so source mapping
  and future format support stay maintainable.
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

- The main builder is a single large Pokemon editor card, not a grid of six cards.
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
  it should show a searchable dropdown backed by the full PokeAPI item index.
- Pokemon-specific mega stones should be filtered from the item dropdown unless
  they belong to the currently selected Pokemon. Use the PokeAPI mega-stones
  category plus the Mega Stone name heuristic, so newly added mega stones stay
  hidden by default. If a Mega form is selected, the held item should
  automatically lock to that Mega Stone when it can be matched. New Mega forms
  whose stone names are not exact species-name matches use a best-prefix match
  against known Mega Stone names.
- Z-A Mega forms currently have high PokeAPI IDs around the 10200 range, so the
  Pokemon index limit must stay high enough to include them. The builder also
  falls back to name-based `-mega` detection when index metadata is missing.
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
  fetched type, power, accuracy, PP, description, and Showdown-derived tags.
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
- Move, active-team-slot, and saved-team reordering share
  `useLongPressReorder`. The hook owns mouse thresholds, touch hold activation,
  click suppression, keyboard-independent pointer state, and the short drop
  settling animation so all three surfaces keep the same interaction feel.
- Pokemon picked from the main name dropdown can auto-apply a popular Smogon
  moveset usage sample. Form changes, Mega toggles, saved-team loads, and
  Showdown imports do not trigger usage auto-application.
- Saved teams are currently persisted in localStorage with a schema version,
  team name, timestamps, slots, and per-slot build details. The model is kept
  plain-JSON so it can later move to Supabase/Postgres without changing UI state
  shape too aggressively.
- Saved-team cards can be reordered with desktop drag, touch hold-and-drag, or
  `Alt+Arrow` keyboard controls. The new array order is written to localStorage
  immediately, while expanded rename, delete, or Showdown tools temporarily lock
  reordering to avoid accidental edits.
- Showdown text import/export exists at both Pokemon-slot and saved-team level.
- Empty move slots are stored as empty strings inside the fixed four-position
  move array. This preserves slot order for saving and reordering while
  Showdown export, validity, and diagnostics ignore the empty entries. Showdown
  imports pad missing moves to the same four-position representation.
- Held items may be explicitly cleared. Active Mega forms keep their required
  Mega Stone locked and do not expose the no-item action.

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

- Keep deterministic team diagnostics in the middle workspace between the
  selected Pokemon editor and the future Copilot panel.
- Keep the diagnostics panel visually consistent with the builder: use one-line
  panel and section headers, shared 6-8px radii, thin neutral borders, restrained
  gray surfaces, and semantic accent colors only for matchup, role, and alert
  meaning. Matchup cells, role summaries, and alerts should read as related
  repeated items rather than unrelated widget styles.
- Let active role summaries size to their Pokemon count and wrap naturally. Keep
  zero-member roles visible only in a compact Missing line instead of reserving a
  full empty card for each one.
- Calculate defensive matchups from the shared type chart and the current form's
  displayed typing, then apply selected abilities that fully negate an attacking
  type: Levitate and Earth Eater for Ground; Lightning Rod, Volt Absorb, and Motor
  Drive for Electric; Water Absorb, Storm Drain, and Dry Skin for Water; Flash Fire
  and Well-Baked Body for Fire; and Sap Sipper for Grass. Use the same adjusted
  matchup counts for the defensive table and Team Alerts. Conditional move-family
  immunities and non-immunity damage modifiers remain outside this calculation.
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
- Surface compact alerts for shared weaknesses, open team slots, repeated typing,
  and role-based attacker or wall imbalance. Only flag role imbalance when one
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
- On the desktop workspace, keep the Copilot panel fixed to the viewport space
  between the app header and footer. Long analysis and future chat history scroll
  inside `copilot-content` so they do not increase the document height.

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
