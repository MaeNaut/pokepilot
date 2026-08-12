# PokePilot

PokePilot is an unofficial AI-assisted team builder and damage calculator for
Pokemon-style turn-based battles. It combines Regulation M-B legality, usage
data, matchup diagnostics, and AI strategy guidance in one responsive web app.

> Status: pre-deployment beta. The core Team Builder, Calculator, and PokePilot
> analysis workflows are implemented and under final deployment QA.

## Highlights

- Build, reorder, save, duplicate, and manage six-Pokemon teams with a six-slot bench.
- Edit forms, items, abilities, natures, EVs, moves, Mega Evolution, and current HP.
- Filter Pokemon, items, abilities, and moves against Regulation M-B legality.
- Import and export Pokemon Showdown text for individual sets and complete teams.
- Load usage-ranked Pokemon and popular sets from monthly Smogon statistics.
- Inspect defensive matchups, offensive coverage, validity, and damage ranges.
- Analyze teams and individual Pokemon or rank empty-slot candidates with GPT-5.6.
- Preserve bounded analysis history and fall back to deterministic guidance when AI is unavailable.
- Export individual builds and full teams as shareable PNG images.
- Use the interface in English or Korean with system, light, and dark themes.
- Work across desktop, tablet, and mobile layouts with keyboard and touch controls.

## Stack

- React 19, TypeScript, and Vite
- Vitest and ESLint
- Pokemon Showdown data and `@smogon/calc`
- PokeAPI sprites and localized source data
- OpenAI Responses API for hosted PokePilot analysis
- Upstash Redis for shared caching, request deduplication, and cooldown controls
- Vercel serverless deployment configuration

## Getting Started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Run the complete local verification suite:

```bash
npm run check
npm run audit:all
```

`npm run check` runs ESLint, the Vitest regression suite, and a production build.

Hosted AI analysis is optional during development. Add `OPENAI_API_KEY` to the
ignored `.env.local` file to enable it; without a key, the app remains usable
through its deterministic fallback. Never expose this key through a `VITE_`
environment variable.

Useful development commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run tests once |
| `npm run dev:ai` | Test AI with cache enabled and cooldown disabled |
| `npm run dev:ai:fresh` | Test uncached AI responses |
| `npm run dev:cooldown` | Exercise the cooldown UI |
| `npm run dev:shared` | Use the shared Upstash development adapter |
| `npm run eval:ai` | Run the optional paid AI fixture evaluation |
| `npm run data:showdown` | Refresh checked-in Showdown catalogs |
| `npm run data:locales` | Refresh checked-in localization data |

For shared-storage QA, copy `.env.shared.example` to `.env.shared.local`, add
the development Upstash credentials, and run `npm run dev:shared`.

## Data

- [Pokemon Showdown](https://pokemonshowdown.com/) supplies canonical Pokemon,
  form, item, ability, move, and legality data.
- [Smogon usage stats](https://www.smogon.com/stats/) supply rankings and popular sets.
- [PokeAPI](https://pokeapi.co/) supplies selected sprites and development-time
  Korean localization source data.
- [Smogon damage calculator](https://github.com/smogon/damage-calc) powers the
  typed Pokemon Champions damage adapter.

Large source catalogs are converted into compact checked-in snapshots and
cached locally so the browser does not repeatedly request or parse upstream data.

## Documentation

- [Roadmap](./ROADMAP.md)
- [Active TODO](./TODO.md)
- [Technical notes](./TECH_NOTES.md)
- [AI model evaluation](./docs/AI_MODEL_EVALUATION.md)
- [Deployment checklist](./docs/DEPLOYMENT_CHECKLIST.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)

## Disclaimer

PokePilot is an unofficial fan-made project and is not affiliated with
Nintendo, Game Freak, Creatures, or The Pokemon Company.
