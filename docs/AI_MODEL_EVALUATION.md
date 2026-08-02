# PokePilot AI Model Evaluation

## Purpose

Use a stable offline team suite to compare hosted models without turning a
single "good answer" into the product's strategy template. The fixtures are
development and regression inputs only. They are not included in production
prompts and are not recommendations shown to users.

The initial suite lives in:

- `src/test/fixtures/aiTeamSinglesFixtures.ts`
- `src/test/fixtures/aiTeamDoublesFixtures.ts`
- `src/test/fixtures/aiTeamStrategyFixtures.ts`
- `src/test/fixtures/aiTeamFixtures.ts`

It contains a balanced 20-team baseline plus four focused strategy regressions:

| Format | Baseline | Focused strategy | Total |
| --- | ---: | ---: | ---: |
| Singles | 10 | 0 | 10 |
| Doubles | 10 | 4 | 14 |
| Total | 20 | 4 | 24 |

Published Singles fixtures come from Season M-3 high-placement Pokepastes.
Published Doubles baseline fixtures come from public Regulation M-B team
pages. Focused strategy regressions may retain an earlier published
Regulation M-A roster when the same legal structure is intentionally evaluated
through PokePilot's current M-B contract; those cross-regulation sources are
called out in fixture notes rather than silently relabeled.
Constructed fixtures are clearly marked and target known failure modes such as
forcing a weather archetype or mistaking Imprison + Trick Room for a friendly
Trick Room mode.

The focused strategy group targets reasoning that requires connecting multiple
sets or battle phases: allied Charm into Contrary Mega Staraptor, a
support-heavy Mega Floette/Mega Delphox ace funnel, Choice Scarf Hisuian
Zoroark triggering a same-turn Round chain through Illusion, and Mega
Froslass manually replacing Mega Charizard Y's sun with Rain Dance. Three use
published complete teams. The Mega Froslass case is explicitly constructed
from a published snow roster and a documented, usage-supported anti-sun move
choice so it cannot be mistaken for an attributed tournament paste.

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

The current request contract is version 9. Each configured set includes
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

The 24 complete-team fixtures cover the first team-analysis flow. Partial
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

The initial 20-team baseline used Luna at `low` reasoning effort. Production
briefly moved to `medium` after live neutral-mechanics tests showed missed move
ownership and simultaneous-active constraints. Prompt v17 then moved those
hard constraints into a private, deterministic strategy audit. A controlled
six-case Prompt v17 comparison found no reliable quality gain from `medium`, so
production and the evaluation CLI now default to `low`; use `medium` only for
explicit comparison runs. Keep every request on Standard processing during
evaluation;
the CLI explicitly sends `service_tier: "default"`, independently of the
Fast-mode setting used by Codex. A versioned prompt-cache key keeps equivalent
evaluation requests on the same cache route while ensuring prompt revisions do
not reuse stale prefixes. Luna requires the `24h` extended-cache retention
mode.

Run one Singles and one Doubles fixture as a smoke test before paying for the
full 24-team suite. Add another hosted model only if Luna fails the product
quality threshold; do not spend tokens on a model comparison that cannot
change the selection decision. Keep evaluation traffic in a separate OpenAI
project from production traffic.

## Running The Evaluation

The default command makes two paid Standard API calls at low reasoning: the
first Singles fixture and the first Doubles fixture.

```bash
npm run eval:ai
```

Run the complete suite after the smoke report is acceptable:

```bash
npm run eval:ai -- --all
```

Run only the four focused strategy regressions when changing interaction or
pairwise-reasoning prompts:

```bash
npm run eval:ai -- --strategy
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
Luna Standard at low reasoning therefore established the historical baseline
for human-facing advisory analysis. Later live neutral-mechanics regressions,
documented under Hosted Analysis Integration, superseded its production
reasoning setting without invalidating this measured comparison. These results
do not justify automatically applying model suggestions without deterministic
validation.

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
and is unavailable to new users. PokePilot will therefore keep Luna plus
deterministic context, strict schemas, grounded post-validation, and repeatable
evals as its optimization path. Fine-tuning should not be treated as a substitute for
current Regulation M-B data even if a future supported training option becomes
available. See the [Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
and [model optimization guide](https://developers.openai.com/api/docs/guides/model-optimization).

## Hosted Analysis Integration

The first production-shaped analysis path now uses
`POST /api/pokepilot/analyze`. The browser sends request-contract v9 and never
imports the OpenAI SDK or reads an API key. The route:

- rejects methods other than `POST` and bodies larger than 256 KB;
- validates the complete incoming request before any paid call;
- calls GPT-5.6 Luna on Standard service at low reasoning with prompt v25;
- allows up to 3,500 combined reasoning and response tokens so a valid
  structured response is not truncated by the output budget;
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

Request v9 sends a deduplicated neutral mechanics dictionary for every selected
move, item, current ability, and projected Mega ability. Effects come from the
same local Showdown snapshots and catalogs used by the product UI; move tags are
preserved without a hand-maintained strategic allowlist. The request builder no
longer derives partner combinations, leads, or field phases from fixture-specific
patterns such as Choice Scarf plus Illusion plus Round. Prompt v17 instead maps
the canonical effects back to their owning sets, audits every possible active
pair in a Doubles roster, checks exact Speed and simultaneous-field constraints,
and then infers openings, branches, and later phases. Existing dual-Mega,
complete-lineup, defensive-profile, opening-turn, and validity guards remain in
force. The model also returns a private strategy audit. Prompts v23-v25 expand the
original lineup/action contract with plan-linked interactions,
participant-bound selected moves, current or projected-Mega abilities, held
items, deterministic facts, and recommendation-to-evidence links. The server
strips this audit from the public response after checking it against the
submitted request. This prevents known classes of impossible prose from
silently reaching the UI without reintroducing Pokemon- or archetype-specific
interaction rules.

Prompt v16 live tests exposed two concrete low-reasoning failures: a Round plan
assigned a same-turn action to a Pokemon outside the stated lead pair, and a
Trick Room plan assigned the move to a Pokemon that had not selected it. Those
failures triggered the v17 grounded-output change and a temporary move to
medium reasoning.

A paid six-case Prompt v17 A/B run compared the user's Coach Scrafty and Round
transition teams with Perish Trap, self-contained weather, anti-Trick Room, and
Baton Pass boundary fixtures. Low completed 6/6 calls at an 11.145-second mean,
59,876 total tokens, and $0.017525 estimated Standard cost. Medium initially
completed 5/6 at a 17.693-second mean, 64,962 total tokens, and $0.023628; the
remaining response exhausted the former 2,500-token output cap. Medium was
58.8% slower and 34.8% more expensive in that run. Raising the cap to 3,500
allowed the failed Round response to complete in 18.593 seconds for $0.003194,
but it still missed the intended Scarf Hisuian Zoroark plus Round-user opening,
as did Low. The other cases showed comparable core synthesis, while Medium also
introduced a false Fire weakness for Dragonite. Because the difficult residual
error was shared rather than solved by extra reasoning, Low is the production
default and the Round opener remains a model-quality regression case rather
than a reason to pay the Medium premium globally.

Prompt v18 adds a generic hard-Trick-Room opening guard without encoding any
Pokemon-specific strategy. Before treating a faster set only as a cleaner, the
model must test whether its selected moves or neutral mechanics support an
opening role through Fake Out, redirection, disruption, pivoting, immediate
pressure, same-turn move interactions, or positioning and deception abilities.
It must also compare setter-plus-slowest-attacker lines with credible fast
enablers and inspect ally-triggered moves shared by two possible leads. The
mechanics dictionary already supplies canonical Illusion and Round effects, so
no `Zoroark -> lead` or team-specific interaction fact was added.

A paid Low regression call on the same Round transition request completed in
11.629 seconds, used 9,867 total tokens, and cost $0.003756 with a cold v18
cache. It correctly promoted Hisuian Zoroark from a backline-only cleaner to a
possible lead before Trick Room, confirming the general fast-lead guard. It
still preferred Snarl disruption and missed the stronger Illusion-assisted
two-user Round chain. That remaining synthesis gap stays explicit rather than
being hidden behind a species-specific hardcoded plan.

## Focused Strategy Repeat Stability

The four opt-in strategy regressions were each run three consecutive times on
August 2, 2026 with GPT-5.6 Luna, Standard service, low reasoning, prompt v18,
and request v9. All 12 responses completed and passed the strict output schema;
there were no invalid outputs or request errors.

| Run | Complete | Average case latency | Cached input | Total tokens | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 4/4 | 11.064 s | 8,196 | 42,725 | $0.014620 |
| 2 | 4/4 | 9.914 s | 36,582 | 42,205 | $0.007467 |
| 3 | 4/4 | 10.304 s | 36,582 | 41,980 | $0.007197 |

The 12 calls used 126,910 total tokens and cost an estimated $0.029285. Mean
case latency was 10.427 seconds. After the first run wrote the new prompt
prefix, 36,582 of 36,594 input tokens were cached in both warm runs; their mean
four-case cost was $0.007332.

Structural reliability did not imply semantic reliability. Manual comparison
against the evaluator-only expectations found stable, case-specific behavior:

| Fixture | Stable recognition | Repeated miss | Hard-failure result |
| --- | --- | --- | ---: |
| Mega Staraptor Charm funnel | Tailwind offense and the alternative Mega branch in 3/3 | Allied Charm plus Contrary and Sylveon's anti-Trick-Room Roar in 0/3 | 3/3 |
| Mega Floette / Mega Delphox ace funnel | Dual-Mega choice, redirection, and support-heavy protection in 3/3 | Calm Mind / Nasty Plot as the protected setup win condition in 0/3 | 0/3 |
| Hisuian Zoroark Round chain | General Illusion and status utility only | Same-turn two-user Round chain and the disguised Scarf lead in 0/3; forced a conventional Trick Room identity in 3/3 | 3/3 |
| Mega Froslass anti-sun Rain Dance | Matchup-specific anti-Fire or anti-sun weather and Basculegion synergy in 3/3 | Exact post-Drought timing in 0/3; the Snow tradeoff appeared in 2/3 | 0/3 |

The run is therefore stable in transport, schema, latency, caching, and broad
team labels, but not yet product-acceptable for surprising ally-triggered move
interactions. The Staraptor and Zoroark cases fail deterministically rather
than intermittently. Future prompt work should strengthen generic enumeration
of ally-targetable stat changes and same-turn shared-move chains, then rerun
these same fixtures before adding team-specific mechanics hints or paying for
the full 24-team suite.

## Prompt v22 Generic Interaction Audit

Prompt v19 turned the two recurring interaction gaps into mandatory private
reasoning passes before archetype selection. The first pass tests legal allied
recipients of single-target effects against current and projected Mega
abilities, including effects that reverse or amplify stat changes. The second
groups sets by canonical selected move ID and enumerates ordered same-turn
pairs. Prompts v20-v22 then generalized candidate-opening priority, effective
Speed modifiers, forced responder order, transformed follow-up moves,
position-dependent deception, and Imprison-based denial. The static prompt
contains no fixture Pokemon, move, or ability names, and a regression assertion
guards that boundary.

The paid development calls were deliberately limited to the two failing cases
and one final four-case sweep:

| Prompt | Scope | Complete | Average case latency | Total tokens | Estimated cost |
| --- | --- | ---: | ---: | ---: | ---: |
| v19 | Staraptor + Zoroark | 2/2 | 12.146 s | 21,855 | $0.007512 |
| v20 | Zoroark | 1/1 | 10.641 s | 11,180 | $0.004221 |
| v21 | Zoroark | 1/1 | 15.133 s | 11,478 | $0.004457 |
| v22 | Zoroark | 1/1 | 13.388 s | 11,466 | $0.004321 |
| v22 | All focused strategy cases | 4/4 | 12.704 s | 45,718 | $0.011832 |

The nine calls used 101,697 total tokens and cost an estimated $0.032342.
Prompt v22 kept strict-schema reliability and produced no request errors.

The ally-target pass resolved the Staraptor regression immediately and the
final v22 sweep again identified allied Charm becoming a Mega Staraptor Attack
boost through Contrary, with Tailwind and Mega Skarmory retained as legitimate
branches. The Floette/Delphox and Froslass outputs did not regress, although the
former still omitted Calm Mind and Nasty Plot setup and the latter still
described anti-sun Rain Dance more generally than the exact post-Drought line.

The shared-move pass improved the Zoroark case from no Round recognition to a
Choice Scarf lead and same-turn Round opening. It did not reliably choose the
strongest responder: both v22 responses paired Zoroark with Dragapult instead
of Mega Gardevoir's transformed Round, one response again inverted the first
user, and neither connected a legal Farigiraf disguise to the opening. This is
now a narrower responder-ranking and deception-synthesis regression rather
than the earlier total archetype failure. Additional strategy-prompt tuning is
paused with the residual case kept explicit.

## Prompt v23-v25 Evidence Audit

Prompt v23 changes the private output contract rather than adding another
Pokemon-specific or archetype-specific mechanics hint. Each hosted team result
now carries four machine-readable layers:

- complete legal lineup plans and concrete move actions;
- cross-set interactions tied to one plan, phase, active state, and owning
  participants;
- compact facts for selected move, ability, item, Mega-option, defensive type,
  and unmodified final-Speed claims;
- one evidence record per recommendation, referencing existing plan,
  interaction, or fact IDs, except for a completely empty team where no such
  evidence can exist.

The deterministic validator now rejects an interaction when a participant is
inactive, does not own a bound move/ability/item, records an unavailable Mega
state, activates two Mega states together, or binds a move without the matching
plan action. It also rejects contradicted weakness/resistance/immunity claims,
incorrect final-Speed comparisons, dangling evidence references, and
recommendations with no private evidence. The production route and evaluation
adapter share the same validator, while the browser still receives only the
public analysis object.

This does not make strategic synthesis deterministic. The server cannot prove
that the model discovered every useful interaction, that every sentence is a
complete paraphrase of its audit, or that a field-modified turn-order inference
is strategically optimal. It verifies the canonical facts the request can
decide exactly and leaves inferred intent, modified sequencing, and matchup
quality to fixtures and semantic evaluation.

The first two-case live smoke exposed contract ambiguity rather than request
failures. v23 rejected both responses because already-Mega sets, Singles
backline participants, and neutral-state ordering were interpreted too
narrowly. v24 clarified those states, preserved failed private outputs in the
ignored evaluation report, and revealed three remaining issues: a Mega option
was treated as a projected state rather than an option attached to the current
slot, sequential move interactions were forced into one phase, and the model
occasionally added an unnecessary false defensive fact. v25 therefore makes a
Mega-option fact current-state metadata, permits non-simultaneous interactions
to bind documented actions across one plan, keeps ally-target/shared-move
checks strictly simultaneous, and asks for only the smallest fact set directly
used by each recommendation. Exact weakness, resistance, immunity, ownership,
Mega-state, and raw-Speed contradictions remain blocking errors.

| Prompt | Complete | Average case latency | Total tokens | Output tokens | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| v23 | 0/2 | 13.474 s | 25,234 | 4,210 | $0.009333 |
| v24 | 0/2 | 12.962 s | 25,511 | 4,025 | $0.009173 |
| v25 | 2/2 | 12.496 s | 25,530 | 3,698 | $0.008827 |

The v25 smoke used the published M-3 Singles Gengar/Mega Starmie team and the
focused Doubles Mega Staraptor Charm funnel. The Singles response separated
Tailwind physical pressure from Mega Gengar's Shadow Tag plus Perish Song
branch. The Doubles response promoted allied Prankster Charm into Contrary
Mega Staraptor's immediate Attack boost ahead of a generic first-turn Tailwind
line, while retaining Mega Skarmory as the exclusive matchup branch. Both
responses passed the shared production validator with no request errors. Future
evaluation reports retain the complete private grounded object locally for
both valid and invalid calls; production still returns only public analysis.

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

- a balanced baseline of exactly 10 Singles and 10 Doubles fixtures;
- four separate Doubles strategy regressions and 24 fixtures in total;
- 19 published teams and 5 explicitly constructed cases;
- unique IDs and complete source metadata;
- six parseable Pokemon sets per fixture;
- item, ability, nature, and four moves per set;
- Champions limits of 32 Stat Points per stat and 66 total;
- Item Clause within every team.

`aiModelEvaluation.test.ts` additionally verifies:

- all 24 fixtures pass through the production Showdown importer, deterministic
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

`copilotStrategyAudit.test.ts` verifies that grounded plans accept legal owned
moves while rejecting both a move assigned to the wrong Pokemon and an opening
action assigned to a Pokemon still in the backline.

`aiEvaluationReporter.test.ts` verifies aggregate usage and cost reporting,
manual-review placeholders, and separation between model output and
evaluator-only expectations.

The provider adapter and result writer should keep outputs outside the source
fixture files so a model response can never silently redefine the expected
team interpretation.
