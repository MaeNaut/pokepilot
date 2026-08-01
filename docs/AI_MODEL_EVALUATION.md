# PokePilot AI Model Evaluation

## Purpose

Use a stable offline team suite to compare hosted models without turning a
single "good answer" into the product's strategy template. The fixtures are
development and regression inputs only. They are not included in production
prompts and are not recommendations shown to users.

The initial suite lives in:

- `src/test/fixtures/aiTeamSinglesFixtures.ts`
- `src/test/fixtures/aiTeamDoublesFixtures.ts`
- `src/test/fixtures/aiTeamFixtures.ts`

It contains 20 Regulation M-B teams:

| Format | Published teams | Constructed boundary cases | Total |
| --- | ---: | ---: | ---: |
| Singles | 8 | 2 | 10 |
| Doubles | 8 | 2 | 10 |

Published Singles fixtures come from Season M-3 high-placement Pokepastes.
Published Doubles fixtures come from public Regulation M-B team pages.
Constructed fixtures are clearly marked and target known failure modes such as
forcing a weather archetype or mistaking Imprison + Trick Room for a friendly
Trick Room mode.

Every published fixture retains its source URL, author where available,
placement or replica-code notes where available, and retrieval date.

## Fixture Philosophy

A fixture stores:

- the complete Showdown-format team;
- `singles` or `doubles` explicitly;
- source provenance;
- broad identities an analysis may reasonably recognize;
- strategically important observations;
- conclusions that demonstrate a serious misunderstanding.

It deliberately does not store a model answer to imitate. Different useful
analyses may prioritize different matchups, selections, and improvements.

## Production Request Parity

The fixture object is not the payload sent to a hosted model. PokePilot keeps
three intentionally different representations:

1. `AiTeamFixture` stores Showdown text, provenance, and an evaluator-only
   rubric.
2. `SavedTeamSummary` stores the editable local team, bench, ordering, and
   persistence metadata.
3. `CopilotAnalysisRequest` stores the compact, provider-independent team,
   diagnostics, candidate filters, and validity data used for analysis.

The current request contract is version 5. Each configured set includes
canonical IDs, localized display names, a deterministic defensive profile with
weakness/resistance multipliers and typing-versus-ability immunity causes, and
normalized physical/special/status move groupings with Doubles spread targets.
When a held Mega Stone matches a rostered Mega form, the request carries both
the pre-Mega set and its deterministic post-Mega typing, ability, and defensive
profile. A complete `megaOptions` list also includes Pokemon already represented
in Mega form so the model cannot mistake one option for the only option.

Team diagnostics include display-name-keyed maps for every configured move,
physical/special/spread attack sources, and team defensive matchups. These maps
reduce move-owner, damage-category, and type-relation guesses without exposing
fixture expectations to the model. Evaluation requests use the Korean locale so
the same generated game-name catalog used by the app supplies Pokemon, item,
ability, nature, type, and move labels.

Evaluation cases must follow the same production path as a team imported in the
web app:

```text
fixture Showdown text
  -> buildImportedShowdownSnapshot()
  -> createTeamAnalysisContext()
  -> createCopilotAnalysisRequest()
  -> model adapter
```

The live UI joins that path at the runtime team/build state and uses the same
analysis-context and request builders. The evaluator does not maintain a
second fixture-specific mapping.

`source`, `showdownText`, and `expectations` stay in evaluator context. The
model adapter receives only a cloned `CopilotAnalysisRequest`, preventing
source metadata or expected conclusions from leaking into the prompt.

The 20 complete-team fixtures cover the first team-analysis flow. Partial
teams, empty-slot candidate filters, bench-aware analysis, and future
single-Pokemon analysis need separate state fixtures if those hosted features
are evaluated later.

## First Hosted Evaluation

Use GPT-5.6 Luna as the initial hosted model. Its July 30, 2026 Standard API
price is $0.20 per million input tokens, $0.02 per million cached input tokens,
$0.25 per million cache-write tokens, and $1.20 per million output tokens.
GPT-5.4 mini is no longer a useful default price comparison at $0.75 input and
$4.50 output per million tokens.

