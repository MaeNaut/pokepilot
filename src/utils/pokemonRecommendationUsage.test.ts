import { afterEach, describe, expect, it, vi } from "vitest";
import * as usageApi from "../api/battleUsage";
import type { BattleUsageSet } from "../api/battleUsage";
import type { ShowdownDataSnapshot } from "../api/showdownData";
import type { ItemIndexEntry } from "../types";
import { createRecommendationUsageOptions, enrichRecommendationUsage } from "./pokemonRecommendationUsage";
import { rankPokemonRecommendationCandidates, type PokemonRecommendationOption } from "./pokemonRecommendations";
import { hasValidRecommendationCandidateShape } from "./copilotRequestCandidateValidation";
import { isCandidateFactSupported } from "./copilotStrategyAuditCandidateValidation";
import { analyzeTeam } from "./teamDiagnostics";
import { createEmptyBuildState } from "./teamBuildState";

const moveIds = ["earthquake", "dragonclaw", "protect", "swordsdance", "rockslide", "firefang", "crunch", "ironhead", "substitute", "stealthrock", "scaleshot", "dragontail"];
const option: PokemonRecommendationOption = {
  id: "garchomp", speciesKey: "garchomp", displayName: "Garchomp", types: ["dragon", "ground"],
  typeDisplayNames: ["Dragon", "Ground"], abilities: [{ id: "roughskin", displayName: "Rough Skin" }], legalMoveIds: moveIds,
};
const showdown: ShowdownDataSnapshot = {
  speciesById: {},
  movesById: Object.fromEntries(moveIds.map((id) => [id, {
    id, name: id, type: "normal", category: "Physical", power: 80, accuracy: 100, pp: 10,
    description: "A test attack.", detailedDescription: "Complete move mechanics.",
  }])),
};
const itemIndex: ItemIndexEntry[] = [
  { id: 1, name: "Focus Sash", showdownId: "focussash", displayName: "Focus Sash", isMegaStone: false, effect: "Survives an attack at full HP." },
  { id: 2, name: "Garchompite", showdownId: "garchompite", displayName: "Garchompite", isMegaStone: true },
];
const usage: BattleUsageSet = {
  pokemonId: "garchomp", pokemonName: "Garchomp", sourceMonth: "2026-10", sourceDate: "2026-10-04", season: "M-C", cutoff: 0,
  nature: "jolly", itemName: "Focus Sash", itemNames: ["Focus Sash", "Garchompite"], moveIds,
  moveOptions: moveIds.map((id, index) => ({ id, usagePercent: 80 - index * 5 })),
  natureOptions: [{ id: "jolly", usagePercent: 60 }, { id: "adamant", usagePercent: 30 }],
  statPointSpreads: [{ evs: { hp: 2, attack: 32, defense: 0, specialAttack: 0, specialDefense: 0, speed: 32 }, usagePercent: 40 }],
};

