import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPokemon } from "../src/api/pokeApi";
import { fetchPokemonIndex } from "../src/api/pokemonIndex";
import {
  fetchAbilityIndex,
  fetchItem,
  fetchItemIndex,
} from "../src/api/showdownCatalog";
import { loadShowdownLegality } from "../src/api/showdownLegality";
import { resolveAutomaticEnvironment } from "../src/calculator/automaticEnvironment";
import {
  createCalculatorBattleState,
  createDefaultCalculatorField,
  getCalculatorMaxHp,
  getCalculatorMoveSlots,
  getCalculatorSpeed,
} from "../src/calculator/calculatorViewModel";
import type {
  CalculatorAnalysisContext,
  CalculatorAnalysisSide,
} from "../src/calculator/setOptimizer/types";
import { createTeamMatchupAnalysisPlans } from "../src/calculator/teamMatchup";
import { createProjectedMegaMember } from "../src/utils/megaEvolution";
import { createOpenAiLunaAdapter } from "../src/test/evaluation/openAiLunaAdapter";
import {
  aiTeamDoublesFixtures,
  aiTeamStrategyFixtures,
} from "../src/test/fixtures/aiTeamFixtures";
import type { AiTeamFixture } from "../src/test/fixtures/aiTeamFixtureTypes";
import type { TeamMember } from "../src/types";
import { getPokemonBuildSnapshot } from "../src/utils/benchPokemon";
import type { CopilotAnalysisResponse } from "../src/utils/copilotContracts";
import { createCopilotAnalysisRequest } from "../src/utils/copilotRequestBuilder";
import { validateCopilotAnalysisRequest } from "../src/utils/copilotRequestContract";
import { buildImportedShowdownSnapshot } from "../src/utils/showdownImport";
import { createTeamAnalysisContext } from "../src/utils/teamAnalysisContext";
import type { TeamBuildState } from "../src/utils/teamBuildState";
import { resolveOpenAiApiKey } from "../server/openAiEnvironment";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type MatchupQaCase = {
  id: string;
  fixture: AiTeamFixture;
  selectedSlot: number;
  opponentText: string;
  expectedMentionGroups: string[][];
  qualityChecks?: Array<{
    id: string;
    passes: (output: CopilotAnalysisResponse) => boolean;
  }>;
  intent: string;
};

const coachScraftyFixture: AiTeamFixture = {
  schemaVersion: 1,
  id: "doubles-constructed-coach-scrafty",
  title: "Coach Scrafty",
  regulation: "M-B",
  battleFormat: "doubles",
  source: {
    origin: "constructed",
    name: "PokePilot persistent-defense matchup QA",
    retrievedAt: "2026-09-08",
  },
  showdownText: `Scrafty @ Roseli Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 2 Def / 32 SpD
Sassy Nature
- Fake Out
- Snarl
- Close Combat
- Coaching

Mawile @ Mawilite
Ability: Hyper Cutter
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Play Rough
- Iron Head
- Sucker Punch
- Protect

Basculegion @ Choice Scarf
Ability: Adaptability
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Wave Crash
- Aqua Jet
- Last Respects
- Protect

Tyranitar @ Sitrus Berry
Ability: Sand Stream
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Rock Slide
- Knock Off
- Low Kick
- Protect

Aegislash @ Spell Tag
Ability: Stance Change
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Sacred Sword
- Shadow Sneak
- Iron Head
- King's Shield

Sneasler @ Focus Sash
Ability: Unburden
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Fake Out
- Coaching
- Dire Claw
- Protect`,
  expectations: {
    teamIdentities: ["doubles physical offense", "mixed-speed pressure"],
    criticalObservations: [
      "Aegislash uses Stance Change attacking stats and Sacred Sword ignores Archaludon's Stamina boosts.",
      "Last Respects is conditional on fainted allies rather than immediate full-power pressure.",
    ],
    forbiddenConclusions: [
      "Ranking a decaying physical multi-hit line over Sacred Sword from its neutral first hit alone.",
      "Treating Last Respects as immediately powered without fainted allies.",
    ],
  },
};

