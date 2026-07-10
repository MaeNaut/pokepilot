# PokePilot AI

PokePilot AI is an unofficial AI-assisted team-building web app for Pokemon-style turn-based battles.

The goal is to help players build better teams by visualizing type coverage, identifying weaknesses, and turning AI-generated recommendations into clear, useful UI.

## Status

Builder prototype in progress.

Current slice:

- Vite + React + TypeScript app shell
- mockup-driven single Pokemon editor card
- 6-slot team tabs above the editor card
- PokeAPI full Pokemon index loading with local browser caching
- Pokemon name header that becomes a same-style searchable dropdown when clicked
- searchable icon-only item picker backed by the PokeAPI item index
- Pokemon artwork/sprite display from PokeAPI sprite URLs
- PokeAPI detail loading for selected Pokemon
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

- Pokemon Champions Regulation M-B legality data for Pokemon, items, abilities, and moves
- move detail loading for power, accuracy, PP, type, and descriptions
- item selector with searchable keyboard/mouse selection
- nature picker with intuitive stat up/down matrix
- team diagnostics between the Pokemon editor and Copilot panel
- AI-assisted team analysis through a server-side API route
- team-aware Copilot chat/follow-up panel
- saved example teams
- shareable team links if reasonable
- deployment-ready responsive polish

## Implemented Prototype Features

- 6-slot team tabs
- PokeAPI-backed full Pokemon index
- selected Pokemon detail loading
- large editable Pokemon name header with filtered dropdown
- type badges, ability picker, icon-only item picker, nature picker
- searchable item dropdown with selected item sprite display
- base stat / EV / calculated stat table
- right-cropped Pokemon artwork in the editor card
- Copilot panel placeholder

## Data Source

Pokemon names, typing, stats-derived role hints, abilities, base stats, move names,
and sprite URLs are loaded through [PokeAPI](https://pokeapi.co/). PokePilot AI
caches the Pokemon index and looked-up Pokemon in `localStorage` to keep repeat
requests light.

The app is intended to target Pokemon Champions Regulation M-B, but exact M-B
legality is not implemented yet. Current legality-related controls are scaffolds
until a reliable regulation data source is connected.

## Third-Party Assets

Type icons are from
[partywhale/pokemon-type-icons](https://github.com/partywhale/pokemon-type-icons),
licensed under the MIT License. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
for the full notice.

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