Use the same:

- provider-independent PokePilot request payload;
- system and developer prompt prefix;
- structured output schema;
- response token cap;
- language;
- fixture order;
- deterministic diagnostics and legality inputs.

Start with Luna at `low` reasoning effort. Compare `medium` only on fixtures
where `low` misses strategically important observations or produces unstable
advice. Keep every request on Standard processing during baseline evaluation;
the CLI explicitly sends `service_tier: "default"`, independently of the
Fast-mode setting used by Codex. A versioned prompt-cache key keeps equivalent
evaluation requests on the same cache route while ensuring prompt revisions do
not reuse stale prefixes. Luna requires the `24h` extended-cache retention
mode.

Run one Singles and one Doubles fixture as a smoke test before paying for the
full 20-team suite. Add another hosted model only if Luna fails the product
quality threshold; do not spend tokens on a model comparison that cannot
change the selection decision. Keep evaluation traffic in a separate OpenAI
project from production traffic.

## Running The Evaluation

The default command makes two paid Standard API calls: the first Singles
fixture and the first Doubles fixture.

```bash
npm run eval:ai
```

Run the complete suite after the smoke report is acceptable:

```bash
npm run eval:ai -- --all
```

Other useful options:

```bash
npm run eval:ai -- --fixture singles-m3-01-gengar-starmie
npm run eval:ai -- --effort medium
```

The runner checks the process environment for `OPENAI_API_KEY`, then falls
back to the ignored project file `.env.local`. Never add the key to a
Vite-prefixed environment variable or commit it to the repository. See
`.env.example` for the local file shape. Generated JSON and Markdown reports
are written to `artifacts/ai-evaluation/`, which is ignored by Git.

Each report records input, cached-input, cache-write, output, reasoning, and
total tokens; estimated Standard API cost; service tier; latency; schema
validation; the model response; and the evaluator-only expectations. A report
starts with a pending manual rubric score. This deliberately avoids paying for
a second model to judge Luna and prevents a model judge from silently turning
its preferences into the product rubric.

## Scoring Rubric

Score each category from 0 to 2:

| Category | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Factual fidelity | Contradicts supplied data | Minor imprecision | Uses sets and diagnostics correctly |
| Format awareness | Uses the wrong format assumptions | Mostly correct | Correct Singles/Doubles reasoning throughout |
| Strategic synthesis | Lists facts without a coherent plan | Partial identity | Connects roles, modes, and win conditions |
| Prioritization | Generic or conflicting advice | Some useful ordering | Clear high-value next actions |
| Calibration | Forces an archetype or overstates certainty | Some overreach | Distinguishes evidence, options, and uncertainty |
| Korean response quality | Hard to understand or inconsistent | Usable | Concise, natural, and product-ready |

Maximum score: 12 per fixture.

Treat any of these as a hard failure regardless of the numeric score:

- a conclusion listed in `forbiddenConclusions`;
- an illegal Pokemon, item, ability, or move recommendation presented as
  directly applicable;
- claiming that two Mega Evolutions can activate in the same battle;
- applying Doubles-only partner or spread assumptions to Singles;
- mistaking anti-Trick Room technology for a Trick Room mode;
- treating a self-contained weather setter as proof that the team requires a
  dedicated weather-speed attacker.

## Selection Rule

Keep Luna when it passes all hard-failure checks and its weakest Singles and
Doubles cases remain product-acceptable. If Luna fails, first compare prompt
revisions and `medium` reasoning on the same fixtures. Escalate to another
model only when the measured quality gain can justify its higher per-request
cost.

## Initial Hosted Smoke Result

The July 31, 2026 smoke runs completed one Singles and one Doubles fixture
with strict-schema output:

| Prompt | Effort | Cases | Tokens | Estimated Standard cost | Average latency |
| --- | --- | ---: | ---: | ---: | ---: |
| v2 | Low | 2 | 6,697 | $0.003167 | 7,323 ms |
| v2 | Medium | 1 Singles retry | 3,570 | $0.001862 | 9,256 ms |
| v3 + request v2 | Low | 2 | 9,002 | $0.003643 | 6,780 ms |