const cases: MatchupQaCase[] = [
  {
    id: "stamina-archaludon-aegislash",
    fixture: coachScraftyFixture,
    selectedSlot: 0,
    opponentText: `Archaludon @ Leftovers
Ability: Stamina
Level: 50
EVs: 32 HP / 1 Def / 29 SpD / 3 Spe
Bold Nature
- Electro Shot
- Flash Cannon
- Protect
- Dragon Pulse`,
    expectedMentionGroups: [
      ["Aegislash", "킬가르도"],
      ["Sacred Sword", "성스러운칼", "성칼"],
      ["Stamina", "지구력"],
    ],
    qualityChecks: [
      {
        id: "leads-with-aegislash-sacred-sword",
        passes: (output) => {
          const firstRecommendation = output.recommendations[0];
          const text = `${output.paragraphs[0] ?? ""} ${firstRecommendation?.title ?? ""} ${firstRecommendation?.reason ?? ""}`;
          return /Aegislash|킬가르도/i.test(text) &&
            /Sacred Sword|성스러운칼|성칼/i.test(text);
        },
      },
      {
        id: "keeps-last-respects-conditional",
        passes: (output) => {
          const text = JSON.stringify(output);
          if (!/Last Respects|성묘/i.test(text)) return true;
          return /faint|fallen|late.?game|기절|쓰러진|후반|조건/i.test(text);
        },
      },
    ],
    intent: "Prefer Stance Change Sacred Sword over physical lines weakened by Stamina and keep Last Respects conditional.",
  },
  {
    id: "existing-answer-garchomp",
    fixture: aiTeamDoublesFixtures.find(
      ({ id }) => id === "doubles-pokefeed-zardwile-tailroom",
    )!,
    selectedSlot: 3,
    opponentText: `Incineroar @ Sitrus Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 21 Def / 10 SpD / 3 Spe
Impish Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Throat Chop`,
    expectedMentionGroups: [["Garchomp", "한카리아스"]],
    qualityChecks: [
      {
        id: "leads-with-garchomp-over-recharge-line",
        passes: (output) => {
          const firstRecommendation = output.recommendations[0];
          const text = `${firstRecommendation?.title ?? ""} ${firstRecommendation?.reason ?? ""}`;
          return /Garchomp|\ud55c\uce74\ub9ac\uc544\uc2a4/i.test(text) &&
            !/Sylveon|Hyper Beam|\ub2d8\ud53c\uc544|\ud30c\uad34\uad11\uc120/i.test(text);
        },
      },
    ],
    intent: "Prefer the team's existing Garchomp answer over unnecessary tuning or roster changes.",
  },
  {
    id: "sand-team-gholdengo",
    fixture: aiTeamDoublesFixtures.find(
      ({ id }) => id === "doubles-boundary-self-weather",
    )!,
    selectedSlot: 1,
    opponentText: `Gholdengo @ Life Orb
Ability: Good as Gold
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Thunderbolt
- Protect`,
    expectedMentionGroups: [
      ["Tyranitar", "마기라스"],
      ["Garchomp", "한카리아스"],
    ],
    qualityChecks: [
      {
        id: "does-not-misapply-status-immunity",
        passes: (output) => !output.recommendations.some((recommendation) => {
          const text = `${recommendation.title} ${recommendation.reason}`;
          const namesAbility = /Good as Gold|\ud669\uae08\ubab8/i.test(text);
          const namesMove = /Fake Out|Coaching|\uc18d\uc774\uae30|\ucf54\uce6d/i.test(text);
          const claimsBlocked = /cannot|can't|blocked|immune|does not work|\ud1b5\ud558\uc9c0|\ub9c9|\uba74\uc5ed|\uc0ac\uc6a9\ud560 \uc218 \uc5c6/i.test(text);
          return namesAbility && namesMove && claimsBlocked;
        }),
      },
    ],
    intent: "Recognize existing sand-backed and Ground/Dark responses without forcing Tyranitar to overinvest in bulk.",
  },
  {
    id: "round-team-kingambit-gap",
    fixture: aiTeamStrategyFixtures.find(
      ({ id }) => id === "doubles-strategy-zoroark-round-chain",
    )!,
    selectedSlot: 0,
    opponentText: `Kingambit @ Black Glasses
Ability: Defiant
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect`,
    expectedMentionGroups: [["Kingambit", "대도각참"]],
    qualityChecks: [
      {
        id: "states-no-dependable-answer-first",
        passes: (output) => /no (?:dependable|reliable|clear) (?:direct )?answer|lacks? .{0,40} answer|\ud655\uc2e4\ud55c .{0,20}\uc5c6|\uc548\uc815\uc801\uc778 .{0,20}\uc5c6|\uc758\uc874\ud560 \ub9cc\ud55c .{0,20}\uc5c6/i.test(
          output.paragraphs[0] ?? "",
        ),
      },
      {
        id: "does-not-lead-with-doomed-dragapult-chip",
        passes: (output) => {
          const firstRecommendation = output.recommendations[0];
          const text = `${firstRecommendation?.title ?? ""} ${firstRecommendation?.reason ?? ""}`;
          return !/Dragapult|\ub4dc\ub798\ud384\ud2b8|Draco Meteor/i.test(text);
        },
      },
      {
        id: "does-not-recommend-ineffective-prankster-control",
        passes: (output) => !output.recommendations.some((recommendation) => {
          const text = `${recommendation.title} ${recommendation.reason}`;
          const namesSableye = /Sableye|깜까미/i.test(text);
          const namesBlockedMove = /Thunder Wave|Encore|전기자석파|앙코르/i.test(text);
          return namesSableye && namesBlockedMove;
        }),
      },
    ],
    intent: "Admit when the roster lacks a dependable direct answer and do not invent an unsupplied replacement Pokemon.",
  },
];

