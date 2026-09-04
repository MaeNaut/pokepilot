import { describe, expect, it, vi } from "vitest";
import { normalizeShowdownId } from "../../api/showdownIds";
import type { CopilotAnalysisRequest } from "../../utils/copilotAnalysis";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  PokemonItem,
  PokemonMove,
  StatBlock,
  TeamMember,
} from "../../types";
import { parseShowdownTeam, toPokemonId } from "../../utils/showdownText";
import {
  resolveImportedPokemonId,
  type ShowdownImportServices,
} from "../../utils/showdownImport";
import { validateCopilotModelOutput } from "../../utils/copilotModelContract";
import { validateCopilotAnalysisRequest } from "../../utils/copilotRequestContract";
import { aiTeamFixtures } from "../fixtures/aiTeamFixtures";
import type { AiTeamFixture } from "../fixtures/aiTeamFixtureTypes";
import {
  createAiEvaluationModelInput,
  createAiPokemonEvaluationCase,
  createAiPokemonRecommendationEvaluationCase,
  createAiTeamEvaluationCase,
  getMissingExpectedRecommendationIds,
  runAiTeamEvaluationCase,
  type AiEvaluationModelAdapter,
} from "./aiModelEvaluation";

const baseStats: StatBlock = {
  hp: 100,
  attack: 100,
  defense: 100,
  specialAttack: 100,
  specialDefense: 100,
  speed: 100,
};

function createMove(name: string): PokemonMove {
  return {
    id: normalizeShowdownId(name),
    name,
    type: "normal",
    category: "Physical",
    power: 80,
    accuracy: 100,
    pp: 10,
    description: "",
  };
}

function createFixtureDependencies(fixture: AiTeamFixture) {
  const parsedTeam = parseShowdownTeam(fixture.showdownText);
  const pokemonIndex: PokemonIndexEntry[] = parsedTeam.map(
    (pokemon, index) => ({
      name: toPokemonId(pokemon.pokemonName),
      showdownId: normalizeShowdownId(pokemon.pokemonName),
      displayName: pokemon.pokemonName,
      speciesKey: toPokemonId(pokemon.pokemonName),
      sortNumber: index + 1,
      types: ["normal"],
      abilities: pokemon.ability ? [pokemon.ability] : [],
      formKind: "base",
      isSelectorOption: true,
    }),
  );
  const members = new Map<string, TeamMember>();

  parsedTeam.forEach((pokemon) => {
    const pokemonId = resolveImportedPokemonId(
      pokemon.pokemonName,
      pokemonIndex,
      pokemon.gender,
    );

    members.set(pokemonId, {
      id: pokemonId,
      name: pokemon.pokemonName,
      showdownId: normalizeShowdownId(pokemon.pokemonName),
      showdownName: pokemon.pokemonName,
      ...(pokemon.gender ? { showdownGender: pokemon.gender } : {}),
      types: ["normal"],
      roles: [],
      baseStats,
      abilities: pokemon.ability ? [pokemon.ability] : [],
      moves: pokemon.moves.map(createMove),
      source: "showdown",
    });
  });

  const itemNames = parsedTeam.flatMap((pokemon) =>
    pokemon.itemName ? [pokemon.itemName] : [],
  );
  const items = new Map<string, PokemonItem>(
    itemNames.map((name) => [
      normalizeShowdownId(name),
      {
        id: normalizeShowdownId(name),
        showdownId: normalizeShowdownId(name),
        name,
      },
    ]),
  );
  const itemIndex: ItemIndexEntry[] = itemNames.map((name, index) => ({
    id: index + 1,
    name,
    showdownId: normalizeShowdownId(name),
    displayName: name,
    isMegaStone: false,
  }));
  const services: ShowdownImportServices = {
    fetchPokemon: async (pokemonId) => {
      const member = members.get(pokemonId);

      if (!member) {
        throw new Error(`Missing test Pokemon ${pokemonId}.`);
      }

      return member;
    },
    fetchItem: async (itemId) => {
      const item = items.get(itemId);

      if (!item) {
        throw new Error(`Missing test item ${itemId}.`);
      }

      return item;
    },
  };

  return {
    pokemonIndex,
    itemIndex,
    legality: null,
    services,
  };
}

function collectObjectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectObjectKeys(entry, keys));
    return keys;
  }

  if (typeof value !== "object" || value === null) {
    return keys;
  }

  for (const [key, entry] of Object.entries(value)) {
    keys.add(key);
    collectObjectKeys(entry, keys);
  }

  return keys;
}