The low-effort Doubles response recognized both speed modes, the alternative
Mega choices, and the team's spread attacks after the general prompt
checklist was strengthened. The Singles response still attributed type
weaknesses or immunities to the wrong Pokemon and undercounted available
special damage. Medium reasoning did not resolve those deterministic factual
errors.

Prompt v3 and request v2 moved those facts into the deterministic contract.
The repeated low-effort run no longer called Bellibolt Electric-weak, no
longer assigned a Ground immunity to Mega Gengar, distinguished available
special attacks from dedicated special breakers, and named all four Doubles
spread attacks. It also correctly attributed Corviknight's Ground immunity to
typing. The Singles response retained one awkwardly contradictory sentence
that grouped Corviknight with an Electric answer immediately before stating
its Electric weakness. Treat that as a response-quality scoring issue rather
than a data-contract failure.

The enriched payload added 2,305 total tokens (+34.4%) versus the first
two-case low run, while estimated cost rose by $0.000476 (+15.0%) to
$0.003643. This historical smoke established Luna Standard with low reasoning
as the working default before the complete-suite iterations below.

The smoke requests recorded cache writes but no cache hits. The shared static
prefix is currently too small relative to the differing team payloads to
assume meaningful savings, even with a stable cache key. Cost planning should
continue to use uncached or cache-write pricing until a larger run demonstrates
real hits.

At the enriched low-effort average of about $0.001822 per team analysis, 900
monthly analyses would cost about $1.64 and a $10 budget would cover roughly
5,490 analyses. This is a two-case baseline for one-shot team analysis only.
Follow-up chat, retries, larger future payloads, and additional analysis modes
need their own measurements before they share the same production budget.

## Final Luna Low Baseline

Prompt v9 and request v5 completed all 20 fixtures on August 1, 2026. Prompt
iterations before the final run added deterministic localized labels, pre/post
Mega projections, the complete rostered Mega-option list, all-move ownership,
defensive and offensive source maps, exact three-of-six/four-of-six lineup
rules, and a guard that excludes invalid sets unless the same recommendation
explicitly conditions their use on correcting every validity issue.

| Metric | Result |
| --- | ---: |
| Strict-schema completions | 20 / 20 |
| Invalid outputs | 0 |
| Request errors | 0 |
| Input tokens | 113,711 |
| Cached input tokens | 40,768 |
| Cache-write tokens | 72,883 |
| Output tokens | 17,753 |
| Reasoning tokens | 2,534 |
| Total tokens | 131,464 |
| Average latency | 8,231 ms |
| Estimated Standard cost | $0.040352 |

The average measured cost was about $0.002018 per one-shot team analysis. At
that exact mix, 900 analyses would cost about $1.82 and $10 would cover about
4,956 analyses. Cache reuse and response length vary, so production budgeting
must retain headroom for retries, follow-up turns, and future payload growth.

### Manual Scores

Each category uses the 0-2 rubric above. `F`, `Fmt`, `S`, `P`, `C`, and `K`
mean factual fidelity, format awareness, strategic synthesis, prioritization,
calibration, and Korean response quality.

