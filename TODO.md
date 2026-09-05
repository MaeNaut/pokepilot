# PokePilot TODO

This file is for active implementation notes and small follow-up tasks. Keep larger product direction in `ROADMAP.md`.

## Now

- [x] Define the Calculator MVP before building its UI.
  - [x] Keep the first release focused on damage while showing the calculated
        combat stats inside each Pokemon panel instead of adding a separate
        stat-calculation surface.
  - [x] Document the Pokemon Champions level, IV, EV, nature, field, and damage
        assumptions used by the engine.
  - [x] Define calculator input and result types around the existing canonical
        Pokemon, item, ability, nature, and move IDs.
- [x] Implement the deterministic calculator engine before the page shell.
  - [x] Add focused fixtures for stats, STAB, type effectiveness, damage rolls,
        critical hits, spread moves, weather, and representative item/ability effects.
  - [x] Keep unsupported mechanics explicit instead of silently approximating them.
- [x] Add the Calculator app mode after the engine fixtures pass.
  - [x] Add Team Builder / Calculator navigation.
  - [x] Reuse the shared header, saved team, build state, legality data, and
        localized game catalogs.
  - [x] Keep the shared PokePilot panel available in both modes and preserve
        calculator-local matchup state while switching between them.
- [x] Establish repeatable external-reference checks for the damage calculator.
  - [x] Capture eight representative Regulation M-B singles matchups covering
        physical, special, STAB, resistance, weakness, and sun modifiers.
  - [x] Store the builds, expected combat stats, damage ranges, source metadata,
        and observed third-party comparator ranges as offline Vitest fixtures.
  - [x] Prefer documented Champions mechanics and standard generation-9
        modifier ordering over blindly matching a comparator's rounding.
- [ ] Extend the reference suite with real Pokemon Champions battle captures and
      Champions-exclusive mechanics as reliable examples become available.

## Team Management

- [x] Design a serializable `TeamBuildState`.
  - [x] Include Pokemon slot identity.
  - [x] Include item, ability, nature, EVs, moves, and Mega/form state.
  - [x] Add a saved-team schema version for future migrations.
  - [x] Preserve complete active and bench builds through JSON/localStorage round trips.
  - [x] Enforce current limits of 30 saved teams and six bench Pokemon per team
        without deleting legacy over-limit data.
- [ ] Prepare saved-team records for account-backed storage when server migration begins.
  - [ ] Draft normalized `teams` and `pokemon_sets` tables with active/bench
        location and ordering.
  - [ ] Persist canonical IDs plus editable build values instead of display text
        and asset URLs.
  - [ ] Add a regulation/format identifier so saved teams can be revalidated
        against later rule data.
  - [ ] Revisit team and bench limits using real product usage.
- [x] Lift or expose TeamBuilder slot edit state so it can be saved.
  - [x] Avoid saving only the visible Pokemon slots while losing item/ability/nature/EV/move choices.
  - [x] Keep existing picker behavior stable during the state refactor.
- [x] Add localStorage-backed team persistence.
  - [x] Save the current team with the header team name field.
  - [x] Store created/updated timestamps.
  - [x] Handle empty or partially filled teams.
- [x] Add team load functionality.
  - [x] Restore Pokemon slots.
  - [x] Restore per-slot build details.
  - [x] Warn before overwriting the current unsaved team.
- [x] Add a saved team list / management interface.
  - [x] Open from the header list icon.
  - [x] Show saved team names and compact Pokemon previews.
  - [x] Support load, rename, duplicate, delete, and Showdown text actions.
  - [x] Reorder saved teams with pointer, touch, or keyboard controls.
- [x] Wire the header team action buttons.
  - [x] Add the left-side header layout: team list, team name, save.
  - [x] Add a header team name field for draft names and future rename flow.
  - [x] Save icon saves the current team with the header name.
  - [x] New team icon opens blank-team and direct Showdown-import actions.
  - [x] Treat a direct Showdown import as a new unsaved team and preserve pasted text when its discard warning is cancelled.
  - [x] List icon opens team management.
