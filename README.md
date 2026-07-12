# PokePilot AI

PokePilot AI is an unofficial AI-assisted team-building web app for Pokemon-style turn-based battles.

The goal is to help players build better teams by visualizing type coverage, identifying weaknesses, and turning AI-generated recommendations into clear, useful UI.

## Status

Team builder prototype in progress.

Current slice:

- Vite + React + TypeScript app shell
- mockup-driven single Pokemon editor card
- six active team tabs plus a seventh bench drawer with full-build transfers
- Showdown-backed Pokemon index and form metadata with local browser caching
- Pokemon name header that becomes a same-style searchable dropdown when clicked
- searchable icon-only item picker backed by a compact Showdown item catalog
- Pokemon artwork/sprite display from PokeAPI sprite URLs
- Showdown-primary types, base stats, abilities, legal move lists, and move details
- PokeAPI artwork/icon lookup for selected Pokemon and item sprite assets
- Local loading, fallback, and Retry states for PokeAPI, Showdown, and Smogon data
- Pokemon Showdown-backed Regulation M-B filtering from a compact local snapshot
- Smogon monthly usage stats for popular default sets and Pokemon suggestions
- localStorage saved-team management with load, rename, duplicate, delete, reorder, last-opened restore, and a 30-team limit
- Showdown text import/export for Pokemon sets and saved teams, including direct new-team import from the header
- Pokemon Champions-style EV editing and nature-adjusted stat calculation with fixed IV 31 assumptions
- live team diagnostics for defensive matchups, offensive coverage, six multi-label set roles, and setup alerts
- Setter and team-concept analysis for field modes and weather cores, including ace and off-mode checks
- Regulation M-B validity status for configured sets, Mega Stones, EV limits, and team clauses
- right-side Copilot strategy briefs for the active team and selected Pokemon

## Getting Started

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

Refresh the checked-in Showdown catalogs and Regulation M-B snapshot:

```bash
npm run data:showdown
```

Run the automated regression tests once:

```bash
npm run test:run
```

Use `npm test` while developing to rerun affected Vitest tests on file changes.

## Planned Features

- AI-assisted team analysis through a server-side API route
- team-aware Copilot chat/follow-up panel
- account-backed Supabase/Postgres persistence after the local MVP is stable
- calculator mode
- Korean UI localization
- Japanese localization under consideration
- dark mode with a persisted theme preference
- shareable team links if reasonable
- deployment-ready responsive polish

## Implemented Prototype Features

- 6-slot active team tabs with empty slots, add flow, clear confirmation, and full-build reordering
- up to six persisted bench Pokemon per team that can be moved or swapped with active slots without entering team previews, diagnostics, validity, or Showdown export
- Showdown-backed full Pokemon index with canonical source IDs
- selected Pokemon battle-detail loading from a cached Showdown snapshot
- large editable Pokemon name header with filtered and usage-ordered dropdown
- type icons, ability picker, icon-only item picker, nature picker
- searchable item, ability, nature, and move controls with keyboard navigation
- explicit no-item and empty-move-slot options for intentional partial sets
- move detail loading with type, category, power, accuracy, PP, description, and tags
- EssentiarumVG Gen 8 physical, special, and status move category symbols
- base stat / EV / calculated stat table with keyboard input, desktop scrubbing, and touch controls
- right-cropped Pokemon artwork in the editor card
- reorderable local saved-team list and management actions
- compact header menu for starting a blank team or importing a new Showdown team directly
- Pokemon-level and team-level Showdown text tools
- type-based team matchup matrix, move coverage, six multi-label set roles, and compact team alerts
- deterministic Trick Room, Tailwind, Gravity, rain, sun, sand, and snow core analysis
- compact validity popover with per-slot markers and structured legality issues
- shared pointer, touch-hold, and keyboard reordering for moves, team slots, bench Pokemon, and saved teams
- explicit local Copilot analysis with structured summary, strengths, focus areas, and next steps
- versioned Copilot request/response data contracts ready for a future server-side model provider

## Data Source

The searchable Pokemon index, canonical species IDs, and form relationships are
loaded from [Pokemon Showdown](https://pokemonshowdown.com/). Selected artwork and
icon URLs still come from [PokeAPI](https://pokeapi.co/), and fully hydrated selected
Pokemon are cached in `localStorage` to keep repeat asset lookups light.

Selected-Pokemon typing, base stats, abilities, complete move details, and Pokemon
Champions Regulation M-B source data come from
[Pokemon Showdown](https://pokemonshowdown.com/) runtime data and the
[Pokemon Showdown repository](https://github.com/smogon/pokemon-showdown). The
shared Pokedex and move snapshot is cached locally, and move details no longer
require one PokeAPI request per move.
Item names, descriptions, Mega Stone metadata, and ability descriptions come from
compact checked-in catalogs generated from Showdown data. Item images still use
the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites), with current
generation assets preferred before the general item-sprite fallback.
Regulation filtering is hydrated once per browser session from a roughly 200KB
checked-in M-B snapshot, so browsers no longer download or parse Showdown's
multi-megabyte teambuilder table and raw learnset/mod files at runtime.
Popular default sets are loaded from the latest available monthly
[Smogon usage stats](https://www.smogon.com/stats/) moveset file for the same
Champions Regulation M-B format.
When PokeAPI's generation-specific icon path is missing, the app falls back to
PokeAPI's `front_default` sprite before older icon paths so Pokemon without
current icons can still show the more detailed 96x96 sprite in team tabs and
previews.

## Third-Party Assets

Type icons are from
[partywhale/pokemon-type-icons](https://github.com/partywhale/pokemon-type-icons),
licensed under the MIT License. Move category symbols use the non-commercial
EssentiarumVG font from [Pokemon Aaah!](https://www.pokemonaaah.net/art/fonts/).
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for full notices and usage
restrictions.

## Portfolio Goals

This project is intended to demonstrate:

- React / TypeScript frontend development
- AI-assisted product design
- game-system analysis
- data visualization
- API integration
- deployable full-stack workflow

## Disclaimer

This is an unofficial fan-made project and is not affiliated with Nintendo, Game Freak, Creatures, or The Pokemon Company.
