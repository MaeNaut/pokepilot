import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { fetchPokemonIndex } from "../src/api/pokemonIndex";
import {
  fetchAbilityIndex,
  fetchItemIndex,
} from "../src/api/showdownCatalog";
import { loadShowdownData } from "../src/api/showdownData";
import { loadShowdownLegality } from "../src/api/showdownLegality";
import { loadSmogonUsageSets } from "../src/api/smogonUsage";
import {
  createMetaThreatAnalysisInput,
  createMetaThreatAnalysisPlan,
} from "../src/calculator/metaThreatAnalysis";
import { aiTeamDoublesFixtures } from "../src/test/fixtures/aiTeamFixtures";
import { createAiFixtureAnalysisContext } from "../src/test/evaluation/aiModelEvaluation";
import { createCopilotAnalysisRequest } from "../src/utils/copilotRequestBuilder";
import {
  createPokemonRecommendationOptions,
  createPokemonRecommendationTargets,
  rankUniversalPokemonRecommendationCandidates,
} from "../src/utils/pokemonRecommendations";
import { selectMetaThreatReplacementCandidates } from "../src/utils/metaThreatRecommendations";
import { validateCopilotAnalysisRequest } from "../src/utils/copilotRequestContract";
import { serializePokePilotModelRequest } from "../server/pokepilotModelInput";
import { resolveOpenAiApiKey } from "../server/openAiEnvironment";
import { createOpenAiLunaAdapter } from "../src/test/evaluation/openAiLunaAdapter";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