- [x] Add bench Pokemon support.
  - [x] Keep bench Pokemon outside the six active team slots.
  - [x] Preserve the complete item, ability, nature, EV, move, Mega, and form build while benched.
  - [x] Move or swap Pokemon between bench and active slots with pointer drag, touch hold-and-drag, or direct selection.
  - [x] Persist bench entries with saved teams while excluding them from team previews and Showdown text.
  - [x] Keep validity, diagnostics, and PokePilot analysis focused on the active six.

## Data And Legality

- [x] Fix Showdown text species-name compatibility for Pokemon forms and Mega Evolutions.
  - [x] Export canonical Showdown species names instead of PokePilot-only form labels or IDs.
  - [x] Cover Mega, regional, gender, and selectable form names without changing their saved canonical identity.
  - [x] Add import-export round-trip fixtures whose output can be pasted into Pokemon Showdown without species-name errors.
- [x] Add a Vitest regression-test foundation for pure application logic.
  - [x] Cover Champions stat and nature calculations.
  - [x] Cover team diagnostic multipliers, ability immunities, roles, concepts, and alerts.
  - [x] Cover Showdown text formatting and parsing.
  - [x] Cover first-pass set validity, Mega Stone matching, EV limits, Species Clause, and Item Clause.
  - [x] Add representative Regulation M-B legality and form-alias fixtures.

- [x] Harden the Pokemon Champions Regulation M-B legality layer.
  - [x] Share and locally cache normalized Showdown Pokedex and move snapshots.
  - [x] Use Showdown as the primary selected-Pokemon source for types, base stats, abilities, legal move IDs, and move details.
  - [x] Keep PokeAPI selected-Pokemon requests only for artwork/icon URLs and fallback data.
  - [x] Remove per-move PokeAPI requests and deduplicate concurrent Pokemon and legality loads.
  - [x] Add regression checks against representative raw Showdown Pokemon, item, ability, and move snapshots.
  - [x] Move the main Pokemon index and form metadata to a Showdown-backed model carrying canonical source IDs and PokeAPI-compatible asset IDs.
  - [x] Replace PokeAPI item and ability detail requests with compact Showdown-derived data.
  - [x] Replace the large runtime teambuilder-table download with a compact Regulation M-B snapshot.
  - [x] Finish the post-migration refactor and remove duplicate ID, cache, and form-move loading paths.
  - [x] Document known Showdown/PokeAPI name mapping exceptions.
- [x] Add usage-stats default sets.
  - [x] Fetch and parse Smogon monthly moveset stats for Regulation M-B.
  - [x] Auto-apply popular usage sets only from the main Pokemon picker.
  - [x] Show empty-query Pokemon dropdown suggestions in Smogon usage order with usage ranks and 20-at-a-time scroll loading.
  - [x] Apply hidden-scrollbar infinite loading to Pokemon, item, ability, move, and reverse-filter option lists.
- [ ] Revisit optional usage-data behavior after more team-building use.
  - [ ] Decide whether base Pokemon should ever auto-upgrade into a popular form
        or Mega instead of requiring an explicit choice.
  - [ ] Add a small usage-source status surface only if debugging or user trust
        demonstrates a real need.
- [x] Add persistent reverse candidate filters to empty Pokemon slots.
  - [x] Keep Pokemon search and its candidate list permanently visible while the selected slot is empty.
  - [x] Keep type, ability, and move controls in the empty card instead of crowding the Pokemon dropdown.
  - [x] Let preselected type, ability, and move requirements narrow legal Pokemon candidates.
  - [x] Save empty-slot requirements with the team and preserve them across slot reordering.
  - [x] Include saved requirements in PokePilot team and selected-slot analysis requests.
  - [x] Keep item, nature, and EV filters out until a clear strategy-recommendation UI is designed.
- [x] Add a compact validity trigger, issue popover, and per-slot problem markers.
- [ ] Extend validity beyond the current editor surface if level, gender, or complex format rules are added.