const validModelOutput = {
  version: 1 as const,
  scope: "team" as const,
  title: "Evaluation",
  summary: "Summary",
  playstyle: "Balanced",
  strengths: ["Strength"],
  weaknesses: ["Weakness"],
  recommendations: [
    {
      id: "recommendation-1",
      title: "Recommendation",
      reason: "Reason",
      priority: "medium" as const,
    },
  ],
};

describe("AI model evaluation request parity", () => {
  it("builds every fixture through the production import and analysis contracts", async () => {
    for (const fixture of aiTeamFixtures) {
      const evaluationCase = await createAiTeamEvaluationCase(
        fixture,
        createFixtureDependencies(fixture),
      );
      const modelInput = createAiEvaluationModelInput(evaluationCase);
      const modelInputKeys = collectObjectKeys(modelInput);

      expect(modelInput, fixture.id).toEqual(evaluationCase.request);
      expect(
        validateCopilotAnalysisRequest(modelInput).errors,
        fixture.id,
      ).toEqual([]);
      expect(modelInput, fixture.id).not.toBe(evaluationCase.request);
      expect(modelInput.battleFormat, fixture.id).toBe(fixture.battleFormat);
      expect(modelInput.sets, fixture.id).toHaveLength(6);
      expect(modelInput.diagnostics.filledSlots, fixture.id).toBe(6);
      expect(modelInputKeys, fixture.id).not.toContain("source");
      expect(modelInputKeys, fixture.id).not.toContain("showdownText");
      expect(modelInputKeys, fixture.id).not.toContain("expectations");
      expect(modelInputKeys, fixture.id).not.toContain("forbiddenConclusions");
      expect(evaluationCase.evaluatorContext.expectations, fixture.id).toEqual(
        fixture.expectations,
      );
    }
  });

  it("passes only the provider-independent request to a model adapter", async () => {
    const fixture = aiTeamFixtures[0];
    const evaluationCase = await createAiTeamEvaluationCase(
      fixture,
      createFixtureDependencies(fixture),
    );
    let receivedInput: Readonly<CopilotAnalysisRequest> | null = null;
    const analyze = vi.fn(
      async (request: Readonly<CopilotAnalysisRequest>) => {
        receivedInput = request;
        return {
          output: validModelOutput,
          usage: {
            inputTokens: 1_000,
            cachedInputTokens: 800,
            outputTokens: 300,
            costUsd: 0.001,
          },
        };
      },
    );
    const adapter: AiEvaluationModelAdapter = {
      modelId: "test-model",
      analyze,
    };
    const result = await runAiTeamEvaluationCase(evaluationCase, adapter);

    expect(receivedInput).toEqual(evaluationCase.request);
    expect(collectObjectKeys(receivedInput)).not.toContain("expectations");
    expect(result).toMatchObject({
      fixtureId: fixture.id,
      modelId: "test-model",
      status: "complete",
      output: validModelOutput,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 800,
        outputTokens: 300,
        costUsd: 0.001,
      },
    });
  });

  it("derives a Pokemon-scope case from the same production team fixture", async () => {
    const fixture = aiTeamFixtures[0];
    const evaluationCase = await createAiPokemonEvaluationCase(
      fixture,
      2,
      createFixtureDependencies(fixture),
    );

    expect(evaluationCase.request.scope).toBe("pokemon");
    expect(evaluationCase.request.selectedSlot).toBe(2);
    expect(evaluationCase.request.sets).toHaveLength(6);
    expect(validateCopilotAnalysisRequest(evaluationCase.request).errors).toEqual(
      [],
    );
    expect(evaluationCase.fixtureId).toBe(`${fixture.id}-pokemon-2`);
    expect(evaluationCase.requestFingerprint).not.toContain(
      evaluationCase.request.teamName,
    );
  });

  it("keeps Pokemon regression expectations outside the model request", async () => {
    const fixture = aiTeamFixtures[0];
    const expectations = {
      teamIdentities: ["Selected-set focus"],
      criticalObservations: ["Exact configured interaction"],
      forbiddenConclusions: ["Invented interaction"],
    };
    const evaluationCase = await createAiPokemonEvaluationCase(
      fixture,
      2,
      createFixtureDependencies(fixture),
      {
        fixtureId: "pokemon-regression",
        title: "Pokemon Regression",
        expectations,
      },
    );

    expect(evaluationCase.fixtureId).toBe("pokemon-regression");
    expect(evaluationCase.title).toBe("Pokemon Regression");
    expect(evaluationCase.evaluatorContext.expectations).toEqual(expectations);
    expect(collectObjectKeys(evaluationCase.request)).not.toContain(
      "criticalObservations",
    );
  });

  it("builds recommendation cases from a genuinely empty production slot", async () => {
    const fixture = aiTeamFixtures[0];
    const dependencies = createFixtureDependencies(fixture);
    const removedPokemon = parseShowdownTeam(fixture.showdownText)[0];
    const removedPokemonId = toPokemonId(removedPokemon.pokemonName);
    const evaluationCase = await createAiPokemonRecommendationEvaluationCase(
      fixture,
      0,
      {
        ...dependencies,
        createRecommendationCandidates: async ({ options, occupiedSpeciesKeys }) => {
          const option = options.find((candidate) => candidate.id === removedPokemonId);

          expect(option).toBeDefined();
          expect(occupiedSpeciesKeys.has(option?.speciesKey ?? "")).toBe(false);

          return [
            {
              pokemonId: option?.id ?? removedPokemonId,
              displayName: option?.displayName ?? removedPokemon.pokemonName,
              types: option?.types ?? ["normal"],
              typeDisplayNames: option?.typeDisplayNames ?? ["Normal"],
              abilities: option?.abilities ?? [],
              baseStats: null,
              speedTier: "unknown",
              requiresMegaStone: false,
              usageRank: 1,
              commonSet: null,
              responsibilityIds: [],
              fit: {
                weakTo: [],
                resistsTeamThreats: [],
                amplifiesTeamThreats: [],
                addsUnansweredWeaknesses: [],
                coversTypes: [],
                roleContributions: [],
                roleRedundancies: [],
                conceptSynergies: [],
                conflicts: [],
              },
            },
          ];
        },
      },
      {
        fixtureId: "recommendation-regression",
        expectations: {
          teamIdentities: ["Empty-slot fit"],
          criticalObservations: ["Use supplied candidates"],
          forbiddenConclusions: ["Inventing candidates"],
        },
      },
    );

    expect(evaluationCase.fixtureId).toBe("recommendation-regression");
    expect(evaluationCase.request.scope).toBe("recommendation");
    expect(evaluationCase.request.selectedSlot).toBe(0);
    expect(evaluationCase.request.sets).toHaveLength(5);
    expect(
      evaluationCase.request.sets.some((set) => set.pokemonId === removedPokemonId),
    ).toBe(false);
    expect(evaluationCase.request.recommendationCandidates).toHaveLength(1);
    expect(validateCopilotAnalysisRequest(evaluationCase.request).errors).toEqual(
      [],
    );
    expect(evaluationCase.request.recommendationCandidates[0]?.pokemonId).toBe(
      removedPokemonId,
    );
    expect(collectObjectKeys(evaluationCase.request)).not.toContain(
      "forbiddenConclusions",
    );
  });
});

