import { describe, expect, it } from "vitest";
import { defaultEvs } from "../data/natures";
import { selectRecommendationUsageOptions } from "./copilotRecommendationUsageSelection";
import { hasValidRecommendationCandidateShape } from "./copilotRequestCandidateValidation";
import type { CopilotRecommendationCandidateSnapshot as Candidate } from "./pokemonRecommendations";

type Context = Parameters<typeof selectRecommendationUsageOptions>[1];
type Usage = NonNullable<Candidate["usageOptions"]>;
const context: Context = { sets: [], mechanics: { moves: [], abilities: [], items: [] }, battleFormat: "singles" };
const move = (id: string, type: Usage["alternativeMoves"][number]["type"] = "normal", category = "Status", usagePercent: number | null = 10): Usage["alternativeMoves"][number] =>
  ({ id, type, category, displayName: id, power: category === "Status" ? null : 80, usagePercent });
const item = (id: string) => ({ id, displayName: id, usagePercent: 10 });
const member = (slotIndex: number, patch: Partial<Context["sets"][number]> = {}): Context["sets"][number] =>
  ({ slotIndex, item: null, ability: null, moves: [], ...patch });

function candidate(): Candidate {
  return {
    pokemonId: "garchomp", displayName: "Garchomp", types: ["dragon", "ground"], typeDisplayNames: ["Dragon", "Ground"],
    target: { mode: "addition", slotIndex: 5, currentPokemonId: null, currentDisplayName: null, currentRoleIds: [], currentSetterConceptIds: [], currentAceConceptIds: [], currentResponsibilityIds: [], currentSupportElements: [], megaOptionPokemonId: null, allySupportLinks: [] },
    abilities: [{ id: "roughskin", displayName: "Rough Skin" }], baseStats: null, speedTier: "fast", requiresMegaStone: false, usageRank: 1,
    commonSet: { ability: "Rough Skin", item: "Focus Sash", nature: "Jolly", moves: [
      { id: "earthquake", displayName: "Earthquake", type: "ground", category: "Physical", power: 100 },
      { id: "protect", displayName: "Protect", type: "normal", category: "Status", power: null },
    ] },
    responsibilityIds: [],
    fit: { weakTo: [], resistsTeamThreats: [], amplifiesTeamThreats: [], addsUnansweredWeaknesses: [], coversTypes: [], roleContributions: [], roleRedundancies: [], conceptSynergies: [], conflicts: [] },
    usageOptions: {
      sourcePokemonId: "garchomp", sourceMonth: "2026-10", sourceDate: "2026-10-04", season: "M-C",
      alternativeMoves: [move("taunt"), move("tailwind"), move("uturn", "bug", "Physical"), move("icebeam", "ice", "Special"), move("blizzard", "ice", "Special"), move("substitute")],
      items: [item("focussash"), item("lifeorb"), item("sitrusberry"), item("leftovers")],
      natures: [{ id: "jolly", displayName: "Jolly", usagePercent: 70 }], statPointSpreads: [{ evs: defaultEvs, usagePercent: 20 }],
    },
  };
}