## AI / Copilot

- [x] Decide the first AI feature shape.
  - [x] Start with structured analysis of the active team and selected Pokemon.
  - [x] Keep deterministic diagnostics and legality as the factual source of truth.
- [ ] Add limited follow-up chat after hosted analysis is stable.
- [x] Add recommendation generation for saved empty-slot requirements.
  - [x] Build a diversified 28-Pokemon pool from Regulation M-B legality,
        Species Clause, type/ability/move filters, format usage, defensive
        pressure, strategy fit, missing roles, and offensive coverage.
  - [x] Send compact common-set, base-stat, Speed-tier, role, concept, defensive
        delta, and Mega-branch facts so Luna can compare the full pool without
        treating shortlist order or usage rank as the answer.
  - [x] Derive reusable candidate responsibility IDs from generic move and
        ability mechanics, including redirection, ally protection, priority
        denial, speed control, recovery, disruption, and pivoting.
  - [x] Send exact candidate weaknesses and current-team responsibility counts
        so complementary support can be distinguished from redundant labels.
  - [x] Let hosted AI rank only supplied candidates and reject invented,
        duplicate, or out-of-pool recommendation IDs at the server boundary.
  - [x] Add four empty-slot recommendation fixtures covering rain restoration,
        ace protection, Round-chain control, and Singles dual-Mega balance.
  - [x] Finish Prompt v43 recommendation stability at Luna Standard low: the
        four cases passed 4/4, and a three-repeat sweep passed 12/12 while the
        required strategic candidates remained stable.
  - [x] Add a Team / Pokemon / Recommend scope and require an explicit Select
        Pokemon action before applying the popular set to the empty slot.
- [ ] Define one reusable matchup-scenario contract for targeted and meta-backed
      threat analysis and set optimization.
  - [ ] Let the Calculator create an explicit scenario directly from the chosen
        opponent build, battle state, direction, move, and objective without
        requiring the future meta benchmark pool.
  - [ ] Let a meta adapter create the same scenario shape from multiple weighted
        benchmark sets so the deterministic engines do not fork by product mode.
  - [ ] Keep general/meta and dedicated/targeted modes available for both threat
        analysis and set optimization.
- [ ] Add calculator-first exact-target Pokemon set optimization.
  - [ ] Require an explicit opponent build, battle state, direction, and one or
        more OHKO, survival, Speed, or ally-order objectives before optimizing.
  - [ ] Keep extreme, minimal-investment, balanced, and robust candidates on a
        Pareto frontier; recommend fine tuning only when it produces a verified
        gain over the extreme baseline.
  - [ ] Treat Trick Room Speed as a separate objective that can prioritize low
        Speed, ally action order, mirror benchmarks, or pre-room turns instead
        of ordinary outspeed coverage.
  - [ ] Preview gained and lost benchmarks before applying a candidate, then
        allow replacing the current set or saving a variant to the bench.
  - [ ] Mark exact-target results as conditional on the entered opponent and
        battle state, and abstain when no justified tuning beats a simple set.
- [ ] Build a reusable, format-versioned meta benchmark layer for general threat
      analysis and robust multi-target set optimization.
  - [ ] Generate compact representative set profiles from monthly usage data
        while retaining source, month, usage weight, and confidence metadata;
        treat the data as a soft prior rather than ground truth.
  - [ ] Normalize only canonical IDs, final stats, relevant mechanics, and role
        facts; reuse existing catalogs instead of duplicating labels,
        descriptions, sprites, or full upstream payloads.
  - [ ] Cluster equivalent or dominated spreads and keep extreme-investment
        baselines so fine tuning is never assumed to be better by default.
  - [ ] Version snapshots by regulation, Singles/Doubles format, and usage month.
  - [ ] Keep snapshots out of the initial bundle, load only the requested
        format on demand, and cache them outside synchronous localStorage.
