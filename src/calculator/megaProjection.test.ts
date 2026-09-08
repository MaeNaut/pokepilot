import { describe, expect, it } from "vitest";
import { defaultEvs } from "../data/natures";
import type { PokemonIndexEntry, PokemonItem, TeamMember } from "../types";
import {
  createProjectedMegaMember,
  getMegaEvolutionIndexEntry,
} from "../utils/megaEvolution";
import {
  createCalculatorBattleState,
  getCalculatorMaxHp,
} from "./calculatorViewModel";
import { projectCalculatorSideToMega } from "./megaProjection";

const baseStats = {
  hp: 50,
  attack: 85,
  defense: 85,
  specialAttack: 55,
  specialDefense: 55,
  speed: 50,
};
const megaStats = {
  hp: 50,
  attack: 105,
  defense: 125,
  specialAttack: 55,
  specialDefense: 95,
  speed: 50,
};
const mawile: TeamMember = {
  id: "mawile",
  name: "Mawile",
  showdownName: "Mawile",
  types: ["steel", "fairy"],
  roles: [],
  abilities: ["Intimidate"],
  moves: [],
  baseStats,
};
const pokemonIndex: PokemonIndexEntry[] = [
  {
    name: "mawile",
    showdownId: "mawile",
    showdownName: "Mawile",
    displayName: "Mawile",
    speciesKey: "mawile",
    sortNumber: 303,
    types: ["steel", "fairy"],
    abilities: ["Intimidate"],
    baseStats,
    formKind: "base",
    isSelectorOption: true,
  },
  {
    name: "mawile-mega",
    showdownId: "mawilemega",
    showdownName: "Mawile-Mega",
    displayName: "Mawile Mega",
    speciesKey: "mawile",
    sortNumber: 303,
    types: ["steel", "fairy"],
    abilities: ["Huge Power"],
    baseStats: megaStats,
    formKind: "mega",
    formLabel: "Mega",
    isSelectorOption: false,
  },
];
const mawilite: PokemonItem = {
  id: "mawilite",
  showdownId: "mawilite",
  name: "Mawilite",
  category: "Mega Stones",
};

describe("calculator Mega projection", () => {
  it("resolves only the Mega form enabled by the held stone", () => {
    expect(
      getMegaEvolutionIndexEntry("mawile", mawilite, pokemonIndex)?.name,
    ).toBe("mawile-mega");
    expect(getMegaEvolutionIndexEntry("mawile", {
      id: "leftovers",
      name: "Leftovers",
    }, pokemonIndex)).toBeNull();
  });

  it("uses projected stats and ability while preserving current HP ratio", () => {
    const megaMember = createProjectedMegaMember(
      mawile,
      mawilite,
      pokemonIndex,
    );
    expect(megaMember).toMatchObject({
      id: "mawile-mega",
      showdownName: "Mawile-Mega",
      abilities: ["Huge Power"],
      baseStats: megaStats,
    });
    if (!megaMember) return;

    const build = {
      item: mawilite,
      ability: "Intimidate",
      natureId: "hardy",
      evs: { ...defaultEvs },
      moveIds: [],
    };
    const maxHp = getCalculatorMaxHp(mawile, build);
    const projected = projectCalculatorSideToMega({
      member: mawile,
      build,
      battle: createCalculatorBattleState(Math.floor(maxHp / 2)),
      moves: [],
      maxHp,
      megaEvolution: { member: megaMember, ability: "Huge Power" },
    });

    expect(projected).toMatchObject({
      member: { id: "mawile-mega", baseStats: megaStats },
      build: { ability: "Huge Power" },
      megaEvolution: undefined,
    });
    expect(Math.abs(
      (projected?.battle.currentHp ?? 0) - (projected?.maxHp ?? 0) / 2,
    )).toBeLessThanOrEqual(1);
  });
});
