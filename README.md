# PokePilot

PokePilot is an unofficial AI-assisted team builder and damage calculator for
Pokemon-style turn-based battles. It combines Regulation M-C legality, usage
data, matchup diagnostics, and structured AI strategy guidance in one
responsive web app.

[Open the live app](https://pokepilot.app)

> Status: public beta. PokePilot is served by a Cloudflare Worker at
> `pokepilot.app`; Google sign-in, account-scoped saved-team sync, and PokePilot
> analysis are live.

## Highlights

- Build, reorder, save, duplicate, and manage six-Pokemon teams with a six-slot bench.
- Edit forms, items, abilities, natures, EVs, moves, Mega Evolution, and current HP.
- Filter Pokemon, items, abilities, and moves against Regulation M-C legality.
- Import and export Pokemon Showdown text for individual sets and complete teams.
- Load usage-ranked Pokemon and popular sets from monthly Smogon statistics.
- Inspect defensive matchups, offensive coverage, validity, and damage ranges.
- Analyze teams and individual Pokemon, compare samples, recommend roster additions, and audit metagame threats.
- Export individual builds and full teams as shareable PNG images.
- Use English or Korean with system, light, and dark themes across desktop, tablet, and mobile layouts.
- Sign in with Google to synchronize saved teams, bounded analysis history, language, theme, default battle format, and tutorial completion across devices.

## Stack

- React 19, TypeScript, Vite, Vitest, and ESLint
- Pokemon Showdown data and `@smogon/calc`
- PokeAPI sprites and localized source data
- OpenAI Responses API for requested PokePilot analysis
- Upstash Redis for shared caching, request deduplication, and request admission
- Cloudflare Workers for the static app and server API
- Cloudflare D1 for account, session, and account-scoped synchronized data
- Google OAuth with Secure, HttpOnly, SameSite session cookies

## Getting Started

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Run the normal local verification suite:

```bash
npm run check
npm run audit:all
```

Run the Cloudflare production gate before deploying:

```bash
npm run check:cloudflare
```

Hosted AI analysis is optional during routine local development. Add
`OPENAI_API_KEY` to ignored `.env.local` to enable it; without a key, the app
continues to offer deterministic fallback guidance. Never expose a provider key
through a `VITE_` environment variable.

Useful development commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run tests once |
| `npm run dev:ai` | Test AI with cache enabled |
| `npm run dev:ai:fresh` | Test uncached AI responses |
| `npm run dev:shared` | Use the shared Upstash development adapter |
| `npm run eval:ai` | Run the optional paid AI fixture evaluation |
| `npm run verify:deployment` | Check the deployed API boundary without an OpenAI call |
| `npm run build:cloudflare` | Build the Worker asset bundle |
| `npm run deploy:cloudflare` | Build and deploy the configured Worker |
| `npm run data:showdown` | Refresh checked-in Showdown catalogs |
| `npm run data:locales` | Refresh checked-in localization data |

For shared-storage QA, copy `.env.shared.example` to `.env.shared.local`, add
development Upstash credentials, and run `npm run dev:shared`.
`verify:deployment` checks guest rejection on the login-required production
Worker. Authenticated contract and paid concurrency checks require browser QA.
The optional `--allow-paid-call` CLI mode is for development endpoints without
account authentication, and intentionally makes a fresh hosted analysis.

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
Smogon usage is still historical Regulation M-B data until M-C statistics exist;
it is not presented as measured M-C usage.

## Documentation

- [Roadmap](./ROADMAP.md)
- [Active TODO](./TODO.md)
- [Technical notes](./TECH_NOTES.md)
- [Regulation M-C data](./docs/REGULATION_DATA.md)
- [Account authentication](./docs/account-auth.md)
- [Cloudflare deployment and migration record](./docs/CLOUDFLARE_MIGRATION.md)
- [Deployment checklist](./docs/DEPLOYMENT_CHECKLIST.md)
- [AI model evaluation](./docs/AI_MODEL_EVALUATION.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)
- [Privacy notice](https://pokepilot.app/privacy.html)
- [Security policy](./SECURITY.md)

## Disclaimer

PokePilot is an unofficial fan-made project and is not affiliated with
Nintendo, Game Freak, Creatures, or The Pokemon Company.