- [ ] Add deterministic team-level threat discovery in targeted and meta modes.
  - [ ] In targeted mode, evaluate all six current sets against the exact
        Calculator opponent and conditions.
  - [ ] Classify each current answer as already sufficient, conditional,
        EV/nature-tunable, move/item-dependent, or unable to provide a verified
        answer before suggesting a new Pokemon.
  - [ ] In meta mode, discover threats from the weighted benchmark layer rather
        than requiring the user to configure each opponent manually.
  - [ ] Score offensive pressure, progress denial/walling, Speed control, game
        plan disruption, answer scarcity, reliability, and usage separately.
  - [ ] Distinguish hard counters, reliable checks, conditional checks, and
        unsupported matchups with visible evidence and confidence.
  - [ ] Let a threat finding open either targeted Pokemon recommendation or a
        prefilled calculator optimization flow instead of presenting advice as
        a dead-end report.
- [x] Define a provider-independent Copilot request and response contract.
  - [x] Send structured team, selected Pokemon, diagnostics, and validity summaries rather than raw UI text.
  - [x] Render summary, strengths, weaknesses, priorities, and recommendations as product UI rather than plain chat text.
  - [x] Add regression tests for compact request snapshots and local team/Pokemon analysis.
- [x] Add opt-in Chrome on-device AI without hosted credits or cooldowns.
  - [x] Keep GPT 5.6 as the default and never switch a failed local request to
        the hosted provider automatically.
  - [x] Reuse scope-specific baseline sessions, clone and destroy one session
        per request, constrain responses with the shared product JSON schema,
        and retry invalid local output twice.
  - [x] Keep deterministic rules fallback, hosted AI, and on-device AI as
        distinct history and result sources.
  - [x] Limit the first release to officially supported English output and
        supported desktop Chrome devices; keep Android and Korean unavailable.
  - [ ] Benchmark real Gemini Nano quality and context limits across Team,
        Pokemon, and Recommend scopes before calling the local path stable.
- [x] Add an offline Regulation M-B team fixture suite for hosted-model evaluation.
  - [x] Keep an even baseline split of 10 Singles and 10 Doubles teams.
  - [x] Attribute 16 published teams and mark four constructed archetype-boundary cases separately.
  - [x] Store complete Showdown sets, format metadata, critical observations, and forbidden conclusions.
  - [x] Validate fixture parsing, Stat Point limits, complete sets, unique IDs, and Item Clause with Vitest.
  - [x] Add four opt-in deep-strategy regressions for Contrary ally debuffs,
        protect-the-ace support, Illusion-assisted Round, and manual anti-sun
        weather replacement without leaking their intended plans into prompts.
  - [ ] Add 4-6 more known-intent teams for fast hard-Trick-Room leads,
        switch-dependent control, difficult select-four branches, and atypical
        Singles plans before treating the expanded suite as stable.