async function main() {
  const restoreRuntime = installAiEvaluationRuntime(projectRoot);
  try {
    const requestedFixtureId = process.argv
      .find((argument) => argument.startsWith("--fixture="))
      ?.slice("--fixture=".length);
    const fixture = requestedFixtureId
      ? aiTeamDoublesFixtures.find(({ id }) => id === requestedFixtureId)
      : aiTeamDoublesFixtures[0];
    if (!fixture) {
      throw new Error(`Unknown doubles fixture: ${requestedFixtureId}`);
    }
    const [pokemonIndex, itemIndex, abilityIndex, legality] = await Promise.all([
      fetchPokemonIndex(),
      fetchItemIndex(),
      fetchAbilityIndex(),
      loadShowdownLegality(),
    ]);
    const { team, buildState, diagnostics, validity } =
      await createAiFixtureAnalysisContext(fixture, {
        pokemonIndex,
        itemIndex,
        abilityIndex,
        legality,
      });
    const [usageSets, showdownData] = await Promise.all([
      loadSmogonUsageSets(fixture.battleFormat),
      loadShowdownData(),
    ]);
    const inputStartedAt = performance.now();
    const input = createMetaThreatAnalysisInput({
      battleFormat: fixture.battleFormat,
      team,
      buildState,
      pokemonIndex,
      itemIndex,
      usageSets,
      showdownData,
    });
    const planStartedAt = performance.now();
    const plan = createMetaThreatAnalysisPlan(input);
    const completedAt = performance.now();
    if (plan.status !== "ready") {
      throw new Error(`Meta threat plan unavailable: ${plan.reason}`);
    }
    const replacementStartedAt = performance.now();
    const recommendationOptions = createPokemonRecommendationOptions({
      pokemonIndex,
      abilityIndex,
      legality,
      getPokemonDisplayName: (entry) => entry.displayName,
      getTypeDisplayName: (type) => type,
      getAbilityDisplayName: (_id, fallback) => fallback,
    });
    const recommendationTargets = createPokemonRecommendationTargets({
      team,
      selectedSlot: Math.max(0, team.findIndex(Boolean)),
      buildState,
      diagnostics,
      pokemonIndex,
      getCurrentPokemonDisplayName: (member, entry) =>
        entry?.displayName ?? member.name,
    });
    const rankedReplacementCandidates =
      rankUniversalPokemonRecommendationCandidates({
        options: recommendationOptions,
        targets: recommendationTargets,
        usageIds: usageSets.map(({ pokemonId }) => pokemonId),
        usageSets,
        showdownData,
        limit: 60,
      });
    const replacementCandidates = selectMetaThreatReplacementCandidates({
      plan,
      candidates: rankedReplacementCandidates,
      usageSets,
      showdownData,
      itemIndex,
    });
    const replacementCompletedAt = performance.now();
    const selectedSlot = Math.max(0, team.findIndex(Boolean));
    const request = createCopilotAnalysisRequest({
      scope: "matchup",
      locale: "en",
      battleFormat: fixture.battleFormat,
      teamName: fixture.title,
      team,
      pokemonIndex,
      abilityIndex,
      selectedSlot,
      buildState,
      diagnostics,
      validity,
      optimizationPlan: null,
      threatPlan: plan,
      threatReplacementCandidates: replacementCandidates,
    });
    const baseRequest = createCopilotAnalysisRequest({
      scope: "team",
      locale: "en",
      battleFormat: fixture.battleFormat,
      teamName: fixture.title,
      team,
      pokemonIndex,
      abilityIndex,
      selectedSlot,
      buildState,
      diagnostics,
      validity,
    });
    const requestWithoutOptimization = createCopilotAnalysisRequest({
      scope: "matchup",
      locale: "en",
      battleFormat: fixture.battleFormat,
      teamName: fixture.title,
      team,
      pokemonIndex,
      abilityIndex,
      selectedSlot,
      buildState,
      diagnostics,
      validity,
      optimizationPlan: null,
      threatPlan: {
        ...plan,
        optimizationContext: null,
        optimizationPlan: null,
      },
      threatReplacementCandidates: replacementCandidates,
    });
    const requestWithoutInterventions = createCopilotAnalysisRequest({
      scope: "matchup",
      locale: "en",
      battleFormat: fixture.battleFormat,
      teamName: fixture.title,
      team,
      pokemonIndex,
      abilityIndex,
      selectedSlot,
      buildState,
      diagnostics,
      validity,
      optimizationPlan: null,
      threatPlan: {
        ...plan,
        optimizationContext: null,
        optimizationPlan: null,
      },
      threatReplacementCandidates: [],
    });
    const validation = validateCopilotAnalysisRequest(request);
    if (!validation.success) {
      throw new Error(`${validation.errors.join(" ")}\n${JSON.stringify({
        replacements: request.recommendationCandidates.map((candidate) => ({
          id: candidate.pokemonId,
          slot: candidate.target.slotIndex,
        })),
        evidence: request.matchup?.mode === "meta"
          ? request.matchup.replacementEvidence
          : [],
      }, null, 2)}`);
    }
    const serializedRequest = serializePokePilotModelRequest(request);
    const runAi = process.argv.includes("--ai");
    const aiResult = runAi
      ? await createOpenAiLunaAdapter({
          apiKey: resolveOpenAiApiKey(projectRoot),
          reasoningEffort: "low",
        }).analyze(request)
      : null;

    console.log(JSON.stringify({
      fixture: fixture.id,
      usageCandidates: input.candidates.length,
      evaluatedThreats: plan.evaluatedThreatCount,
      inputPreparationMs: Math.round((planStartedAt - inputStartedAt) * 10) / 10,
      calculationMs: Math.round((completedAt - planStartedAt) * 10) / 10,
      replacementCalculationMs:
        Math.round((replacementCompletedAt - replacementStartedAt) * 10) / 10,
      requestCharacters: JSON.stringify(request).length,
      modelInputCharacters: serializedRequest.text.length,
      modelInputCharactersWithoutOptimization:
        serializePokePilotModelRequest(requestWithoutOptimization).text.length,
      modelInputCharactersWithoutInterventions:
        serializePokePilotModelRequest(requestWithoutInterventions).text.length,
      baseTeamModelInputCharacters:
        serializePokePilotModelRequest(baseRequest).text.length,
      optimization: request.optimization
        ? {
            player: request.optimization.playerDisplayName,
            opponent: request.optimization.opponentDisplayName,
            candidateCount: request.optimization.candidates.length,
            candidates: request.optimization.candidates.map((candidate) => ({
              id: candidate.id,
              nature: candidate.natureDisplayName,
              item: candidate.itemDisplayName,
              moves: candidate.moveChanges.map(
                (change) => change.optimizedMoveDisplayName,
              ),
            })),
          }
        : null,
      replacements: replacementCandidates.map(({ candidate, threatDisplayName, member }) => ({
        pokemon: candidate.displayName,
        replaces: candidate.target.currentDisplayName,
        threat: threatDisplayName,
        tier: member.responseTier,
        move: member.offenseBenchmarks[0]?.moveName ?? null,
      })),
      screenedReplacementCount: rankedReplacementCandidates.length,
      ...(aiResult
        ? {
            ai: {
              output: aiResult.output,
              validationErrors: aiResult.validationErrors,
              usage: aiResult.usage,
              responseMetadata: aiResult.responseMetadata,
            },
          }
        : {}),
      threats: plan.threats.map((threat) => ({
        usageRank: threat.usageRank,
        pokemon: threat.matchup.opponentName,
        riskSignals: threat.riskSignals,
        responses: threat.matchup.members.slice(0, 3).map((member) => ({
          pokemon: member.pokemonName,
          tier: member.responseTier,
          move: member.offenseBenchmarks[0]?.moveName ?? null,
        })),
      })),
    }, null, 2));
  } finally {
    restoreRuntime();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
