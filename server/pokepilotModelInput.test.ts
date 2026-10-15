import { describe, expect, it } from "vitest";
import { defaultEvs } from "../src/data/natures";
import type { CopilotAnalysisRequest, CopilotSetOptimizationCandidateSnapshot } from "../src/utils/copilotContracts";
import { createCopilotAnalysisRequest } from "../src/utils/copilotRequestBuilder";
import { createEmptyBuildState } from "../src/utils/teamBuildState";
import { createTeamAnalysisContext } from "../src/utils/teamAnalysisContext";
import { createDefaultCalculatorField } from "../src/calculator/calculatorViewModel";
import { serializePokePilotModelRequest } from "./pokepilotModelInput";

function createRequest(scope: CopilotAnalysisRequest["scope"] = "team") {
  const team = Array.from({ length: 6 }, (_, index) => ({
    id: `pokemon${index}`, name: `Pokemon ${index}`, types: ["normal" as const],
    abilities: [], roles: [], moves: [{
      id: "protect", name: "Protect", type: "normal" as const,
      category: "Status", power: null, accuracy: null, pp: 10,
      description: "Protects the user from most attacks this turn. Consecutive use can fail.",
    }],
  }));
  const buildState = createEmptyBuildState();
  team.forEach((_, index) => { buildState.moveIdsBySlot[index] = ["protect"]; });
  return createCopilotAnalysisRequest({
    scope, team, buildState, teamName: "Shared records QA", selectedSlot: 0,
    ...createTeamAnalysisContext({ team, buildState, legality: null, pokemonIndex: [], itemIndex: [] }),
  });
}

const damage = {
  minDamage: 100, maxDamage: 118, minPercent: 50, maxPercent: 59,
  defenderCurrentHp: 200, defenderMaxHp: 200, oneHitKoChance: 0,
  koHits: 2, koChance: 1, possibleKoHits: 2, guaranteedKoHits: 2,
};
const speed = { playerSpeed: 80, opponentSpeed: 100, relation: "slower" as const };

function sampleCandidate(index: number): CopilotSetOptimizationCandidateSnapshot {
  const benchmark = {
    moveId: "bugbite", moveDisplayName: "Bug Bite", currentMoveId: "bugbite",
    currentMoveDisplayName: "Bug Bite", moveCategory: "Physical" as const,
    source: "selected" as const, relevantStat: "defense" as const,
    optimizedVsCurrent: "same" as const, current: { ...damage }, optimized: { ...damage },
  };
  return {
    id: `candidate${index}`, slotIndex: 0, focuses: ["defense"], profiles: [],
    maxedStats: [], natureId: "serious", natureDisplayName: "Serious",
    evs: { ...defaultEvs }, evTotal: 0, finalStats: { ...defaultEvs },
    itemId: null, itemDisplayName: null, itemChanged: false, moveIds: ["protect"],
    moveChanges: [], changedStatPoints: 0, statPointChanges: { ...defaultEvs },
    offenseBenchmarks: [{ ...benchmark, relevantStat: "attack" }],
    defenseBenchmarks: [benchmark],
    speedBenchmark: { current: { ...speed }, optimized: { ...speed } },
    generalEvidence: {
      source: "matchup",
      variant: "matchup",
      roleStats: [],
      reducedRoleStats: [],
    },
  };
}

function createSampleRequest() {
  const request = createRequest("optimization");
  request.optimization = {
    mode: "matchup",
    slotIndex: 0, configuredDirection: "opponent-to-player",
    playerPokemonId: "farigiraf", playerDisplayName: "Farigiraf",
    opponentPokemonId: "scizor", opponentDisplayName: "Scizor",
    field: createDefaultCalculatorField("doubles"),
    currentBuild: { natureId: "serious", natureDisplayName: "Serious",
      evs: { ...defaultEvs }, finalStats: { ...defaultEvs },
      itemId: null, itemDisplayName: null, moveIds: ["protect"] },
    moveMechanics: [], itemMechanics: [], candidates: Array.from({ length: 12 }, (_, i) => sampleCandidate(i)),
  };
  return request;
}

