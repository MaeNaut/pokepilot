# PokePilot AI

PokePilot AI is an unofficial AI-assisted team-building web app for Pokemon-style turn-based battles.

The goal is to help players build better teams by visualizing type coverage, identifying weaknesses, and turning AI-generated recommendations into clear, useful UI.

## Status

Team Builder and damage-calculator prototype in progress.

Current slice:

- Vite + React + TypeScript app shell
- mockup-driven single Pokemon editor card
- persistent six-member Team Rail plus a bench drawer with full-build transfers
- Showdown-backed Pokemon index and form metadata with local browser caching
- Pokemon name header with a searchable, usage-ranked dropdown that stays open for empty slots
- searchable icon-only item picker backed by a compact Showdown item catalog
- Pokemon artwork/sprite display from PokeAPI sprite URLs
- Showdown-primary types, base stats, abilities, legal move lists, and move details
- PokeAPI artwork/icon lookup for selected Pokemon and item sprite assets
- Local loading, fallback, and Retry states for PokeAPI, Showdown, and Smogon data
- Pokemon Showdown-backed Regulation M-B filtering from a compact local snapshot
- Smogon monthly usage stats for popular default sets and Pokemon suggestions
- localStorage saved-team management with load, rename, duplicate, delete, reorder, last-opened restore, and a 30-team limit
- Showdown text import/export for Pokemon sets and saved teams, including direct new-team import from the header
- dedicated Pokemon and whole-team build images with in-dialog navigation, clipboard copy, and PNG download
- Pokemon Champions-style EV editing and nature-adjusted stat calculation with fixed IV 31 assumptions
- live team diagnostics for defensive matchups, offensive coverage, six multi-label set roles, and setup alerts
- Setter and team-concept analysis for field modes and weather cores, including ace and off-mode checks
- Regulation M-B validity status for configured sets, Mega Stones, EV limits, and team clauses
- server-hosted GPT-5.6 Luna Standard Low strategy briefs in both Team Builder
  and Calculator modes, with private plan, interaction, fact, and recommendation
  evidence audited against the submitted team before prose reaches the browser
- process-local 24-hour AI response caching, in-flight request deduplication,
  signed anonymous-client cooldowns, and privacy-safe token/cost telemetry
- versioned local PokePilot analysis history with reload restoration,
  language-aware result recovery, bounded per-team retention, and a panel-safe
  history menu with confirmed deletion
- bounded empty-slot Pokemon recommendations: a diversified 28-candidate pool
  spanning Regulation M-B legality, saved filters, usage, defensive fit,
  strategy, roles, coverage, exact defensive liabilities, and generic support
  responsibilities, followed by AI ranking that cannot return candidates
  outside the supplied pool
- reduced-motion-safe staged reveals for newly completed PokePilot analyses,
  while restored and history-selected results remain immediate
- an offline 20-team Singles/Doubles baseline plus focused Team, Pokemon, and
  empty-slot recommendation regressions and a GPT-5.6 Luna Standard runner
  with strict output, token, latency, and cost reports
- persisted English/Korean UI selection with localized game names, forms, and tooltips
- persisted system/light/dark theme selection with live operating-system preference tracking
- lazy-loaded damage Calculator mode with fixed My Pokemon / Opponent Pokemon
  panels, reversible attack direction, Champions stat assumptions, and
  Regulation M-B selection

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

Run the optional paid Luna Standard Low evaluation after placing
`OPENAI_API_KEY` in the ignored `.env.local` file:

```bash
npm run eval:ai
```

Run only the focused ace-funnel and interaction regressions with:

```bash
npm run eval:ai -- --strategy
```

Run the production-derived selected-Pokemon regressions with:

```bash
npm run eval:ai -- --pokemon-regressions
```

Run the four production-derived empty-slot recommendation regressions with:

```bash
npm run eval:ai -- --recommendation-regressions
```

Add `--repeat 3` to a focused command when measuring semantic stability rather
than a single stochastic response. The Node evaluation runtime persists its
browser-style data cache under `node_modules/.cache/pokepilot-ai/`, avoiding
repeat downloads while keeping generated state outside source control.

Use `--scope pokemon --slot <index>` with a single team fixture when checking
another configured set. Evaluation expectations stay outside the model request.