describe("recommendation request usage selection", () => {
  it("preserves all 30 candidates, ordering, representative sets and source data", () => {
    const input = Array.from({ length: 30 }, (_, index) => ({ ...candidate(), pokemonId: `candidate-${index}` }));
    const original = structuredClone(input);
    const output = selectRecommendationUsageOptions(input, context);
    expect(input).toEqual(original);
    expect(output).toHaveLength(30);
    expect(selectRecommendationUsageOptions(output, context)).toEqual(output);
    output.forEach((entry, index) => {
      expect({ ...entry, usageOptions: undefined }).toEqual({ ...input[index], usageOptions: undefined });
      expect(entry.usageOptions).toMatchObject({ sourcePokemonId: "garchomp", sourceDate: "2026-10-04", natures: [], statPointSpreads: [], items: [] });
      expect(entry.usageOptions?.alternativeMoves).toHaveLength(3);
      expect(hasValidRecommendationCandidateShape(entry)).toBe(true);
    });
  });

  it("does not pad with redundant coverage, representative moves or duplicate alternatives", () => {
    const entry = candidate();
    entry.usageOptions!.alternativeMoves = [move("earthquake", "ground", "Physical"), move("earthpower", "ground", "Special"), move("icebeam", "ice", "Special", 30), move("ice-beam", "ice", "Special"), move("blizzard", "ice", "Special", 20), move("substitute")];
    const [output] = selectRecommendationUsageOptions([entry], context);
    expect(output.usageOptions?.alternativeMoves.map((entry) => entry.id)).toEqual(["icebeam"]);
  });

  it("uses only selected team abilities and moves, excluding the replaced slot", () => {
    const entry = candidate();
    entry.usageOptions!.alternativeMoves = [move("taunt"), move("psychicterrain")];
    const team: Context = { ...context, sets: [member(2, { ability: "Psychic Surge", moves: [{ id: "taunt", type: "dark", category: "status" }] })] };
    expect(selectRecommendationUsageOptions([entry], team)[0].usageOptions).toBeUndefined();
    entry.target = { ...entry.target, mode: "replacement", slotIndex: 2 };
    expect(selectRecommendationUsageOptions([entry], team)[0].usageOptions?.alternativeMoves).toHaveLength(2);
    expect(selectRecommendationUsageOptions([entry], { ...team, sets: [...team.sets, member(4, { ability: "Psychic Surge" })] })[0].usageOptions?.alternativeMoves.map((entry) => entry.id)).toEqual(["taunt"]);
  });

  it("respects shared mechanics and the candidate's existing responsibilities", () => {
    const entry = candidate();
    entry.responsibilityIds = ["pivoting"];
    entry.usageOptions!.alternativeMoves = [move("uturn"), move("taunt")];
    const team: Context = { ...context, sets: [member(0, { moves: [{ id: "encore", type: "normal", category: "status" }] })] };
    expect(selectRecommendationUsageOptions([entry], team)[0].usageOptions).toBeUndefined();
  });

  it("reserves ally-only support options for doubles", () => {
    const entry = candidate();
    entry.usageOptions!.alternativeMoves = [move("helpinghand"), move("wideguard"), move("followme")];
    expect(selectRecommendationUsageOptions([entry], context)[0].usageOptions).toBeUndefined();
    expect(selectRecommendationUsageOptions([entry], { ...context, battleFormat: "doubles" })[0].usageOptions?.alternativeMoves).toHaveLength(3);
  });

  it("sends at most two unoccupied observed items only for a missing or duplicate representative item", () => {
    const entry = candidate();
    const team: Context = { ...context, sets: [member(0, { item: "Focus Sash" }), member(1, { item: "Life Orb" })] };
    expect(selectRecommendationUsageOptions([entry], team)[0].usageOptions?.items.map((entry) => entry.id)).toEqual(["sitrusberry", "leftovers"]);
    entry.target = { ...entry.target, mode: "replacement", slotIndex: 0 };
    expect(selectRecommendationUsageOptions([entry], team)[0].usageOptions?.items).toEqual([]);
    entry.commonSet!.item = null;
    expect(selectRecommendationUsageOptions([entry], context)[0].usageOptions?.items).toHaveLength(2);
    entry.requiresMegaStone = true;
    expect(selectRecommendationUsageOptions([entry], team)[0].usageOptions?.items).toEqual([]);
  });

  it("keeps legacy candidates and omits empty or unusable enrichment", () => {
    const entry = candidate();
    entry.commonSet = null;
    expect(selectRecommendationUsageOptions([entry], context)[0].usageOptions).toBeUndefined();
    delete entry.usageOptions;
    expect(selectRecommendationUsageOptions([entry], context)[0]).toBe(entry);
  });
});