function createSide(
  member: TeamMember,
  buildState: TeamBuildState,
  slotIndex: number,
  pokemonIndex: Awaited<ReturnType<typeof fetchPokemonIndex>>,
): CalculatorAnalysisSide {
  const snapshot = getPokemonBuildSnapshot(member, buildState, slotIndex);
  const build = {
    item: snapshot.item,
    ability: snapshot.ability,
    natureId: snapshot.nature,
    evs: snapshot.evs,
    moveIds: snapshot.moveIds,
  };
  const maxHp = getCalculatorMaxHp(member, build);
  const megaMember = createProjectedMegaMember(
    member,
    build.item,
    pokemonIndex,
  );
  const megaAbility = megaMember?.abilities?.[0];

  return {
    member,
    build,
    battle: createCalculatorBattleState(maxHp),
    moves: getCalculatorMoveSlots(member, build.moveIds),
    maxHp,
    megaEvolution: megaMember && megaAbility
      ? { member: megaMember, ability: megaAbility }
      : undefined,
  };
}

async function createRequest(
  qaCase: MatchupQaCase,
  resources: Awaited<ReturnType<typeof loadResources>>,
) {
  const services = { fetchPokemon, fetchItem };
  const [teamSnapshot, opponentSnapshot] = await Promise.all([
    buildImportedShowdownSnapshot(qaCase.fixture.showdownText, {
      pokemonIndex: resources.pokemonIndex,
      services,
    }),
    buildImportedShowdownSnapshot(qaCase.opponentText, {
      pokemonIndex: resources.pokemonIndex,
      services,
    }),
  ]);
  const selectedMember = teamSnapshot.members[qaCase.selectedSlot];
  const opponentMember = opponentSnapshot.members[0];
  if (!selectedMember || !opponentMember) {
    throw new Error(`${qaCase.id} could not hydrate its selected Pokemon.`);
  }

  const player = createSide(
    selectedMember,
    teamSnapshot.buildState,
    qaCase.selectedSlot,
    resources.pokemonIndex,
  );
  const opponent = createSide(
    opponentMember,
    opponentSnapshot.buildState,
    0,
    resources.pokemonIndex,
  );
  const roster = teamSnapshot.members.flatMap((member, slotIndex) =>
    member
      ? [{
          ...createSide(
            member,
            teamSnapshot.buildState,
            slotIndex,
            resources.pokemonIndex,
          ),
          slotIndex,
        }]
      : [],
  );
  const automaticEnvironment = resolveAutomaticEnvironment({
    player: {
      identity: selectedMember.id,
      ability: player.build.ability,
      speed: getCalculatorSpeed(selectedMember, player.build, 0),
    },
    opponent: {
      identity: opponentMember.id,
      ability: opponent.build.ability,
      speed: getCalculatorSpeed(opponentMember, opponent.build, 0),
    },
  });
  const calculatorContext: CalculatorAnalysisContext = {
    battleFormat: qaCase.fixture.battleFormat,
    selectedSlot: qaCase.selectedSlot,
    direction: "player-to-opponent",
    player,
    opponent,
    roster,
    field: {
      ...createDefaultCalculatorField(qaCase.fixture.battleFormat),
      ...automaticEnvironment,
    },
  };
  const { diagnostics, validity } = createTeamAnalysisContext({
    team: teamSnapshot.members,
    buildState: teamSnapshot.buildState,
    moveSources: teamSnapshot.members.filter(
      (member): member is TeamMember => Boolean(member),
    ),
    legality: resources.legality,
    pokemonIndex: resources.pokemonIndex,
    itemIndex: resources.itemIndex,
  });
  const plans = createTeamMatchupAnalysisPlans(calculatorContext);
  const request = createCopilotAnalysisRequest({
    scope: "matchup",
    locale: "ko",
    battleFormat: qaCase.fixture.battleFormat,
    teamName: qaCase.fixture.title,
    team: teamSnapshot.members,
    pokemonIndex: resources.pokemonIndex,
    abilityIndex: resources.abilityIndex,
    selectedSlot: qaCase.selectedSlot,
    buildState: teamSnapshot.buildState,
    diagnostics,
    validity,
    calculatorContext,
    optimizationPlan: plans.optimizationPlan,
    matchupPlan: plans.matchupPlan,
  });
  const exactMatchup = request.matchup?.mode === "exact"
    ? request.matchup
    : null;
  const validation = validateCopilotAnalysisRequest(request);
  if (!validation.success) {
    throw new Error(
      `${qaCase.id} request invalid: ${validation.errors.join(" ")}\n` +
      JSON.stringify({
        megaOptions: request.megaOptions,
        matchupMembers: exactMatchup?.members.map((member) => ({
          slotIndex: member.slotIndex,
          pokemonId: member.pokemonId,
          state: member.state,
        })),
      }, null, 2),
    );
  }
  return request;
}