function candidate() {
  return rankPokemonRecommendationCandidates({
    options: [option], filters: { types: [], ability: null, moves: [] }, occupiedSpeciesKeys: new Set(),
    diagnostics: analyzeTeam([], createEmptyBuildState()), usageIds: [option.id], usageSets: [usage], showdownData: showdown,
  })[0];
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("recommendation battle usage enrichment", () => {
  it("keeps four representative moves separate from eight legal observed alternatives", () => {
    const result = candidate();
    const before = structuredClone(result);
    const data = createRecommendationUsageOptions(result, option, usage, showdown, itemIndex);
    expect(result).toEqual(before);
    expect(result.commonSet?.moves).toHaveLength(4);
    expect(data.alternativeMoves.map((move) => move.id)).toEqual(moveIds.slice(4));
    expect(data.alternativeMoves[0]).toMatchObject({ usagePercent: 60, effect: "Complete move mechanics." });
    expect(data.items).toEqual([expect.objectContaining({ id: "focussash", usagePercent: null })]);
    expect(data.natures.map((nature) => nature.usagePercent)).toEqual([60, 30]);
    expect(data.statPointSpreads[0].usagePercent).toBe(40);
    expect(hasValidRecommendationCandidateShape({ ...result, usageOptions: data })).toBe(true);
    const limited = createRecommendationUsageOptions(result, { ...option, legalMoveIds: moveIds.slice(0, 6) }, usage, showdown, itemIndex);
    expect(limited.alternativeMoves.map((move) => move.id)).toEqual(moveIds.slice(4, 6));
  });

  it("retains aggregate provenance but never copies held-item alternatives to a Mega", () => {
    const mega = { ...candidate(), pokemonId: "garchomp-mega", requiresMegaStone: true };
    const data = createRecommendationUsageOptions(mega, { ...option, id: mega.pokemonId, isMegaForm: true }, usage, showdown, itemIndex);
    expect(data.sourcePokemonId).toBe("garchomp");
    expect(data.items).toEqual([]);
  });

  it("does not convert unavailable percentages into zero or allow unbounded/invalid data", () => {
    const result = candidate();
    const data = createRecommendationUsageOptions(result, option, { ...usage, moveOptions: undefined, natureOptions: undefined }, showdown, itemIndex);
    expect(data.alternativeMoves.every((move) => move.usagePercent === null)).toBe(true);
    expect(data.natures[0].usagePercent).toBeNull();
    for (const patch of [
      { alternativeMoves: [...data.alternativeMoves, data.alternativeMoves[0]] },
      { natures: [{ id: "bogus", displayName: "Bogus", usagePercent: 1 }] },
      { items: [{ ...data.items[0], usagePercent: 101 }] },
      { statPointSpreads: [{ ...data.statPointSpreads[0], evs: { ...data.statPointSpreads[0].evs, hp: 32 } }] },
    ]) expect(hasValidRecommendationCandidateShape({ ...result, usageOptions: { ...data, ...patch } })).toBe(false);
    expect(hasValidRecommendationCandidateShape(result)).toBe(true);
  });

  it("validates alternative facts without treating them as selected common moves", () => {
    const result = candidate();
    result.usageOptions = createRecommendationUsageOptions(result, option, usage, showdown, itemIndex);
    const fact = { id: "u1", candidateId: result.pokemonId, kind: "usage-move" as const, valueId: "dragontail" };
    expect(isCandidateFactSupported(fact, result, [])).toBe(true);
    expect(isCandidateFactSupported({ ...fact, kind: "common-move" }, result, [])).toBe(false);
    expect(isCandidateFactSupported({ ...fact, valueId: "surf" }, result, [])).toBe(false);
    expect(isCandidateFactSupported({ ...fact, kind: "usage-item", valueId: "focussash" }, result, [])).toBe(true);
    expect(isCandidateFactSupported({ ...fact, kind: "usage-nature", valueId: "adamant" }, result, [])).toBe(true);
  });

  it("deduplicates source requests and ignores a detail from another update", async () => {
    const load = vi.spyOn(usageApi, "loadPopularUsageSet").mockResolvedValue({ ...usage, sourceDate: "2026-10-05", moveIds: [] });
    const base = { ...usage, moveOptions: undefined };
    const results = await enrichRecommendationUsage([candidate(), candidate()], [{ option, usage: base }, { option, usage: base }], "singles", showdown, itemIndex);
    expect(load).toHaveBeenCalledTimes(1);
    expect(results[0].usageOptions?.alternativeMoves).toHaveLength(8);
    expect(results[0].usageOptions?.alternativeMoves[0].usagePercent).toBeNull();
  });

  it("bounds concurrent detail requests, times out to index data and supports cancellation", async () => {
    vi.useFakeTimers();
    const load = vi.spyOn(usageApi, "loadPopularUsageSet").mockImplementation(() => new Promise(() => {}));
    const sources = Array.from({ length: 10 }, (_, index) => ({ option, usage: { ...usage, pokemonId: `source${index}` } }));
    const pending = enrichRecommendationUsage(sources.map(() => candidate()), sources, "doubles", showdown, itemIndex);
    expect(load).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await pending).toHaveLength(10);
    expect(load).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
    const controller = new AbortController();
    const canceled = enrichRecommendationUsage([candidate()], [{ option, usage }], "singles", showdown, itemIndex, controller.signal);
    controller.abort();
    expect(await canceled).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
