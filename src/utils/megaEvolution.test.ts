import { describe, expect, it } from "vitest";
import type { ItemIndexEntry, PokemonIndexEntry, PokemonItem } from "../types";
import {
  getRelevantMegaStoneNames,
  getMegaEvolutionIndexEntry,
  prioritizeMegaStoneItems,
} from "./megaEvolution";

describe("relevant Mega Stones", () => {
  const pokemonIndex = [
    { name: "lucario", speciesKey: "lucario", formKind: "base" },
    { name: "lucario-mega", speciesKey: "lucario", formKind: "mega", showdownId: "lucariomega" },
    { name: "lucario-mega-z", speciesKey: "lucario", formKind: "mega", showdownId: "lucariomegaz" },
    { name: "scizor-mega", speciesKey: "scizor", formKind: "mega", showdownId: "scizormega" },
  ] as PokemonIndexEntry[];
  const stones = new Set(["lucarioite", "lucarioite-z", "scizorite"]);

  it.each(["x", "y"])("preserves compact %s suffixes for split Mega forms", (suffix) => {
    const index = [
      { name: "charizard", speciesKey: "charizard", formKind: "base" },
      { name: "charizard-mega-x", speciesKey: "charizard", formKind: "mega" },
      { name: "charizard-mega-y", speciesKey: "charizard", formKind: "mega" },
    ] as PokemonIndexEntry[];
    const item = { id: `charizardite${suffix}`, name: `Charizardite ${suffix.toUpperCase()}` } as PokemonItem;
    expect(getMegaEvolutionIndexEntry("charizard", item, index)?.name)
      .toBe(`charizard-mega-${suffix}`);
  });

  it.each(["Lucarionite Z", "lucarionite-z", "lucarionitez"])(
    "does not confuse the Z stone %s with the ordinary Mega form",
    (name) => {
      const item = { id: "lucarionitez", showdownId: "lucarionitez", name } as PokemonItem;
      expect(getMegaEvolutionIndexEntry("lucario", item, pokemonIndex)?.name)
        .toBe("lucario-mega-z");
      expect(getMegaEvolutionIndexEntry("lucario", { id: "lucarionite", name: "Lucarionite" } as PokemonItem, pokemonIndex)?.name)
        .toBe("lucario-mega");
    },
  );

  it("finds both stones while the base form is selected", () => {
    expect(getRelevantMegaStoneNames("lucario", pokemonIndex, stones, null))
      .toEqual(new Set(["lucarioite", "lucarioite-z"]));
  });

  it("places relevant stones before other items without reordering the rest", () => {
    const items = [
      { name: "life-orb" },
      { name: "lucarioite-z" },
      { name: "leftovers" },
      { name: "lucarioite" },
    ] as ItemIndexEntry[];
    const ordered = prioritizeMegaStoneItems(items, new Set(["lucarioite", "lucarioite-z"]));
    expect(ordered.map((item) => item.name)).toEqual([
      "lucarioite-z", "lucarioite", "life-orb", "leftovers",
    ]);
    expect(items[0].name).toBe("life-orb");
  });
});