The same ignored variable enables hosted PokePilot analysis through the local
`POST /api/pokepilot/analyze` development route. Without it, the app remains
usable and shows deterministic rules-based analysis instead. In production,
configure `OPENAI_API_KEY` as a server secret and never expose it through a
`VITE_` variable.

Local PokePilot safeguard modes are selected only when the development server
starts, so browser state cannot disable production controls:

```bash
# Production-like: completed cache on, progressive cooldown on
npm run dev

# Production-like safeguards with the real shared Upstash adapter
npm run dev:shared

# Routine AI/UI QA: completed cache on, cooldown off
npm run dev:ai

# Prompt-quality QA: completed cache off, cooldown off
npm run dev:ai:fresh

# Cooldown UI QA: completed cache off, 10-second cooldown after one analysis
npm run dev:cooldown
```

All modes retain in-flight deduplication. Without shared-store credentials,
restarting the local server clears its process-local cache and usage counters.

Routine development intentionally stays on process-local memory. To test the
shared adapter without mixing development and production state, copy the
checked-in template and add the Upstash REST credentials locally:

```powershell
Copy-Item .env.shared.example .env.shared.local
npm run dev:shared
```

The shared development server uses the fixed URL
`http://127.0.0.1:5198/`. It fails instead of silently selecting another
port, which prevents an already-running memory server from being mistaken for
the Upstash-backed QA environment.

`.env.shared.local` is ignored by Git and is loaded only by Vite's `shared`
mode. The base `.env.local` still supplies `OPENAI_API_KEY`, so the secret does
not need to be duplicated. `dev:shared` uses enforced cache and cooldown rules
and refuses to start when the Redis credentials are absent or incomplete. Its
default `pokepilot:operations:dev` prefix keeps local state separate from the
future preview and production namespaces. Other Vite development modes always
select process-local memory, even if Redis variables happen to exist in the
shell or base environment.

The analysis route protects paid calls with a signed anonymous browser cookie,
a hashed-IP backstop, progressive cooldowns, in-flight deduplication, and a
canonical 24-hour response cache. Cached requests do not consume another model
call. An uncached request reserves limiter capacity while it runs, but its
cooldown starts only after the response passes validation and is cached; failed
analyses release the reservation. Operational logs contain cache status,
latency, token counts, and estimated cost, but not raw IP addresses or team
contents. Set a separate
`POKEPILOT_CLIENT_SECRET` in production so anonymous identities remain stable
when the OpenAI key is rotated.

The deployed server runtime and the explicit `dev:shared` mode automatically
switch from the process-local adapter to the official `@upstash/redis` REST
adapter when both `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` are configured. The shared adapter stores canonical
responses and rate events across instances, evaluates client/IP limits atomically,
and uses a short distributed lease so simultaneous identical requests produce
only one model call. Set `POKEPILOT_SHARED_STORE_REQUIRED=true` on a public
deployment to fail closed if Redis is misconfigured. `POKEPILOT_REDIS_PREFIX`
can isolate preview and production environments that share one database.

Redis credentials and `POKEPILOT_CLIENT_SECRET` are server-only secrets. The
OpenAI project hard budget remains the final spending backstop. A live
multi-instance deployment test is still required before treating the shared
controls as production-verified.

See [AI_MODEL_EVALUATION.md](./docs/AI_MODEL_EVALUATION.md) for fixture scope,
cost measurements, full-suite controls, and evaluation rules.

## Planned Features

- team-aware PokePilot chat/follow-up panel
- provision and load-test shared AI operations storage in the deployment environment
- account-backed Supabase/Postgres persistence after the local MVP is stable
- additional Pokemon Champions-only calculator mechanic overrides and matchup presets
- Japanese localization under consideration
- shareable team links if reasonable
- deployment-ready responsive polish

## Implemented Prototype Features