- [x] Complete the repeatable GPT-5.6 Luna hosted-model evaluation runner.
  - [x] Generate identical provider-independent requests from every team fixture through the production Showdown import, diagnostics, validity, and request-building path.
  - [x] Keep source provenance, raw Showdown text, and evaluator expectations outside the model adapter input.
  - [x] Define a shared strict output JSON Schema and validate structured output before scoring or saving a result.
  - [x] Add a Standard-tier Luna Responses API adapter with an explicitly cached
        static-instruction prefix, reasoning controls, usage accounting, and
        estimated cost.
  - [x] Add JSON/Markdown evaluation reports and a two-fixture smoke CLI.
  - [x] Run the first low-reasoning Singles/Doubles smoke test and a targeted
        medium-reasoning retry.
  - [x] Add deterministic per-set defensive profiles, ability immunities, and
        physical/special move-presence summaries to the model request before
        running the paid 20-team suite.
  - [x] Include normalized move categories, Doubles spread targets, and
        aggregate physical/special/spread source slots in the request.
  - [x] Repeat the Singles/Doubles Luna Standard low smoke test with the
        enriched request and record its token, cost, latency, and residual
        wording issues.
  - [x] Add localized display labels, pre/post-Mega projections, complete Mega
        options, final stats, move-owner maps, and invalid-lineup guards before
        the final run.
  - [x] Add compact Showdown-backed effects and tags for all selected moves,
        abilities, and items without pre-classifying team combinations.
  - [x] Remove fixture-derived Round, partner, and phase rules from the request
        builder; make the model audit every possible Doubles pair and infer
        supported interactions from the current team instead.
  - [x] Temporarily move the production and default evaluation path to Luna
        Standard medium after neutral-mechanics live tests exposed missed move
        ownership and simultaneous-active constraints at low reasoning.
  - [x] Require a private structured strategy audit and deterministically reject
        plans that assign an unselected move, an inactive actor, an incomplete
        lineup, or an inconsistent lead/backline split.
  - [x] Re-run targeted paid Round and Trick Room regression cases against
        prompt v17, then compare six representative cases at low and medium.
  - [x] Return production and evaluation defaults to Luna Standard low after the
        six-case A/B showed no dependable quality gain from medium despite 34.8%
        higher cost and 58.8% higher latency.
  - [x] Raise the combined reasoning/response ceiling from 2,500 to 3,500 tokens
        after a medium response exhausted the old cap; billing remains based on
        tokens actually generated rather than the configured ceiling.
  - [x] Add a Prompt v18 hard-Trick-Room guard that evaluates fast attackers and
        disruptive sets as possible leads instead of forcing them into a
        backline-only cleaner role.
  - [x] Confirm with a paid Low regression call that v18 recognizes Scarf Hisuian
        Zoroark as a possible pre-Trick-Room lead without encoding a species rule.
  - [x] Run the four focused strategy fixtures three consecutive times at Luna
        Standard low and record 12/12 schema completion, warm-cache cost, and
        semantic repeatability. The ace-protection and anti-sun cases remained
        broadly useful, while Contrary Charm and the Round chain failed 3/3.
  - [x] Add Prompt v19-v22 mandatory ally-target and shared-move passes without
        naming fixture Pokemon, moves, abilities, or expected plans.
  - [x] Improve generic synthesis of ally-targeted stat changes: both targeted
        v19 and full v22 runs recognized Prankster Charm becoming an Attack
        boost through Mega Staraptor's Contrary.
  - [x] Add Prompt v23-v25 plan, interaction, deterministic-fact, and
        recommendation-evidence validation; preserve private output in ignored
        evaluation reports and finish with a 2/2 Luna Standard low smoke pass.
  - [x] Split Prompt v29 into a reusable common prefix and analysis-scope
        prefixes so Team, Pokemon, and Recommend calls share stable core cache
        tokens without forcing scope-specific instructions into every request.
  - [x] Add production-hydrated selected-Pokemon fixtures, `--scope pokemon`,
        `--slot`, and `--pokemon-regressions` evaluation paths without leaking
        evaluator expectations into model input.
  - [x] Finish selected-Pokemon shared-move responder ranking: the live v29
        regression identifies Scarf Hisuian Zoroark as the Round trigger and
        Mega Gardevoir as the stronger Pixilate responder.
  - [x] Finish generic deception ranking without encoding fixture answers.
        Prompt v34 privately compares every legal Illusion presentation by its
        concrete first-turn decision impact, current ability, optional Mega
        ability, timing, and opportunity cost. Mega Gengar and Farigiraf are
        both valid when the response explains the actual false expectation;
        neither species is a hardcoded answer.
  - [x] Validate selected-Pokemon recommendation evidence, named teammate
        coverage, shared-move ownership, defensive relations, and exact Speed
        comparisons including unconditional numeric held-item modifiers.
  - [x] Add request-contract v12 localized type labels and Prompt v34 prose
        validation so exact weakness coverage and negative "no teammate covers
        this type" claims must match every current defensive profile.
  - [x] Re-run cross-scope Prompt v43 regressions after the recommendation
        changes: Team passed 4/4, selected Pokemon passed 6/6, and empty-slot
        recommendations passed 12/12 across three repeats.
  - [x] Score factual fidelity, format awareness, strategic synthesis, prioritization, calibration, and Korean quality.
  - [x] Track hard failures separately from aggregate scores, latency, token use, and cost.
  - [x] Keep the ignored local evaluation key, reports, and capped test budget
        separate from future browser and production credentials.