async function loadResources() {
  const [pokemonIndex, itemIndex, abilityIndex, legality] = await Promise.all([
    fetchPokemonIndex(),
    fetchItemIndex(),
    fetchAbilityIndex(),
    loadShowdownLegality(),
  ]);
  return { pokemonIndex, itemIndex, abilityIndex, legality };
}

async function main() {
  const prepareOnly = process.argv.includes("--prepare-only");
  const selectedCaseId = process.argv
    .find((argument) => argument.startsWith("--case="))
    ?.slice("--case=".length);
  const selectedCases = selectedCaseId
    ? cases.filter(({ id }) => id === selectedCaseId)
    : cases;
  if (selectedCases.length === 0) {
    throw new Error(`Unknown matchup QA case: ${selectedCaseId}`);
  }
  const restoreRuntime = installAiEvaluationRuntime(projectRoot);

  try {
    console.log("Loading production data for matchup QA...");
    const resources = await loadResources();
    if (prepareOnly) {
      for (const qaCase of selectedCases) {
        const request = await createRequest(qaCase, resources);
        const exactMatchup = request.matchup?.mode === "exact"
          ? request.matchup
          : null;
        console.log(JSON.stringify({
          id: qaCase.id,
          opponent: exactMatchup?.opponent.displayName,
          optimizationCandidates: request.optimization?.candidates.map(
            ({ id }) => id,
          ) ?? [],
          members: exactMatchup?.members.map((member) => ({
            pokemon: member.displayName,
            tier: member.responseTier,
            moves: member.offenseBenchmarks.map((benchmark) => ({
              move: benchmark.moveDisplayName,
              source: benchmark.source,
              requiresRecharge: benchmark.requiresRecharge,
              possibleActionTurns: benchmark.possibleActionTurns,
              guaranteedActionTurns: benchmark.guaranteedActionTurns,
              sequence: benchmark.persistentSequence
                ? {
                    possibleKoHits:
                      benchmark.persistentSequence.possibleKoHits,
                    guaranteedKoHits:
                      benchmark.persistentSequence.guaranteedKoHits,
                    boostAffectedDamage:
                      benchmark.persistentSequence.boostAffectedDamage,
                  }
                : null,
            })),
          })),
        }, null, 2));
      }
      return;
    }

    const apiKey = resolveOpenAiApiKey(projectRoot);
    if (!apiKey) throw new Error("OPENAI_API_KEY is unavailable.");
    const adapter = createOpenAiLunaAdapter({ apiKey, reasoningEffort: "low" });
    const results = [];

    for (const [index, qaCase] of selectedCases.entries()) {
      console.log(`Running ${index + 1}/${selectedCases.length}: ${qaCase.id}`);
      const request = await createRequest(qaCase, resources);
      const startedAt = performance.now();
      const result = await adapter.analyze(request);
      const output = result.output as CopilotAnalysisResponse | null;
      const outputText = output
        ? JSON.stringify(output)
        : "";
      const userFacingOutputText = output
        ? [
            ...output.paragraphs,
            ...output.recommendations.flatMap(({ title, reason }) => [
              title,
              reason,
            ]),
          ].join(" ")
        : "";
      const failedQualityChecks = output
        ? [
            ...(qaCase.qualityChecks ?? [])
              .filter((check) => !check.passes(output))
              .map((check) => check.id),
            ...(/\bset-[a-z0-9]+(?:-[a-z0-9]+){2,}\b/i.test(userFacingOutputText)
              ? ["does-not-expose-candidate-id"]
              : []),
          ]
        : [];
      results.push({
        id: qaCase.id,
        intent: qaCase.intent,
        expectedMentionGroups: qaCase.expectedMentionGroups,
        missingExpectedMentionGroups: qaCase.expectedMentionGroups.filter(
          (alternatives) => !alternatives.some((name) => outputText.includes(name)),
        ),
        failedQualityChecks,
        durationMs: Math.round(performance.now() - startedAt),
        usage: result.usage,
        validationErrors: result.validationErrors ?? [],
        output,
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDirectory = resolve(projectRoot, "artifacts", "ai-evaluation");
    const outputPath = resolve(
      outputDirectory,
      `matchup-qa-low-${timestamp}.json`,
    );
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify({
      model: adapter.modelId,
      reasoningEffort: "low",
      results,
    }, null, 2)}\n`);

    for (const result of results) {
      console.log(`\n[${result.id}]`);
      console.log(JSON.stringify({
        durationMs: result.durationMs,
        usage: result.usage,
        missingExpectedMentionGroups: result.missingExpectedMentionGroups,
        failedQualityChecks: result.failedQualityChecks,
        validationErrors: result.validationErrors,
        output: result.output,
      }, null, 2));
    }
    console.log(`\nReport: ${outputPath}`);
    if (results.some((result) =>
      result.validationErrors.length > 0 ||
      result.missingExpectedMentionGroups.length > 0 ||
      result.failedQualityChecks.length > 0
    )) {
      process.exitCode = 1;
    }
  } finally {
    restoreRuntime();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
