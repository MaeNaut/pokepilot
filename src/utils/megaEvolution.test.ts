import { describe, expect, it } from "vitest";
import type { ItemIndexEntry, PokemonIndexEntry } from "../types";
import {
  getRelevantMegaStoneNames,
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
