import { describe, expect, it } from "vitest";
import { defaultEvs } from "../data/natures";
import type { PokemonMove, TeamMember } from "../types";
import type { CalculatorBuildValues } from "./calculatorEditorTypes";
import {
  createCalculatorBattleState,
  createDefaultCalculatorField,
  getCalculatorMaxHp,
  getCalculatorMoveSlots,
  getCalculatorSpeed,
} from "./calculatorViewModel";

const moves: PokemonMove[] = [
  {
    id: "tackle",
    name: "Tackle",
    type: "normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 35,
    description: "",
  },
];

const member: TeamMember = {
  id: "test-pokemon",
  name: "Test Pokemon",
  types: ["normal"],
  roles: [],
  abilities: ["Run Away"],
  moves,
  baseStats: {
    hp: 100,
    attack: 50,
    defense: 50,
    specialAttack: 50,
    specialDefense: 50,
    speed: 50,
  },
};

const build: CalculatorBuildValues = {
  item: null,
  ability: "Run Away",
  natureId: "hardy",
  evs: { ...defaultEvs },
  moveIds: ["tackle"],
};

describe("calculator view model", () => {
  it("creates format-aware default field state", () => {
    expect(createDefaultCalculatorField("singles")).toMatchObject({
      gameType: "singles",
      isSpread: false,
    });
    expect(createDefaultCalculatorField("doubles")).toMatchObject({
      gameType: "doubles",
      isSpread: true,
    });
  });

  it("resolves max HP and stage-adjusted speed", () => {
    expect(getCalculatorMaxHp(member, build)).toBe(175);
    expect(getCalculatorSpeed(member, build, 0)).toBe(70);
    expect(getCalculatorSpeed(member, build, 2)).toBe(140);
    expect(getCalculatorSpeed(member, build, -2)).toBe(35);
  });

  it("resolves four move slots with fallback move data", () => {
    const fallbackMove = {
      ...moves[0],
      id: "fallback-move",
      name: "Fallback Move",
    };

    expect(
      getCalculatorMoveSlots(
        member,
        ["tackle", "fallback-move", "", ""],
        [fallbackMove],
      ).map((move) => move?.id),
    ).toEqual(["tackle", "fallback-move", undefined, undefined]);
  });

  it("creates independent default battle state", () => {
    const first = createCalculatorBattleState(120);
    const second = createCalculatorBattleState(80);

    first.boosts.attack = 2;

    expect(first.currentHp).toBe(120);
    expect(second.currentHp).toBe(80);
    expect(second.boosts.attack).toBe(0);
  });
});
