import { describe, expect, it } from "vitest";
import type { PokemonIndexEntry } from "../types";
import { createCopilotAnalysisRequest } from "./copilotRequestBuilder";
import { validateCopilotAnalysisRequest } from "./copilotRequestContract";
import { createEmptyBuildState } from "./teamBuildState";
import { analyzeTeam } from "./teamDiagnostics";
import type { CopilotRecommendationCandidateSnapshot as Candidate } from "./pokemonRecommendations";
import type { CopilotGroundedModelOutput } from "./copilotModelTypes";
import { isCandidateFactSupported } from "./copilotStrategyAuditCandidateValidation";
import { completeCopilotRecommendationAudit, validateCopilotStrategyAuditForRequest } from "./copilotStrategyAudit";
import { serializePokePilotModelRequest } from "../../server/pokepilotModelInput";

const stats = { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 };
const base: PokemonIndexEntry = {
  name: "charizard", showdownId: "charizard", displayName: "Charizard", speciesKey: "charizard", sortNumber: 6,
  types: ["fire", "flying"], abilities: ["Blaze"], baseStats: stats, formKind: "base", isSelectorOption: true,
};
const pokemonIndex: PokemonIndexEntry[] = [base, {
  ...base, name: "charizard-mega-y", showdownId: "charizardmegay", displayName: "Charizard Mega Y",
  abilities: ["Drought"], formKind: "mega", formLabel: "Mega Y", baseStats: { ...stats, specialAttack: 159 },
}, {
  ...base, name: "charizard-mega-x", showdownId: "charizardmegax", displayName: "Charizard Mega X",
  types: ["fire", "dragon"], abilities: ["Tough Claws"], formKind: "mega", formLabel: "Mega X",
}];
const abilityIndex = [
  { id: "drought", name: "Drought", effect: "On switch-in, this Pokemon summons Sunny Day for 5 turns." },
  { id: "toughclaws", name: "Tough Claws", effect: "This Pokemon's contact moves have their power multiplied by 1.3." },
];
function candidate(item: string | null = "Charizardite Y"): Candidate {
  return {
    pokemonId: "charizard", displayName: "Charizard", types: ["fire", "flying"], typeDisplayNames: ["Fire", "Flying"],
    abilities: [{ id: "blaze", displayName: "Blaze" }], baseStats: stats, speedTier: "fast", requiresMegaStone: false, usageRank: 10,
    target: { mode: "addition", slotIndex: 0, currentPokemonId: null, currentDisplayName: null, currentRoleIds: [], currentSetterConceptIds: [], currentAceConceptIds: [], currentResponsibilityIds: [], currentSupportElements: [], megaOptionPokemonId: null, allySupportLinks: [] },
    commonSet: { ability: "Blaze", item, nature: "modest", moves: [{ id: "solarbeam", displayName: "Solar Beam", type: "grass", category: "Special", power: 120, effect: "Charges for one turn unless Sun is active." }] },
    responsibilityIds: [],
    fit: { weakTo: ["rock"], resistsTeamThreats: [], amplifiesTeamThreats: [], addsUnansweredWeaknesses: [], coversTypes: [], roleContributions: [], roleRedundancies: [], conceptSynergies: [], conflicts: [] },
  };
}
function request(candidates = [candidate()], locale: "en" | "ko" = "en", index = pokemonIndex, abilities = abilityIndex) {
  const buildState = createEmptyBuildState();
  return createCopilotAnalysisRequest({
    scope: "recommendation", locale, teamName: "Mega regression", team: [], selectedSlot: 0, buildState,
    diagnostics: analyzeTeam([], buildState), validity: { status: "valid", slotResults: [], teamIssues: [], errorCount: 0, unavailableCount: 0 },
    pokemonIndex: index, abilityIndex: abilities, recommendationCandidates: candidates,
  });
}