- [x] Add a server-side API route for AI analysis.
  - [x] Keep API keys out of browser code.
  - [x] Move the Luna adapter behind a server-only `POST` endpoint that accepts
        request-contract v14 and keeps Standard-tier low reasoning explicit.
  - [x] Validate both the incoming analysis request and the strict model response
        at the server boundary before returning product data.
  - [x] Call analysis explicitly rather than automatically on every team edit.
  - [x] Connect the PokePilot Analyze action to the hosted route while retaining
        deterministic local analysis as the offline/error fallback.
- [ ] Validate AI output before rendering it.
  - [x] Validate private strategy plans against selected move ownership, active
        slots, complete Singles/Doubles selections, and lead/backline structure
        before returning hosted prose to the browser.
  - [x] Expand the private audit with plan-linked interactions, participant-bound
        moves/abilities/items/Mega states, deterministic facts, and evidence for
        every recommendation.
  - [x] Reject unsupported interaction ownership, inactive participants,
        simultaneous Mega activations, unavailable Mega states, incorrect
        defensive-profile or final-Speed facts, and dangling evidence IDs.
  - [x] Apply the same deterministic fact and recommendation-evidence audit to
        hosted selected-Pokemon analysis rather than validating only Team scope.
  - [x] Audit recommendation candidate IDs, exact common elements, defensive
        facts, responsibility evidence, and candidate-only evidence links before
        any ranked result reaches the browser.
  - [x] Normalize only non-semantic private bookkeeping that can be recovered
        from verified public evidence; keep invented public facts and unsupported
        claims as blocking failures.
  - [x] Recheck suggested Pokemon, items, abilities, moves, and team clauses in a
        proposed state before applying a candidate; reject stale or unverifiable
        applications without partially mutating the team.
  - [ ] Keep AI output clearly advisory, not authoritative legality or calculator data.
- [x] Add local error, refresh, and stale-analysis states for Copilot.
- [x] Add a remote API-unavailable state with deterministic fallback.
- [x] Persist a bounded local PokePilot analysis history.
  - [x] Restore an exact team, scope, locale, and request-state match after reload.
  - [x] Preserve the visible result across language changes and recover the prior
        language's exact result when available.
  - [x] Let users browse or delete the current team's recent analyses without
        adding unbounded history to saved-team data.
  - [x] Keep the history menu outside the clipped PokePilot panel and reuse the
        shared destructive-action confirmation UI before deletion.
- [x] Finish deployment-stage cost controls for a multi-instance public launch.
  - [x] Cache identical one-shot analyses by canonical team, format, regulation,
        locale, prompt version, and request-contract version.
  - [x] Add a signed anonymous-client cookie, hashed-IP backstop, progressive
        rolling cooldowns, in-flight request deduplication, and `Retry-After`
        responses without storing raw IP addresses.
  - [x] Keep the model request at a 60-second timeout and 3,500 combined
        reasoning/response token ceiling.
  - [x] Log cache status, latency, token use, and estimated cost without logging
        team contents or requester identifiers.
  - [x] Add server-start-only local modes for production-like safeguards,
        cached AI QA without cooldown, fresh AI QA without cache/cooldown, and
        an accelerated one-call/10-second cooldown test.
  - [x] Add an optional Upstash Redis adapter for shared canonical responses,
        atomic client/IP rate decisions, and distributed identical-request
        deduplication while retaining the in-memory local adapter.
  - [x] Add an opt-in `dev:shared` mode with ignored mode-specific credentials,
        enforced safeguards, and a development-only Redis namespace while
        keeping routine local development in memory.
  - [x] Verify the real Upstash development database with a temporary
        read/write/delete round trip, cross-adapter canonical cache, distributed
        single execution, and atomic rate-limit smoke test.
  - [x] Validate every nested AI request field before model dispatch and include
        full team context in Pokemon analysis history, cache, and single-flight keys.
  - [x] Rate-limit cache hits separately from success-based analysis credits and
        cap both per-key and total distributed waiters below the Function deadline.
  - [x] Track provider dispatches in a separate abuse budget so repeated failed
        responses cannot refund their way around the OpenAI cost guard.
  - [x] Provision separate preview/production Redis namespaces, require the
        shared store in public deployment, and verify it under multi-instance
        concurrency and provider-failure tests.
  - [x] Avoid unbounded AI analysis or chat history in the primary team database.
  - [ ] Keep calculator history local or capped unless users explicitly need cloud history.

