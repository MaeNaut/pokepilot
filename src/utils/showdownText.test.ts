import { describe, expect, it } from "vitest";
import type { TeamBuildState } from "../hooks/useTeamBuildState";
import type { TeamMember } from "../types";
import {
  formatShowdownTeam,
  parseShowdownTeam,
  toPokemonId,
} from "./showdownText";

const charizard: TeamMember = {
  id: "charizard-mega-y",
  name: "Charizard Mega Y",
  types: ["fire", "flying"],
  roles: [],
  moves: [
    { id: "overheat", name: "Overheat", type: "fire", category: "special", power: 130, accuracy: 90, pp: 5, description: "" },
    { id: "solar-beam", name: "Solar Beam", type: "grass", category: "special", power: 120, accuracy: 100, pp: 10, description: "" },
  ],
};

const buildState: TeamBuildState = {
  itemBySlot: { 0: { id: "charizardite-y", name: "Charizardite Y" } },
  abilityBySlot: { 0: "Drought" },
  natureBySlot: { 0: "modest" },
  evsBySlot: {
    0: { hp: 2, attack: 0, defense: 0, specialAttack: 32, specialDefense: 0, speed: 32 },
  },
  moveIdsBySlot: { 0: ["overheat", "solar-beam"] },
  preMegaPokemonBySlot: {},
};

describe("Showdown text", () => {
  it("formats a complete Pokemon set", () => {
    expect(formatShowdownTeam([charizard], buildState)).toBe(
      [
        "Charizard Mega Y @ Charizardite Y",
        "Ability: Drought",
        "EVs: 2 HP / 32 SpA / 32 Spe",
        "Modest Nature",
        "- Overheat",
        "- Solar Beam",
      ].join("\n"),
    );
  });

  it("parses item, ability, EVs, nature, and moves", () => {
    const [parsed] = parseShowdownTeam(formatShowdownTeam([charizard], buildState));

    expect(parsed).toEqual({
      pokemonName: "Charizard Mega Y",
      itemName: "Charizardite Y",
      ability: "Drought",
      evs: { hp: 2, specialAttack: 32, speed: 32 },
      nature: "modest",
      moves: ["Overheat", "Solar Beam"],
    });
  });

  it("normalizes Pokemon names for lookup", () => {
    expect(toPokemonId("  Charizard Mega Y ")).toBe("charizard-mega-y");
  });

  it("omits explicitly empty move slots without shifting stored positions", () => {
    const text = formatShowdownTeam([charizard], {
      ...buildState,
      moveIdsBySlot: { 0: ["overheat", "", "solar-beam", ""] },
    });

    expect(text).toContain("- Overheat\n- Solar Beam");
    expect(text).not.toContain("- \n");
  });
});
