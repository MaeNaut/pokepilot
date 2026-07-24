import { describe, expect, it } from "vitest";
import {
  getBaseUsageLookup,
  orderPokemonOptionsByUsage,
} from "./pokemonUsageOrder";

describe("getBaseUsageLookup", () => {
  it("falls Mega usage IDs back to their base species", () => {
    expect(getBaseUsageLookup("charizard-mega-x")).toBe("charizard");
  });

  it("preserves regional species IDs", () => {
    expect(getBaseUsageLookup("raichu-alola")).toBe("raichu-alola");
  });
});

describe("orderPokemonOptionsByUsage", () => {
  const options = [
    { id: "charizard", label: "Charizard" },
    { id: "raichu-alola", label: "Raichu-Alola" },
    { id: "mimikyu-disguised", label: "Mimikyu" },
  ];

  it("orders exact forms first and retains unmatched options", () => {
    const result = orderPokemonOptionsByUsage(options, [
      "raichu-alola",
      "mimikyu",
    ]);

    expect(result.orderedOptions.map((option) => option.id)).toEqual([
      "raichu-alola",
      "mimikyu-disguised",
      "charizard",
    ]);
    expect(result.rankByOptionId.get("raichu-alola")).toBe(1);
    expect(result.rankByOptionId.get("mimikyu-disguised")).toBe(2);
  });

  it("uses the base species when a usage Mega is not selectable", () => {
    const result = orderPokemonOptionsByUsage(options, [
      "charizard-mega-x",
    ]);

    expect(result.orderedOptions[0].id).toBe("charizard");
    expect(result.rankByOptionId.get("charizard")).toBe(1);
  });

  it("does not duplicate options matched by multiple usage aliases", () => {
    const result = orderPokemonOptionsByUsage(options, [
      "mimikyu",
      "mimikyu-disguised",
    ]);

    expect(
      result.orderedOptions.filter((option) => option.id === "mimikyu-disguised"),
    ).toHaveLength(1);
    expect(result.rankByOptionId.get("mimikyu-disguised")).toBe(1);
  });
});