## Calculator

- [x] Add a one-direction-at-a-time damage calculator with fixed My Pokemon and
      Opponent Pokemon panels.
- [x] Let the direction control change which side attacks without moving either
      Pokemon panel.
- [x] Reuse the active saved team on the left and keep edits connected to the
      normal dirty/save flow.
- [x] Keep the opponent build local to the calculator and allow direct Pokemon,
      item, ability, nature, move, EV, HP, status, and stat-stage editing.
- [x] Add a team-aware Singles/Doubles header toggle and connect it to saved
      teams, format-specific usage rankings, PokePilot context, and calculator rules.
- [x] Support Regulation M-B Pokemon/item filtering, required Mega Stone locking,
      level 50, fixed IV 31, Champions stat points, doubles spread damage,
      weather, terrain, room/gravity effects, Fairy Aura, critical hits, Helping
      Hand, Tailwind, Friend Guard, Plus/Minus activation, screens, and burn.
- [x] Show damage rolls, percentages, current-HP KO chance, multi-hit KO summary,
      and the attack/defense stats used by the calculation.
- [x] Lazy-load the calculator page and damage engine outside the initial Team
      Builder module.
- [x] Reuse the builder's Pokemon, item, type, and move presentation patterns,
      including a searchable Regulation M-B opponent picker.
- [ ] Expand explicit Champions-only move, item, and ability overrides when the
      upstream generation-9 engine does not yet model a new mechanic.
- [ ] Decide after playtesting whether to add simultaneous two-way results,
      usage-based opponent defaults, reusable opponent presets, and dedicated
      offensive-power / physical-bulk / special-bulk summaries.

## Polish

- [x] Finish Korean localization.
  - [x] Add a typed English/Korean UI dictionary and persist the language preference.
  - [x] Generate editable Korean game-name and description snapshots from PokeAPI.
  - [x] Localize builder controls, pickers, diagnostics, tooltips, and share previews.
  - [x] Localize deterministic PokePilot analysis and remaining validity prose.
  - [x] Anchor the validity popover and its pointer to the validity trigger.
  - [x] Standardize Korean app copy on concise status and action phrasing.
  - [x] Audit Korean terminology, long-label fit, and empty/loading/error states across the builder.
- [x] Add persisted system/light/dark theme preferences.
  - [x] Default cold starts to system mode, track operating-system changes live, and keep explicit choices in localStorage.
  - [x] Expose all three preferences in a localized, keyboard-dismissable header menu.
  - [x] Theme the editor, pickers, popovers, diagnostics, team management, and PokePilot shell consistently.
  - [x] Keep semantic nature, validity, danger, move-type, and saved-team states legible in dark mode.
  - [x] Keep exported Pokemon and team images on their stable light presentation in either app theme.
