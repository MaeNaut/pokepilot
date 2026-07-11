import { describe, expect, it } from "vitest";
import type { PokemonMove, StatBlock, TeamMember } from "../types";
import { analyzeTeam, getDefensiveMultiplier } from "./teamDiagnostics";

const neutralEvs: StatBlock = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

function createMove(id: string, category: "physical" | "special"): PokemonMove {
  return {
    id,
    name: id,
    type: category === "physical" ? "normal" : "psychic",
    category,
    power: 80,
    accuracy: 100,
    pp: 10,
    description: "",
  };
}

function createMember(id: string, moves: PokemonMove[]): TeamMember {
  return {
    id,
    name: id,
    types: ["electric"],
    roles: [],
    abilities: ["Levitate"],
    baseStats: {
      hp: 80,
      attack: 120,
      defense: 80,
      specialAttack: 60,
      specialDefense: 80,
      speed: 80,
    },
    moves,
  };
}

describe("team diagnostics", () => {
  it("combines defensive multipliers for dual typings", () => {
    expect(getDefensiveMultiplier("ice", ["grass", "flying"])).toBe(4);
    expect(getDefensiveMultiplier("ground", ["flying"])).toBe(0);
  });

  it("counts ability-based type immunities", () => {
    const member = createMember("levitating-pokemon", []);
    const result = analyzeTeam(
      [member],
      { moveIdsBySlot: {}, evsBySlot: {}, natureBySlot: {}, abilityBySlot: { 0: "Levitate" } },
    );
    const ground = result.defensiveMatchups.find((matchup) => matchup.type === "ground");

    expect(ground).toMatchObject({ weakCount: 0, immuneCount: 1 });
  });

  it("warns only when multiple attackers lean into one damage category", () => {
    const physicalMoves = [createMove("body-slam", "physical"), createMove("crunch", "physical")];
    const team = [createMember("first", physicalMoves), createMember("second", physicalMoves)];
    const result = analyzeTeam(team, {
      moveIdsBySlot: { 0: ["body-slam", "crunch"], 1: ["body-slam", "crunch"] },
      evsBySlot: {
        0: { ...neutralEvs, attack: 32 },
        1: { ...neutralEvs, attack: 32 },
      },
      natureBySlot: { 0: "adamant", 1: "adamant" },
      abilityBySlot: {},
    });

    expect(result.roles.find((role) => role.id === "physical-attacker")?.slotIndexes).toEqual([0, 1]);
    expect(result.alerts.some((alert) => alert.id === "attacker-role-balance")).toBe(true);
  });

  it("does not fall back to default moves when all configured move slots are empty", () => {
    const physicalMoves = [createMove("body-slam", "physical"), createMove("crunch", "physical")];
    const member = createMember("empty-moves", physicalMoves);
    const result = analyzeTeam([member], {
      moveIdsBySlot: { 0: ["", "", "", ""] },
      evsBySlot: { 0: { ...neutralEvs, attack: 32 } },
      natureBySlot: { 0: "adamant" },
      abilityBySlot: {},
    });

    expect(result.roles.find((role) => role.id === "physical-attacker")?.slotIndexes).toEqual([]);
  });
});
