# PokePilot AI

PokePilot AI is an unofficial AI-assisted team-building web app for Pokemon-style turn-based battles.

The goal is to help players build better teams by visualizing type coverage, identifying weaknesses, and turning AI-generated recommendations into clear, useful UI.

## Status

Team builder prototype in progress.

Current slice:

- Vite + React + TypeScript app shell
- mockup-driven single Pokemon editor card
- side-mounted team tabs with add, clear, and drag/touch/keyboard reordering
- PokeAPI full Pokemon index loading with local browser caching
- Pokemon name header that becomes a same-style searchable dropdown when clicked
- searchable icon-only item picker backed by the PokeAPI item index
- Pokemon artwork/sprite display from PokeAPI sprite URLs
- PokeAPI detail loading for selected Pokemon
- Pokemon Showdown-backed Regulation M-B legality filtering
- Smogon monthly usage stats for popular default sets and Pokemon suggestions
- localStorage saved-team management with load, rename, duplicate, delete, reorder, and last-opened restore
- Showdown text import/export for Pokemon sets and saved teams
- Pokemon Champions-style EV editing and nature-adjusted stat calculation with fixed IV 31 assumptions
- live team diagnostics for defensive matchups, offensive coverage, set roles, and setup alerts
- right-side Copilot panel reserved for later team-aware AI features

## Getting Started

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Planned Features

- explicit validity warning UI for illegal or incomplete sets
- representative legality regression checks
- AI-assisted team analysis through a server-side API route
- team-aware Copilot chat/follow-up panel
- bench Pokemon support
- calculator mode
- Korean UI localization
- Japanese localization under consideration
- dark mode with a persisted theme preference
- shareable team links if reasonable
- deployment-ready responsive polish

## Implemented Prototype Features

- 6-slot team tabs with empty slots, add flow, clear confirmation, and full-build reordering
- PokeAPI-backed full Pokemon index
- selected Pokemon detail loading
- large editable Pokemon name header with filtered and usage-ordered dropdown
- type icons, ability picker, icon-only item picker, nature picker
- searchable item, ability, nature, and move controls with keyboard navigation
- move detail loading with type, category, power, accuracy, PP, description, and tags
- EssentiarumVG Gen 8 physical, special, and status move category symbols
- base stat / EV / calculated stat table
- right-cropped Pokemon artwork in the editor card
- reorderable local saved-team list and management actions
- Pokemon-level and team-level Showdown text tools
- type-based team matchup matrix, move coverage, multi-label set roles, and compact team alerts
- shared pointer, touch-hold, and keyboard reordering for moves, team slots, and saved teams
- Copilot panel placeholder

## Data Source

Pokemon names, typing, stats-derived role hints, abilities, base stats, move names,
and primary sprite URLs are loaded through [PokeAPI](https://pokeapi.co/). PokePilot AI
caches the Pokemon index and looked-up Pokemon in `localStorage` to keep repeat
requests light.

Pokemon Champions Regulation M-B legality filtering for Pokemon, items,
abilities, and moves is loaded from
[Pokemon Showdown](https://pokemonshowdown.com/) runtime data and the
[Pokemon Showdown repository](https://github.com/smogon/pokemon-showdown).
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
