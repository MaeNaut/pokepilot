import { describe, expect, it } from "vitest";
import { calculateChampionsStats, defaultEvs, getNatureById } from "../../data/natures";
import type { StatBlock } from "../../types";
import { createCalculatorBattleState, createDefaultCalculatorField } from "../calculatorViewModel";
import { createRolePreserver, getRoleCost } from "./rolePreservation";
import type { CalculatorAnalysisContext, CandidateSeed } from "./types";

function context(natureId: string, evs: StatBlock): CalculatorAnalysisContext {
  const member = {
    id: "weavile", name: "Weavile", types: ["dark", "ice"] as ["dark", "ice"], roles: [],
    baseStats: { hp: 70, attack: 120, defense: 65, specialAttack: 45, specialDefense: 85, speed: 125 },
  };
  const maxHp = calculateChampionsStats(member.baseStats, evs, getNatureById(natureId)).hp;
  const side = { member, build: { natureId, evs, item: null, ability: "Pressure", moveIds: [] }, moves: [], maxHp, battle: createCalculatorBattleState(maxHp) };
  return { battleFormat: "doubles", selectedSlot: 0, direction: "player-to-opponent", player: side, opponent: side, field: createDefaultCalculatorField("doubles") };
}

function seed(natureId: string, evs: StatBlock): CandidateSeed {
  return { natureId, evs, targets: { hp: evs.hp, defense: evs.defense }, focuses: ["defense"], axes: ["defense:defense"] };
}

describe("preserving the current set's role", () => {
  it("charges a soft cost for modest changes and a larger cost for dismantling investment", () => {
    const input = context("jolly", { ...defaultEvs, hp: 2, attack: 32, speed: 32 });
    const modest = getRoleCost(input, seed("jolly", { ...defaultEvs, hp: 6, attack: 28, speed: 32 }));
    const removed = getRoleCost(input, seed("relaxed", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 }));
    expect(modest).toBeGreaterThan(0);
    expect(modest).toBeLessThan(10);
    expect(removed).toBeGreaterThan(modest * 10);
    expect(getRoleCost(input, seed("jolly", input.player.build.evs))).toBe(0);
  });
  it("reallocates bulk around invested Attack and Speed instead of stripping them", () => {
    const input = context("jolly", { ...defaultEvs, hp: 2, attack: 32, speed: 32 });
    const original = structuredClone(input);
    const preserve = createRolePreserver(input);
    const adjusted = preserve(seed("jolly", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 }));
    expect(adjusted?.evs).toEqual(input.player.build.evs);
    expect(adjusted?.targets).toMatchObject({ hp: 2, attack: 32, speed: 32, defense: 0 });
    expect(preserve(seed("relaxed", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 }))).toBeNull();
    expect(input).toEqual(original);
  });

  it("allows fewer offensive points only when a nature preserves the original final stat", () => {
    const input = context("hardy", { ...defaultEvs, hp: 32, attack: 20, defense: 14 });
    const adjusted = createRolePreserver(input)(seed("adamant", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 }));
    expect(adjusted).not.toBeNull();
    expect(adjusted!.evs.attack).toBeLessThan(20);
    const before = calculateChampionsStats(input.player.member!.baseStats!, input.player.build.evs, getNatureById("hardy"));
    const after = calculateChampionsStats(input.player.member!.baseStats!, adjusted!.evs, getNatureById("adamant"));
    expect(after.attack).toBeGreaterThanOrEqual(before.attack);
  });

  it("does not invent an offensive investment requirement for a support set", () => {
    const input = context("careful", { ...defaultEvs, hp: 32, defense: 2, specialDefense: 32 });
    const proposed = seed("impish", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 });
    expect(createRolePreserver(input)(proposed)?.evs).toEqual(proposed.evs);
  });

  it("preserves a deliberately minimum-Speed set without assuming a fast species role", () => {
    const input = context("brave", { ...defaultEvs, hp: 32, attack: 32, defense: 2 });
    const preserve = createRolePreserver(input);
    expect(preserve(seed("adamant", input.player.build.evs))).toBeNull();
    expect(preserve(seed("brave", input.player.build.evs))?.evs.speed).toBe(0);
  });

  it("protects Special Attack and Speed on a special or mixed set too", () => {
    const input = context("timid", { ...defaultEvs, hp: 2, specialAttack: 32, speed: 32 });
    const adjusted = createRolePreserver(input)(seed("timid", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 }));
    expect(adjusted?.evs).toEqual(input.player.build.evs);
    const mixed = context("hardy", { ...defaultEvs, attack: 22, specialAttack: 22, speed: 22 });
    expect(createRolePreserver(mixed)(seed("hardy", { ...defaultEvs, hp: 32, defense: 32, specialDefense: 2 }))?.evs)
      .toEqual(mixed.player.build.evs);
  });
});