function expandModelInput(text: string, stripOwnerMechanics = true): unknown {
  const { sharedData = {}, ...request } = JSON.parse(text);
  function expand(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(expand);
    if (value !== null && typeof value === "object") {
      if ("dataRef" in value) {
        expect(Object.keys(value)).toEqual(["dataRef"]);
        const entry = sharedData[String(value.dataRef)];
        expect(entry).toBeDefined();
        expect(entry).not.toHaveProperty("dataRef");
        return entry;
      }
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, expand(entry)]));
    }
    return value;
  }
  const expanded = expand(request) as { sets: Array<Record<string, unknown>> };
  if (stripOwnerMechanics) {
    for (const set of expanded.sets) {
      delete set.mechanics;
      if (set.megaEvolution && typeof set.megaEvolution === "object") {
        delete (set.megaEvolution as Record<string, unknown>).mechanics;
      }
    }
  }
  return expanded;
}

describe("model input sharing", () => {
  it.each(["team", "pokemon", "recommendation", "optimization", "matchup"] as const)("uses the same owner links for the %s scope", scope => {
    const request = createRequest(scope);
    const result = serializePokePilotModelRequest(request);
    const expanded = expandModelInput(result.text, false) as { sets: Array<Record<string, unknown>> };
    expect(result.instructions).toContain("set.mechanics");
    expect(expanded.sets.every(set => "mechanics" in set)).toBe(true);
    expect(expandModelInput(result.text)).toEqual(request);
  });

  it("binds only selected mechanics to their current and projected owners using shared records", () => {
    const request = createRequest();
    const set = request.sets[0];
    set.ability = "Intimidate";
    set.item = "Choice Scarf";
    set.megaEvolution = {
      pokemonId: "test-mega", pokemonName: "Test Mega", displayName: "Test Mega",
      types: ["flying"], typeDisplayNames: ["Flying"], ability: "Aerilate",
      abilityDisplayName: "Aerilate", baseStats: { ...defaultEvs },
      stats: { ...defaultEvs }, defensiveProfile: set.defensiveProfile,
    };
    request.mechanics.abilities = [
      { id: "intimidate", displayName: "Intimidate", effect: "Lowers opposing Attack." },
      { id: "aerilate", displayName: "Aerilate", effect: "Normal moves become Flying and gain 1.2x power." },
    ];
    request.mechanics.items = [{ id: "choicescarf", displayName: "Choice Scarf", effect: "Speed is 1.5x." }];
    request.mechanics.moves.push({ id: "round", displayName: "Round", effect: "Boosts later users." });
    const original = JSON.stringify(request);
    const result = serializePokePilotModelRequest(request);
    const expanded = expandModelInput(result.text, false) as {
      sets: Array<{ mechanics: { moves: Array<{ id: string }>; ability: { id: string }; item: { id: string } };
        megaEvolution: { mechanics: { ability: { id: string } } } }>;
    };
    expect(expanded.sets[0].mechanics.moves.map(move => move.id)).toEqual(["protect"]);
    expect(expanded.sets[0].mechanics.ability.id).toBe("intimidate");
    expect(expanded.sets[0].mechanics.item.id).toBe("choicescarf");
    expect(expanded.sets[0].megaEvolution.mechanics.ability.id).toBe("aerilate");
    expect(result.instructions).toContain("only after Mega activation");
    expect(JSON.parse(result.text).sets[0].megaEvolution.mechanics.ability).toHaveProperty("dataRef");
    expect(expandModelInput(result.text)).toEqual(request);
    expect(JSON.stringify(request)).toBe(original);
  });

  it("does not invent missing mechanics or resolve conflicting canonical IDs", () => {
    const request = createRequest();
    request.sets[0].ability = "Aerilate";
    request.sets[1].ability = "Unknown Ability";
    request.mechanics.abilities = [
      { id: "aerilate", displayName: "Aerilate", effect: "First effect." },
      { id: "AERILATE", displayName: "Aerilate", effect: "Conflicting effect." },
    ];
    const result = serializePokePilotModelRequest(request);
    const expanded = expandModelInput(result.text, false) as { sets: Array<{ mechanics: object }> };
    expect(expanded.sets[0].mechanics).not.toHaveProperty("ability");
    expect(expanded.sets[1].mechanics).not.toHaveProperty("ability");
    expect(result.instructions).toContain("unknown, not absent");
    expect(expandModelInput(result.text)).toEqual(request);
  });

  it("treats an already-Mega set's ability as current rather than a second activation", () => {
    const request = createRequest();
    request.sets[0].isMegaForm = true;
    request.sets[0].ability = "Aerilate";
    request.mechanics.abilities = [{ id: "aerilate", displayName: "Aerilate", effect: "Normal moves become Flying." }];
    const expanded = expandModelInput(serializePokePilotModelRequest(request).text, false) as {
      sets: Array<{ mechanics: { ability: { id: string } }; megaEvolution: null }>;
    };
    expect(expanded.sets[0].mechanics.ability.id).toBe("aerilate");
    expect(expanded.sets[0].megaEvolution).toBeNull();
  });

  it("retains canonical mechanics and current/Mega owners without duplicating their records", () => {
    const request = createRequest();
    request.sets[0].ability = "Intimidate";
    request.sets[0].item = "Choice Scarf";
    request.sets[0].megaEvolution = {
      pokemonId: "test-mega", pokemonName: "Test Mega", displayName: "Test Mega",
      types: ["flying"], typeDisplayNames: ["Flying"], ability: "Aerilate",
      abilityDisplayName: "Aerilate", baseStats: { ...defaultEvs },
      stats: { ...defaultEvs }, defensiveProfile: request.sets[0].defensiveProfile,
    };
    request.mechanics.abilities = [
      { id: "intimidate", displayName: "Intimidate", effect: "Lowers opposing Attack." },
      { id: "aerilate", displayName: "Aerilate", effect: "Normal moves become Flying." },
    ];
    request.mechanics.items = [{ id: "choicescarf", displayName: "Choice Scarf", effect: "Speed is 1.5x." }];
    const original = JSON.stringify(request);
    const result = serializePokePilotModelRequest(request);
    expect(expandModelInput(result.text)).toEqual(request);
    expect(result.text).not.toContain('"abilityMechanic"');
    expect(result.text).not.toContain('"itemMechanic"');
    expect(JSON.stringify(request)).toBe(original);
  });
  it("preserves every candidate, outcome, ownership and direction without mutating the request", () => {
    const request = createSampleRequest();
    const original = JSON.stringify(request);
    const result = serializePokePilotModelRequest(request);
    expect(result.instructions).toContain("offense/defense/current/optimized");
    expect(result.text.length + result.instructions.length).toBeLessThan(
      JSON.stringify(expandModelInput(result.text, false)).length * 0.75,
    );
    expect(expandModelInput(result.text)).toEqual(JSON.parse(original));
    expect(JSON.stringify(request)).toBe(original);
    expect(serializePokePilotModelRequest(request)).toEqual(result);
  });

  it("does not conflate different HP states, probabilities or move replacements", () => {
    const request = createSampleRequest();
    const candidates = request.optimization!.candidates;
    candidates[0].defenseBenchmarks[0].current.defenderCurrentHp = 120;
    candidates[1].defenseBenchmarks[0].optimized.koChance = 0.125;
    candidates[2].offenseBenchmarks[0].moveId = "drainpunch";
    candidates[2].offenseBenchmarks[0].moveDisplayName = "Drain Punch";
    candidates[2].offenseBenchmarks[0].currentMoveId = "closecombat";
    candidates[2].offenseBenchmarks[0].currentMoveDisplayName = "Close Combat";
    expect(expandModelInput(serializePokePilotModelRequest(request).text)).toEqual(request);
  });

  it.each(["team", "pokemon"] as const)("retains move owners and complete facts for %s analysis", (scope) => {
    const request = createRequest(scope);
    const result = serializePokePilotModelRequest(request);
    expect(expandModelInput(result.text)).toEqual(request);
    expect(result.text.length + result.instructions.length).toBeLessThan(
      JSON.stringify(expandModelInput(result.text, false)).length,
    );
  });

  it("shares recommendation moves and abilities without merging variants with the same ID", () => {
    const request = createRequest("recommendation");
    request.recommendationCandidates = Array.from({ length: 10 }, (_, index) => ({
      pokemonId: `candidate${index}`, displayName: `Candidate ${index}`,
      target: { mode: "replacement", slotIndex: index % 6,
        currentPokemonId: `pokemon${index % 6}`,
        currentDisplayName: `Pokemon ${index % 6}`,
        currentRoleIds: [], currentSetterConceptIds: [], currentAceConceptIds: [],
        currentResponsibilityIds: [], currentSupportElements: [],
        megaOptionPokemonId: null,
        allySupportLinks: [] },
      types: ["normal"], typeDisplayNames: ["Normal"], baseStats: null,
      speedTier: "mid", requiresMegaStone: false, usageRank: index + 1,
      abilities: [{ id: "intimidate", displayName: "Intimidate",
        effect: "On switch-in, lowers the Attack of all adjacent opposing Pokemon by one stage." }],
      commonSet: { ability: "intimidate", item: null, nature: "serious", moves: [{
        id: "fakeout", displayName: "Fake Out", type: "normal", category: "physical",
        power: 40, effect: index === 0 ? "Different supplied description." :
          "Causes the target to flinch. Only succeeds on the first turn after the user enters battle.",
      }] },
      usageOptions: {
        sourcePokemonId: `candidate${index}`, sourceMonth: "2026-10", sourceDate: "2026-10-04", season: "M-C",
        alternativeMoves: [{ id: "protect", displayName: "Protect", type: "normal", category: "Status", power: null,
          effect: "Protects the user from most attacks this turn. Consecutive use can fail.", usagePercent: index === 0 ? 15 : 70 }],
        items: [{ id: "sitrusberry", displayName: "Sitrus Berry", usagePercent: 40, effect: "Restores one quarter of maximum HP at half HP or less." }],
        natures: [{ id: "jolly", displayName: "Jolly", usagePercent: 60 }],
        statPointSpreads: [{ evs: { hp: 2, attack: 32, defense: 0, specialAttack: 0, specialDefense: 0, speed: 32 }, usagePercent: 30 }],
      },
      responsibilityIds: [], fit: { weakTo: [], resistsTeamThreats: [],
        amplifiesTeamThreats: [], addsUnansweredWeaknesses: [], coversTypes: [],
        roleContributions: [], roleRedundancies: [], conceptSynergies: [], conflicts: [] },
    }));
    const result = serializePokePilotModelRequest(request);
    expect(result.instructions).not.toBe("");
    expect(expandModelInput(result.text)).toEqual(request);
    expect(JSON.stringify(JSON.parse(result.text).sharedData)).toContain(
      "recommendation-target",
    );
    expect(JSON.parse(result.text).recommendationCandidates[0].commonSet.moves[0].effect)
      .toBe("Different supplied description.");
    expect(JSON.parse(result.text).recommendationCandidates[0].usageOptions.alternativeMoves[0].usagePercent).toBe(15);
    expect(JSON.stringify(JSON.parse(result.text).sharedData)).toContain("usage-move");
    expect(JSON.stringify(JSON.parse(result.text).sharedData)).toContain("usage-item");
    expect(JSON.stringify(JSON.parse(result.text).sharedData)).toContain("usage-spread");
  });

  it("leaves a small or unshared request byte-for-byte unchanged", () => {
    const request = createRequest();
    request.sets = request.sets.slice(0, 1);
    request.mechanics = { moves: [], abilities: [], items: [] };
    expect(serializePokePilotModelRequest(request)).toEqual({
      text: JSON.stringify(request), instructions: "",
    });
  });

  it("keeps current and Mega defensive facts distinct when ability immunity differs", () => {
    const request = createRequest();
    const set = request.sets[0];
    set.megaEvolution = {
      pokemonId: "testmega", pokemonName: "Test Mega", displayName: "Test Mega",
      types: ["normal"], typeDisplayNames: ["Normal"],
      ability: "levitate", abilityDisplayName: "Levitate",
      baseStats: null, stats: null,
      defensiveProfile: { ...structuredClone(set.defensiveProfile),
        immunities: [{ type: "ground", cause: "ability" }] },
    };
    const result = serializePokePilotModelRequest(request);
    expect(result.instructions).not.toBe("");
    expect(expandModelInput(result.text)).toEqual(request);
  });
});
