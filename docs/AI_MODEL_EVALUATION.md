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

The July 31, 2026 prompt-v2 smoke run completed one Singles and one Doubles
fixture with strict-schema output:

| Effort | Cases | Tokens | Estimated Standard cost | Average latency |
| --- | ---: | ---: | ---: | ---: |
| Low | 2 | 6,697 | $0.003167 | 7,323 ms |
| Medium | 1 Singles retry | 3,570 | $0.001862 | 9,256 ms |

The low-effort Doubles response recognized both speed modes, the alternative
Mega choices, and the team's spread attacks after the general prompt
checklist was strengthened. The Singles response still attributed type
weaknesses or immunities to the wrong Pokemon and undercounted available
special damage. Medium reasoning did not resolve those deterministic factual
errors.

Do not run the paid 20-case suite yet. First add per-set defensive profiles
(including ability immunities) and aggregate physical/special move presence to
`CopilotAnalysisRequest`. The rules engine should supply those facts instead
of paying a model to reconstruct the type chart. Repeat the two-case smoke run
after that contract change.

The smoke requests recorded cache writes but no cache hits. The shared static
prefix is currently too small relative to the differing team payloads to
assume meaningful savings, even with a stable cache key. Cost planning should
continue to use uncached or cache-write pricing until a larger run demonstrates
real hits.

At the measured low-effort average of about $0.001584 per team analysis, 900
monthly analyses would cost about $1.43 and a $10 budget would cover roughly
6,300 analyses. This is a baseline for one-shot team analysis only. Follow-up
chat, retries, larger future payloads, and additional analysis modes need their
own measurements before they share the same production budget.

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
