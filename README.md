# PokePilot AI

PokePilot AI is an unofficial AI-assisted team-building web app for Pokemon-style turn-based battles.

The goal is to help players build better teams by visualizing type coverage, identifying weaknesses, and turning AI-generated recommendations into clear, useful UI.

## Status

Team builder prototype in progress.

Current slice:

- Vite + React + TypeScript app shell
- mockup-driven single Pokemon editor card
- side-mounted team tabs with empty-slot add and clear controls
- PokeAPI full Pokemon index loading with local browser caching
- Pokemon name header that becomes a same-style searchable dropdown when clicked
- searchable icon-only item picker backed by the PokeAPI item index
- Pokemon artwork/sprite display from PokeAPI sprite URLs
- PokeAPI detail loading for selected Pokemon
- Pokemon Showdown-backed Regulation M-B legality filtering
- Smogon monthly usage stats for popular default sets and Pokemon suggestions
- localStorage saved-team management with load, rename, duplicate, delete, and last-opened restore
- Showdown text import/export for Pokemon sets and saved teams
- base stat, EV, fixed IV 31, nature-adjusted stat calculation scaffold
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
- team diagnostics between the Pokemon editor and Copilot panel
- AI-assisted team analysis through a server-side API route
- team-aware Copilot chat/follow-up panel
- custom SVG move category icons
- bench Pokemon support
- calculator mode
- shareable team links if reasonable
- deployment-ready responsive polish

## Implemented Prototype Features

- 6-slot team tabs with empty slots, add flow, and clear confirmation
- PokeAPI-backed full Pokemon index
- selected Pokemon detail loading
- large editable Pokemon name header with filtered and usage-ordered dropdown
- type icons, ability picker, icon-only item picker, nature picker
- searchable item, ability, nature, and move controls with keyboard navigation
- move detail loading with type, category, power, accuracy, PP, description, and tags
- base stat / EV / calculated stat table
- right-cropped Pokemon artwork in the editor card
- local saved-team list and management actions
- Pokemon-level and team-level Showdown text tools
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
licensed under the MIT License. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
for type icon, Font Awesome, and Pokemon Showdown notices.

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
