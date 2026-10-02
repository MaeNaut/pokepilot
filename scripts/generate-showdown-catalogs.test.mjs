import { describe, expect, it } from "vitest";
import { buildRegulationMcSnapshot } from "./generate-showdown-catalogs.mjs";

function input() {
  const filler = Object.fromEntries(Array.from({ length: 55 }, (_, index) => [`filler${index}`, {
    name: `Filler${index}`, abilities: { 0: "Pressure" },
  }]));
  const pokedex = {
    ...filler,
    meowstic: { name: "Meowstic", abilities: { H: "Prankster" } },
    meowsticf: { name: "Meowstic-F", baseSpecies: "Meowstic", gender: "F", abilities: { H: "Competitive" } },
    gourgeist: { name: "Gourgeist", abilities: { 0: "Frisk" } },
    gourgeistlarge: { name: "Gourgeist-Large", baseSpecies: "Gourgeist", abilities: { 0: "Frisk" } },
  };
  const pokemon = Object.keys(pokedex).filter((id) => id !== "meowsticf");
  return {
    pokedex,
    baseLearnsets: Object.fromEntries(pokemon.map((id) => [id, { learnset: { tackle: ["9L1"] } }])),
    championsFormatsText: `export const FormatsData = { ${pokemon.map((id) => `${id}: { tier: "OU" },`).join("\n")} };`,
    championsLearnsetsText: `export const Learnsets = {
      meowsticf: {
        learnset: {
          expandingforce: ['9M'],
        },
      },
      gourgeist: {
        learnset: {
          curse: ['9M'],
          poltergeist: ['9M'],
        },
      },
    };`,
    championsItemsText: "export const Items = {};",
    teambuilderTablesText: `JSON.parse('${JSON.stringify({ champions: { items: Array.from({ length: 25 }, (_, i) => `item${i}`) } })}');`,
  };
}

describe("Champions form catalog generation", () => {
  it("retains female-only abilities and learnsets when format data inherits the male species", () => {
    const snapshot = buildRegulationMcSnapshot(input());
    expect(snapshot.pokemonIds).toContain("meowsticf");
    expect(new Map(snapshot.abilityByPokemon).get("meowsticf")).toEqual(["competitive"]);
    expect(new Map(snapshot.moveByPokemon).get("meowsticf")).toEqual(["expandingforce"]);
  });
  it("inherits Champions form moves instead of outdated base-game learnsets", () => {
    const snapshot = buildRegulationMcSnapshot(input());
    expect(new Map(snapshot.moveByPokemon).get("gourgeistlarge")).toEqual(["curse", "poltergeist"]);
  });
});
