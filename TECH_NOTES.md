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
    Pikachu caps and Castform weather forms, are hidden from the main picker
  - mega evolutions are hidden from the main picker and exposed through the
    selected Pokemon's mega control
- Keep PokeAPI as the display/detail source for Pokemon, items, abilities, moves,
  sprites, and artwork.
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
- Keep the legality layer separate from PokeAPI normalization so source mapping
  and future format support stay maintainable.

The user is comfortable using Pokemon names and sprites/artwork for this unofficial
portfolio tool. Continue to avoid official logos, official UI branding, and any
claim of affiliation.

## Builder UX Notes

- The main builder is a single large Pokemon editor card, not a grid of six cards.
- Team members are shown as compact tabs/bookmarks on the left side of the card.
- The displayed Pokemon is changed by clicking a team tab.
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
- IV is fixed through the Pokemon Champions-style displayed stat assumption.
- Stat calculation uses Pokemon Champions-style EV limits, fixed IV assumptions,
  and nature modifiers.
- Nature options use the full nature table with raised/lowered stat visualization.
- Item options are filtered through the Regulation M-B legality layer, with
  Pokemon-specific Mega Stone hiding and Mega form auto-lock behavior on top.
- Move options are filtered through the Regulation M-B legality layer and display
  fetched type, power, accuracy, PP, description, and Showdown-derived tags.
- Pokemon, item, ability, nature, and move pickers support keyboard navigation
  with hover-to-keyboard active selection continuity.
- The move picker opens scrolled to the current move, uses natural nearest-scroll
  behavior for keyboard navigation, and prevents mouse hover from triggering
  scroll loops.
- Pokemon picked from the main name dropdown can auto-apply a popular Smogon
  moveset usage sample. Form changes, Mega toggles, saved-team loads, and
  Showdown imports do not trigger usage auto-application.
- Saved teams are currently persisted in localStorage with a schema version,
  team name, timestamps, slots, and per-slot build details. The model is kept
  plain-JSON so it can later move to Supabase/Postgres without changing UI state
  shape too aggressively.
- Showdown text import/export exists at both Pokemon-slot and saved-team level.

## Regulation Target

The intended competitive target is Pokemon Champions Regulation M-B. The current
implementation uses Pokemon Showdown data as the M-B legality source for:

- legal Pokemon
- legal items
- legal moves per Pokemon
- legal abilities per Pokemon

Still needed:

- validity warnings in the UI
- representative regression checks for legality-sensitive Pokemon, items,
  abilities, and moves
- documentation for any known Showdown/PokeAPI naming exceptions
- any newly discovered Pokemon Champions-specific battle-rule differences

## AI Response Shape Idea

The preferred AI shape is a team-aware Copilot, not a generic ChatGPT clone. Keep
the Copilot constrained to the current team data and deterministic builder analysis.

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