- six-slot Team Rail with empty slots, add flow, delete confirmation, and full-build reordering
- up to six persisted bench Pokemon per team that can be moved or swapped with active slots without entering team previews, diagnostics, validity, or Showdown export
- Showdown-backed full Pokemon index with canonical source IDs
- selected Pokemon battle-detail loading from a cached Showdown snapshot
- large editable Pokemon name header with persistent empty-slot search, reverse filters, usage ranks, and 20-at-a-time loading
- type icons, ability picker, icon-only item picker, nature picker
- searchable item and move controls, Pokemon-specific ability choices, and a nature matrix with keyboard navigation
- explicit no-item and empty-move-slot options for intentional partial sets
- move detail loading with type, category, power, accuracy, PP, description, and tags
- EssentiarumVG Gen 8 physical, special, and status move category symbols
- base stat / EV / calculated stat table with keyboard input, desktop scrubbing, and touch controls
- right-cropped Pokemon artwork in the editor card
- reorderable local saved-team list and management actions
- compact header menu for starting a blank team or importing a new Showdown team directly
- Pokemon-level and team-level Showdown text tools
- Pokemon and whole-team share cards with one preview dialog, cross-preview navigation, clipboard copy, and PNG download
- type-based team matchup matrix, move coverage, six multi-label set roles, and compact team alerts
- deterministic Trick Room, Tailwind, Gravity, rain, sun, sand, and snow core analysis
- compact validity popover with per-slot markers and structured legality issues
- shared pointer, touch-hold, and keyboard reordering for moves, team slots, bench Pokemon, and saved teams
- explicit server-hosted PokePilot analysis with structured summary, strengths,
  focus areas, and next steps, plus deterministic local fallback
- versioned Copilot request/response contracts validated at both browser and
  server boundaries
- typed English/Korean interface copy, a persisted language setting, and checked-in
  PokeAPI-derived Korean game names and descriptions
- system, light, and dark app theme preferences with stable light share-image exports
- one-direction-at-a-time damage calculation using the active team, an editable
  local opponent, current HP, stat stages, shared Singles/Doubles rules,
  format-specific usage rankings, spread damage, weather, terrain, screens,
  Helping Hand, critical hits, and burn
- localized damage ranges, percentage ranges, current-HP KO odds, multi-hit KO
  summaries, and the combat stats used by the calculation

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

Korean display names and descriptions are generated during development from the
official PokeAPI CSV dataset with `npm run data:locales`, then committed as a
static client snapshot. Runtime team data continues to store canonical IDs, so
changing language does not alter saved teams or Pokemon Showdown text. Intentional
terminology corrections belong in `src/i18n/data/koOverrides.ts` and survive
snapshot regeneration.
Item names, descriptions, Mega Stone metadata, and ability descriptions come from
compact checked-in catalogs generated from Showdown data. Item images still use
the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites), with current
generation assets, including the added Z-A Mega Stones, preferred before the
general item-sprite fallback.
Regulation filtering is hydrated once per browser session from a roughly 200KB
checked-in M-B snapshot, so browsers no longer download or parse Showdown's
multi-megabyte teambuilder table and raw learnset/mod files at runtime.
Popular default sets are loaded from the latest available monthly
[Smogon usage stats](https://www.smogon.com/stats/) moveset file for the same
Champions Regulation M-B format.
Damage calculation is provided through a typed Pokemon Champions adapter around
the MIT-licensed [Smogon damage calculator](https://github.com/smogon/damage-calc).
PokePilot supplies current local species and move data to the engine, while
new Champions-only mechanics remain subject to explicit fixtures and overrides.
Pokemon icons prefer PokeAPI's Pokemon Champions sprite set, then fall back to
the current generation icon, `front_default`, and older generation icon paths.
Saved-team previews derive the current Champions candidate from existing PokeAPI
asset URLs, so previously saved teams receive the newer icon priority without
requiring a manual load and resave.

## Third-Party Assets

Type icons are from
[partywhale/pokemon-type-icons](https://github.com/partywhale/pokemon-type-icons),
licensed under the MIT License. Move category symbols use the non-commercial
EssentiarumVG font from [Pokemon Aaah!](https://www.pokemonaaah.net/art/fonts/).
The local SVG type set remains intentional: the currently available PokeAPI and
Pokemon Showdown type symbols are raster PNG assets and do not provide the same
scalable `currentColor` workflow. No newer PokeAPI or Showdown move-category set
currently replaces the EssentiarumVG physical, special, and status glyphs.
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