describe("recommendation candidate Mega state", () => {
  it("adds the held-stone projection without replacing current ability, types or fit", () => {
    const input = candidate();
    const original = structuredClone(input);
    const result = request([input]);
    const entry = result.recommendationCandidates[0];
    expect(entry.megaEvolution).toMatchObject({ pokemonId: "charizard-mega-y", ability: { id: "drought", displayName: "Drought", effect: abilityIndex[0].effect }, baseStats: { specialAttack: 159 } });
    expect(entry.commonSet?.ability).toBe("Blaze");
    expect(entry.abilities).toEqual(input.abilities);
    expect(entry.baseStats).toEqual(stats);
    expect(entry.fit).toEqual(input.fit);
    expect(result.megaOptions).toEqual([]);
    expect(input).toEqual(original);
    expect(validateCopilotAnalysisRequest(JSON.parse(JSON.stringify(result))).success).toBe(true);
  });

  it.each(["Charizardite X", "charizardite-x", "charizarditex"])("resolves %s to the X branch, not Y", (item) => {
    const result = request([candidate(item)]).recommendationCandidates[0];
    expect(result.types).toEqual(["fire", "flying"]);
    expect(result.megaEvolution).toMatchObject({ pokemonId: "charizard-mega-x", types: ["fire", "dragon"], ability: { id: "toughclaws" } });
  });

  it.each([null, "Choice Scarf", "Tyranitarite"])("does not invent a projection for %s", (item) => {
    expect(request([candidate(item)]).recommendationCandidates[0].megaEvolution).toBeNull();
  });

  it("recomputes cached projections on item changes and localizes the result", () => {
    const cached = request().recommendationCandidates[0];
    const korean = request([cached], "ko").recommendationCandidates[0];
    expect(korean.megaEvolution?.ability?.displayName).toBe("가뭄");
    expect(korean.megaEvolution?.typeDisplayNames).toEqual(["불꽃", "비행"]);
    expect(cached.megaEvolution?.ability?.displayName).toBe("Drought");
    expect(request([{ ...cached, commonSet: { ...cached.commonSet!, item: "Choice Scarf" } }]).recommendationCandidates[0].megaEvolution).toBeNull();
    expect(request([cached], "en", []).recommendationCandidates[0].megaEvolution).toBeNull();
  });

  it("does not chain an already-Mega form, and leaves unavailable effects unknown", () => {
    expect(request([{ ...candidate(), pokemonId: "charizard-mega-y", requiresMegaStone: true }]).recommendationCandidates[0].megaEvolution).toBeNull();
    expect(request([candidate()], "en", pokemonIndex, []).recommendationCandidates[0].megaEvolution?.ability).toEqual({ id: "drought", displayName: "Drought" });
  });

  it("accepts legacy requests but rejects malformed or unbound projections", () => {
    const result = JSON.parse(JSON.stringify(request()));
    const entry = result.recommendationCandidates[0];
    for (const patch of [
      { ...entry, commonSet: { ...entry.commonSet, item: null } },
      { ...entry, requiresMegaStone: true },
      { ...entry, megaEvolution: { ...entry.megaEvolution, instructions: "extra" } },
      { ...entry, megaEvolution: { ...entry.megaEvolution, types: ["unknown"] } },
      { ...entry, megaEvolution: { ...entry.megaEvolution, ability: { id: "drought", displayName: "Drought", effect: "x".repeat(501) } } },
    ]) expect(validateCopilotAnalysisRequest({ ...result, recommendationCandidates: [patch] }).success).toBe(false);
    delete entry.megaEvolution;
    expect(validateCopilotAnalysisRequest(result).success).toBe(true);
  });

  it("never accepts Mega-only abilities or types as current-state facts", () => {
    const entry = request([candidate("Charizardite X")]).recommendationCandidates[0];
    const fact = { id: "m", candidateId: "charizard", valueId: "toughclaws", kind: "mega-ability" as const };
    expect(isCandidateFactSupported(fact, entry, [])).toBe(true);
    expect(isCandidateFactSupported({ ...fact, kind: "ability" }, entry, [])).toBe(false);
    expect(isCandidateFactSupported({ ...fact, kind: "mega-type", valueId: "dragon" }, entry, [])).toBe(true);
    expect(isCandidateFactSupported({ ...fact, kind: "type", valueId: "dragon" }, entry, [])).toBe(false);
    expect(isCandidateFactSupported({ ...fact, valueId: "drought" }, entry, [])).toBe(false);
  });

  it("links only the supplied Mega ability without rewriting prose or fixing a false base claim", () => {
    const input = request();
    const output: CopilotGroundedModelOutput = {
      analysis: { version: 2, scope: "recommendation", title: "Test", paragraphs: [], recommendations: [{ id: "charizard", title: "Charizard", reason: "After Mega Evolution, Drought supplies Sun. Rock weakness remains a cost.", priority: "medium" }] },
      strategyAudit: { plans: [], interactions: [], facts: [], candidateFacts: [{ id: "cost", candidateId: "charizard", kind: "weak-to", valueId: "rock" }], recommendationEvidence: [{ recommendationId: "charizard", planIds: [], interactionIds: [], factIds: [], candidateFactIds: ["cost"] }] },
    };
    const completed = completeCopilotRecommendationAudit(output, input);
    expect(completed.analysis).toEqual(output.analysis);
    expect(completed.strategyAudit.candidateFacts).toContainEqual(expect.objectContaining({ kind: "mega-ability", valueId: "drought" }));
    expect(completed.strategyAudit.candidateFacts.some(fact => fact.kind === "ability")).toBe(false);
    expect(validateCopilotStrategyAuditForRequest(completed, input)).toEqual([]);
    output.strategyAudit.candidateFacts.push({ id: "wrong-state", candidateId: "charizard", kind: "ability", valueId: "drought" });
    const stillWrong = completeCopilotRecommendationAudit(output, input);
    expect(validateCopilotStrategyAuditForRequest(stillWrong, input).some(error => error.includes("contradicts"))).toBe(true);
    expect(stillWrong.analysis).toEqual(output.analysis);
  });

  it("round-trips both states through lossless compact encoding", () => {
    const original = JSON.parse(JSON.stringify(request([candidate(), candidate()])));
    const encoded = JSON.parse(serializePokePilotModelRequest(original).text);
    const table = encoded.sharedData;
    delete encoded.sharedData;
    const expand = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(expand);
      if (!value || typeof value !== "object") return value;
      if ("dataRef" in value) return expand(table[String(value.dataRef)]);
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item)]));
    };
    expect(expand(encoded)).toEqual(original);
  });
});