| Fixture | F | Fmt | S | P | C | K | Total | Hard failure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `singles-m3-01-gengar-starmie` | 2 | 2 | 1 | 2 | 2 | 2 | 11 | No |
| `singles-m3-02-sand-dual-mega` | 2 | 2 | 1 | 2 | 2 | 1 | 10 | No |
| `singles-m3-03-delphox-floette` | 1 | 2 | 2 | 2 | 2 | 2 | 11 | No |
| `singles-m3-06-metagross-gyarados` | 2 | 2 | 1 | 2 | 2 | 2 | 11 | No |
| `singles-m3-08-lucario-screens` | 2 | 2 | 1 | 2 | 2 | 1 | 10 | No |
| `singles-m3-09-lopunny-starmie` | 2 | 2 | 2 | 2 | 2 | 2 | 12 | No |
| `singles-m3-10-floette-baton-pass` | 1 | 2 | 1 | 2 | 1 | 2 | 9 | No |
| `singles-m3-11-starmie-floette` | 2 | 2 | 1 | 2 | 2 | 2 | 11 | No |
| `singles-boundary-incidental-sun` | 1 | 2 | 2 | 2 | 2 | 2 | 11 | No |
| `singles-boundary-imprison-trick-room` | 2 | 2 | 2 | 2 | 2 | 2 | 12 | No |
| `doubles-pokefeed-zardwile-tailroom` | 2 | 2 | 1 | 2 | 2 | 2 | 11 | No |
| `doubles-pokefeed-charizard-rain` | 2 | 2 | 1 | 2 | 1 | 1 | 9 | No |
| `doubles-pokefeed-snow-trickroom` | 2 | 2 | 1 | 2 | 2 | 2 | 11 | No |
| `doubles-pokefeed-maus-ape` | 1 | 2 | 2 | 1 | 1 | 2 | 9 | No |
| `doubles-pokefeed-hall-of-walls` | 2 | 2 | 1 | 2 | 2 | 2 | 11 | No |
| `doubles-pokefeed-swampert-rain` | 2 | 2 | 2 | 2 | 2 | 2 | 12 | No |
| `doubles-pokefeed-tailwind-offense` | 2 | 2 | 2 | 2 | 2 | 2 | 12 | No |
| `doubles-pokefeed-light-snow` | 2 | 2 | 1 | 2 | 2 | 1 | 10 | No |
| `doubles-boundary-self-weather` | 1 | 2 | 2 | 2 | 1 | 1 | 9 | No |
| `doubles-boundary-perish-trap` | 2 | 2 | 2 | 2 | 2 | 2 | 12 | No |

Singles scored 108/120, Doubles scored 106/120, and the complete suite scored
214/240 (89.2%, mean 10.7/12). No response triggered a hard-failure rule.
Luna Standard at low reasoning therefore remains the selected baseline for
human-facing advisory analysis; these results do not justify automatically
applying model suggestions without deterministic validation.

Residual issues were omissions of some important Choice Scarf and pre-Mega
Intimidate details, two poorly calibrated matchup alternatives, occasional
resistance-versus-immunity wording, and a few raw English strategy terms in
otherwise Korean responses. Prompt v9 removed the previously observed wrong
move-owner claim and prevented an invalid Incineroar set from entering a
recommended lineup. The remaining factual risks should be handled by narrower
deterministic facts and output post-validation rather than an ever-growing
prompt checklist.

### Cost Delta And Optimization Decision

Compared with the immediately preceding prompt v8 full-suite run, prompt v9
used 4,510 more tokens (+3.55%) but cost $0.002487 less (-5.80%). Cached input
rose from 25,116 to 40,768 tokens while cache writes fell from 84,010 to 72,883
tokens, offsetting the larger deterministic payload. Compared with the earlier
request-v2/prompt-v3 smoke baseline, average tokens per analysis rose from
4,501 to 6,573 (+46.0%) while measured cost rose from about $0.001822 to
$0.002018 (+10.8%). The added request data therefore has a modest billing cost
relative to the factual errors it prevents.

