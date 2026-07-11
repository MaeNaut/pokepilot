import { describe, expect, it } from "vitest";
import type { PokemonMove } from "../types";
import {
  analyzeTeamConcepts,
  type TeamConceptSetProfile,
} from "./teamConcepts";

function createMove(
  id: string,
  options: Partial<PokemonMove> = {},
): PokemonMove {
  return {
    id,
    name: id,
    type: "normal",
    category: "physical",
    power: 80,
    accuracy: 100,
    pp: 10,
    description: "",
    ...options,
  };
}

function createProfile(
  slotIndex: number,
  options: Partial<TeamConceptSetProfile> = {},
): TeamConceptSetProfile {
  return {
    slotIndex,
    ability: "",
    moves: [],
    roleIds: [],
    speed: 100,
    speedEv: 0,
    speedNature: "neutral",
    ...options,
  };
}

describe("team concepts", () => {
  it.each([
    ["rain", "Drizzle", "Swift Swim"],
    ["sun", "Drought", "Chlorophyll"],
    ["sand", "Sand Stream", "Sand Rush"],
    ["snow", "Snow Warning", "Slush Rush"],
  ] as const)("connects %s setters and ability-based aces", (id, setter, ace) => {
    const concepts = analyzeTeamConcepts([
      createProfile(0, { ability: setter }),
      createProfile(1, {
        ability: ace,
        roleIds: ["physical-attacker"],
      }),
      createProfile(2, {
        roleIds: ["special-attacker"],
      }),
    ]);

    expect(concepts.find((concept) => concept.id === id)).toMatchObject({
      status: "complete",
      setterSlots: [0],
      aceSlots: [1],
      independentAttackerSlots: [2],
      hasIndependentAttacker: true,
    });
  });

  it("uses speed investment to separate Trick Room aces from off-mode attackers", () => {
    const concepts = analyzeTeamConcepts([
      createProfile(0, { moves: [createMove("trick-room")] }),
      createProfile(1, {
        roleIds: ["physical-attacker"],
        speed: 70,
        speedEv: 0,
        speedNature: "down",
      }),
      createProfile(2, {
        roleIds: ["special-attacker"],
        speed: 150,
        speedEv: 32,
        speedNature: "up",
      }),
    ]);
    const trickRoom = concepts.find((concept) => concept.id === "trick-room");

    expect(trickRoom).toMatchObject({
      status: "complete",
      setterSlots: [0],
      aceSlots: [1],
      independentAttackerSlots: [2],
    });
  });

  it("recognizes Gravity attackers through inaccurate or Ground moves", () => {
    const concepts = analyzeTeamConcepts([
      createProfile(0, { moves: [createMove("gravity")] }),
      createProfile(1, {
        roleIds: ["special-attacker"],
        moves: [createMove("focus-blast", { category: "special", accuracy: 70 })],
      }),
      createProfile(2, {
        roleIds: ["physical-attacker"],
        moves: [createMove("earthquake", { type: "ground" })],
      }),
    ]);

    expect(concepts.find((concept) => concept.id === "gravity")).toMatchObject({
      status: "complete",
      setterSlots: [0],
      aceSlots: [1, 2],
    });
  });

  it("does not infer field dependency without an actual field setter", () => {
    const concepts = analyzeTeamConcepts([
      createProfile(0, {
        roleIds: ["physical-attacker"],
        speed: 60,
        moves: [createMove("earthquake", { type: "ground" })],
      }),
      createProfile(1, {
        roleIds: ["special-attacker"],
        speed: 70,
        moves: [createMove("focus-blast", { category: "special", accuracy: 70 })],
      }),
    ]);

    expect(concepts).toEqual([]);
  });
});