describe("AI model output validation", () => {
  it("reports missing evaluator-only recommendation baselines", () => {
    expect(
      getMissingExpectedRecommendationIds(
        {
          ...validModelOutput,
          scope: "recommendation",
          recommendations: [
            {
              id: "pelipper",
              title: "Pelipper",
              reason: "Rain support.",
              priority: "high",
            },
          ],
        },
        ["pelipper", "farigiraf"],
      ),
    ).toEqual(["farigiraf"]);
  });

  it("accepts the versioned structured analysis contract", () => {
    expect(validateCopilotModelOutput(validModelOutput)).toEqual({
      success: true,
      data: validModelOutput,
      errors: [],
    });
  });

  it("rejects malformed or evaluator-authored output before recording it", async () => {
    const fixture = aiTeamFixtures[0];
    const evaluationCase = await createAiTeamEvaluationCase(
      fixture,
      createFixtureDependencies(fixture),
    );
    const result = await runAiTeamEvaluationCase(evaluationCase, {
      modelId: "invalid-test-model",
      analyze: async () => ({
        output: {
          ...validModelOutput,
          source: fixture.source,
          recommendations: [{ title: "Missing required fields" }],
        },
      }),
    });

    expect(result.status).toBe("invalid-output");
    expect(result.output).toBeNull();
    expect(result.validationErrors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Unexpected output fields"),
        expect.stringContaining("recommendations[0].id"),
      ]),
    );
  });
});