- [x] Add a real app icon / logo mark.
- [x] Complete the emulated tablet/mobile UI pass.
  - [x] Add the first tablet workspace layout with a fully visible Pokemon card and an edge-triggered PokePilot drawer.
  - [x] Fit short landscape tablet layouts without document overflow by compacting secondary diagnostics and footer spacing.
  - [x] Audit tablet popovers, pickers, team management, drawer behavior, and touch-first editing interactions across representative emulated tablet viewports.
  - [x] Use shared dimmed selection dialogs for Pokemon, item, ability, and move editing on compact layouts, with tap-to-preview, explicit confirmation, and orientation-stable controls.
  - [x] Add the first mobile workspace layout with a compact header, horizontal Team Rail, single-column editor, and near-full-screen PokePilot drawer.
  - [x] Verify mobile text fit, overflow, picker placement, empty-slot filtering, team management, and portrait/landscape transitions across representative emulated phones.
  - [x] Test text fit, overflow, popover placement, drag/hold reordering, orientation changes, and scroll behavior at representative tablet widths.
- [ ] Run non-blocking real-device compact-layout QA before public release.
  - [ ] Check Safari safe areas, dynamic browser chrome, and the virtual keyboard.
  - [ ] Check long-press reordering, EV sliders, picker dialogs, and orientation changes.
- [x] Add loading states for Pokemon, item, and move fetches.
- [x] Add local error and Retry states for failed PokeAPI, Showdown legality, and Smogon usage requests.

## Before Public Deployment

- [x] Add a checked-in CI quality gate, Vercel runtime/rewrite/security config,
      and a concrete deployment checklist.
- [x] Complete hosted environment separation, production smoke testing, cache
      verification, response-header checks, and rollback-readiness review from
      `docs/DEPLOYMENT_CHECKLIST.md`.
- [ ] Use a Preview-first promotion flow for future production releases.
- [x] Publish a concise privacy notice and visible feedback/security contact path.
- [ ] Enable GitHub private vulnerability reporting before a broader public launch.
- [x] Clean up generated assets and audit `THIRD_PARTY_NOTICES.md`.
- [x] Measure the production bundle and lazy-load genuinely deferred features if
      initial transfer or parse cost warrants it.
- [x] Run Lighthouse and representative cold-load/network checks.
- [x] Run `npm run lint`, `npm run test:run`, and `npm run build`.

## Done Recently

- [x] Split Team Rail, selection details, usage ordering, touch search, and
      outside-click behavior out of the monolithic TeamBuilder implementation.
- [x] Centralize slot mutations, nature/stat rules, and repeated move-detail UI.
- [x] Load Pokemon battle data from Showdown with PokeAPI artwork/icon fallback.
- [x] Add Pokemon name search with type-to-filter behavior.
- [x] Add regional form, form-change, and Mega selection handling.
- [x] Add item search and Mega Stone auto-lock behavior.
- [x] Add all natures with a stat alignment table.
- [x] Switch EV/stat calculation to Pokemon Champions-style EV assumptions.
- [x] Load complete move details and legal move lists from Showdown without per-move PokeAPI requests.
- [x] Sort moves by type, then alphabetically.
- [x] Add move detail tooltips.
- [x] Add item and ability detail tooltips.
- [x] Add custom type icons from third-party SVG assets.
- [x] Add `THIRD_PARTY_NOTICES.md` for MIT-licensed type icons.
- [x] Add Font Awesome and Pokemon Showdown third-party notices.
- [x] Replace compact tabs with a persistent Team Rail using icon sprites, names, types, and items.
- [x] Rework Pokemon artwork as a translucent card background layer.
- [x] Add Pokemon Showdown-backed Regulation M-B legality filtering for Pokemon, items, abilities, and per-Pokemon moves.
- [x] Verify M-B move legality against a real Pokemon Champions Charizard learnset check.
- [x] Add keyboard navigation for Pokemon, item, ability, nature, and move pickers.
- [x] Make hover-to-keyboard selection flow consistent across Pokemon, item, ability, and move pickers.
- [x] Add fallback item display for items without sprites.
- [x] Replace the header brand with Font Awesome team action icon buttons.
- [x] Add Showdown text import/export and move Pokemon slot tabs to the card side.
- [x] Add Smogon monthly usage stats fetching for popular Pokemon default sets.
- [x] Add localStorage saved-team management with load, rename, duplicate, delete, reorder, and last-opened team restore.
- [x] Add Pokemon-level and team-level Showdown text import/export.