These estimates use the August 2026 GPT-5.6 Luna Standard short-context rates:
$0.20 per million uncached input tokens, $0.02 per million cached input tokens,
$0.25 per million cache-write tokens, and $1.20 per million output tokens. See
the [official pricing table](https://developers.openai.com/api/docs/pricing?latest-pricing=standard).

GPT-5.6 Luna does not support fine-tuning, and OpenAI's current model-
optimization documentation says the fine-tuning platform is being wound down
and is unavailable to new users. PokePilot will therefore keep Luna Low plus
deterministic context, strict schemas, post-validation, and repeatable evals as
its optimization path. Fine-tuning should not be treated as a substitute for
current Regulation M-B data even if a future supported training option becomes
available. See the [Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
and [model optimization guide](https://developers.openai.com/api/docs/guides/model-optimization).

## Hosted Analysis Integration

The first production-shaped analysis path now uses
`POST /api/pokepilot/analyze`. The browser sends request-contract v6 and never
imports the OpenAI SDK or reads an API key. The route:

- rejects methods other than `POST` and bodies larger than 256 KB;
- validates the complete incoming request before any paid call;
- calls GPT-5.6 Luna on Standard service at low reasoning with prompt v13;
- disables response storage and retains the versioned 24-hour prompt-cache key;
- validates the strict structured output and requested analysis scope before
  returning product data;
- maps configuration, rate-limit, invalid-output, and upstream failures to
  stable API error codes without exposing provider details to the browser.

Vite installs the handler as local development middleware. The matching
`api/pokepilot/analyze.ts` entry point provides the deployment-shaped Node
handler. Local development reads the ignored `OPENAI_API_KEY` from
`.env.local`; deployment must provide the same name as a server secret, never
as a `VITE_` variable.

Request v6 adds species and final displayed stats to each set. Prompt v13 uses
those values for exact speed-order checks, treats distinct dual-Mega rosters as
normal matchup branches rather than an inherent flaw, and explicitly checks
one-point support-to-attacker sequencing under Trick Room. It also separates
matchup-dependent roster selection from the team's shared opening plan and
keeps a lone fast Choice Scarf cleaner from being mistaken for a complete
alternate speed mode without supporting leads or enablers. Any cleaner or
contingency that appears in a recommendation must also appear in a complete
proposed lineup with an explicit replacement branch.

The PokePilot panel calls the hosted route only when the user explicitly asks
for analysis. If the route is unavailable or rejects a response, the panel
keeps the product usable by showing deterministic local analysis with a clear
fallback notice. Successful results enter a bounded, versioned local history
that restores exact team, scope, locale, and request-state matches. Its menu is
rendered outside the scroll-clipped panel, and deleting a team's history
requires the shared destructive-action confirmation flow. Public deployment
still requires canonical request caching,
per-client cooldown/rate limiting, and budget monitoring before unrestricted
traffic is enabled.

## Automated Checks

`aiTeamFixtures.test.ts` verifies:

- exactly 10 Singles and 10 Doubles fixtures;
- 16 published teams and 4 constructed boundary cases;
- unique IDs and complete source metadata;
- six parseable Pokemon sets per fixture;
- item, ability, nature, and four moves per set;
- Champions limits of 32 Stat Points per stat and 66 total;
- Item Clause within every team.

`aiModelEvaluation.test.ts` additionally verifies:

- all 20 fixtures pass through the production Showdown importer, deterministic
  diagnostics/validity context, and Copilot request builder;
- every model input contains six sets with the fixture's Singles/Doubles
  format;
- fixture source, raw Showdown text, and evaluator expectations cannot enter
  the model input;
- only output matching the shared versioned JSON Schema can be recorded as a
  complete run;
- latency and token/cost metadata can be recorded independently of model
  output.

`teamDiagnostics.test.ts` and `copilotAnalysis.test.ts` additionally verify:

- representative Bellibolt and Mega Gengar profiles do not receive invented
  ability immunities;
- full-immunity abilities retain the ability name as the immunity cause;
- mixed physical/special sets, normalized categories, and spread targets
  produce matching per-set and aggregate request summaries;
- base stats and final displayed stats are supplied for exact speed-order and
  support-sequencing analysis;
- localized move ownership, complete Mega options, and held-stone post-Mega
  projections produce matching deterministic request summaries.

`openAiLunaAdapter.test.ts` verifies:

- the adapter always requests Standard service explicitly;
- the production output JSON Schema is sent as a strict Structured Output;
- cached input, cache writes, output, and reasoning usage are recorded;
- reasoning tokens are not charged twice when estimating cost.

`aiEvaluationReporter.test.ts` verifies aggregate usage and cost reporting,
manual-review placeholders, and separation between model output and
evaluator-only expectations.

The provider adapter and result writer should keep outputs outside the source
fixture files so a model response can never silently redefine the expected
team interpretation.
