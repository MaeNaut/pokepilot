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
  };
}

function createSampleRequest() {
  const request = createRequest("optimization");
  request.optimization = {
    slotIndex: 0, configuredDirection: "opponent-to-player",
    playerPokemonId: "farigiraf", playerDisplayName: "Farigiraf",
    opponentPokemonId: "scizor", opponentDisplayName: "Scizor",
    field: createDefaultCalculatorField("doubles"),
    currentBuild: { natureId: "serious", natureDisplayName: "Serious",
      evs: { ...defaultEvs }, finalStats: { ...defaultEvs },
      itemId: null, itemDisplayName: null, moveIds: ["protect"] },
    moveMechanics: [], candidates: Array.from({ length: 12 }, (_, i) => sampleCandidate(i)),
  };
  return request;
}

function expandModelInput(text: string): unknown {
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
  return expand(request);
}

describe("model input sharing", () => {
  it("preserves every candidate, outcome, ownership and direction without mutating the request", () => {
    const request = createSampleRequest();
    const original = JSON.stringify(request);
    const result = serializePokePilotModelRequest(request);
    expect(result.instructions).toContain("offense/defense/current/optimized");
    expect(result.text.length + result.instructions.length).toBeLessThan(original.length * 0.75);
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
    // Small requests may deliberately stay inline after accounting for the legend.
    expect(result.text.length + result.instructions.length).toBeLessThanOrEqual(JSON.stringify(request).length);
  });

  it("shares recommendation moves and abilities without merging variants with the same ID", () => {
    const request = createRequest("recommendation");
    request.recommendationCandidates = Array.from({ length: 10 }, (_, index) => ({
      pokemonId: `candidate${index}`, displayName: `Candidate ${index}`,
      types: ["normal"], typeDisplayNames: ["Normal"], baseStats: null,
      speedTier: "mid", requiresMegaStone: false, usageRank: index + 1,
      abilities: [{ id: "intimidate", displayName: "Intimidate",
        effect: "On switch-in, lowers the Attack of all adjacent opposing Pokemon by one stage." }],
      commonSet: { ability: "intimidate", item: null, nature: "serious", moves: [{
        id: "fakeout", displayName: "Fake Out", type: "normal", category: "physical",
        power: 40, effect: index === 0 ? "Different supplied description." :
          "Causes the target to flinch. Only succeeds on the first turn after the user enters battle.",
      }] },
      responsibilityIds: [], fit: { weakTo: [], resistsTeamThreats: [],
        amplifiesTeamThreats: [], addsUnansweredWeaknesses: [], coversTypes: [],
        roleContributions: [], roleRedundancies: [], conceptSynergies: [], conflicts: [] },
    }));
    const result = serializePokePilotModelRequest(request);
    expect(result.instructions).not.toBe("");
    expect(expandModelInput(result.text)).toEqual(request);
    expect(JSON.parse(result.text).recommendationCandidates[0].commonSet.moves[0].effect)
      .toBe("Different supplied description.");
  });

  it("leaves a small or unshared request byte-for-byte unchanged", () => {
    const request = createRequest();
    request.sets = request.sets.slice(0, 1);
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
      defensiveProfile: { ...structuredClone(set.defensiveProfile),
        immunities: [{ type: "ground", cause: "ability" }] },
    };
    const result = serializePokePilotModelRequest(request);
    expect(result.instructions).not.toBe("");
    expect(expandModelInput(result.text)).toEqual(request);
  });
});
