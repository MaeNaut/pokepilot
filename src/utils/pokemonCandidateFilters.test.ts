import { describe, expect, it } from "vitest";
import type { PokemonCandidateFilters } from "../types";
import {
  matchesPokemonCandidateFilters,
  matchesPokemonTypeFilters,
  normalizePokemonCandidateFilters,
  togglePokemonTypeFilter,
} from "./pokemonCandidateFilters";

describe("Pokemon candidate type filters", () => {
  it("matches no filter, either single type, and an order-independent dual type", () => {
    const candidateTypes = ["water", "ground"] as const;

    expect(matchesPokemonTypeFilters(candidateTypes, [])).toBe(true);
    expect(matchesPokemonTypeFilters(candidateTypes, ["water"])).toBe(true);
    expect(matchesPokemonTypeFilters(candidateTypes, ["ground", "water"])).toBe(true);
    expect(matchesPokemonTypeFilters(candidateTypes, ["water", "flying"])).toBe(false);
  });

  it("adds, removes, and caps preselected filters at two types", () => {
    expect(togglePokemonTypeFilter([], "fire")).toEqual(["fire"]);
    expect(togglePokemonTypeFilter(["fire"], "flying")).toEqual(["fire", "flying"]);
    expect(togglePokemonTypeFilter(["fire", "flying"], "dragon")).toEqual([
      "fire",
      "flying",
    ]);
    expect(togglePokemonTypeFilter(["fire", "flying"], "fire")).toEqual([
      "flying",
    ]);
  });

  it("requires the selected type, ability, and every selected move", () => {
    const candidate = {
      types: ["fire", "flying"] as const,
      abilityIds: ["blaze", "solarpower"],
      moveIds: ["heatwave", "tailwind", "protect"],
    };
    const filters: PokemonCandidateFilters = {
      types: ["fire"],
      ability: { id: "solarpower", name: "Solar Power" },
      moves: [
        { id: "heatwave", name: "Heat Wave" },
        { id: "tailwind", name: "Tailwind" },
      ],
    };

    expect(matchesPokemonCandidateFilters(candidate, filters)).toBe(true);
    expect(
      matchesPokemonCandidateFilters(candidate, {
        ...filters,
        moves: [...filters.moves, { id: "fakeout", name: "Fake Out" }],
      }),
    ).toBe(false);
  });

  it("normalizes saved candidate filters to supported limits", () => {
    expect(
      normalizePokemonCandidateFilters({
        types: ["fire", "fire", "flying", "dragon"],
        ability: { id: "blaze", name: "Blaze" },
        moves: [
          { id: "one", name: "One" },
          { id: "two", name: "Two" },
          { id: "two", name: "Two" },
          { id: "three", name: "Three" },
          { id: "four", name: "Four" },
          { id: "five", name: "Five" },
        ],
      }),
    ).toMatchObject({
      types: ["fire", "flying"],
      ability: { id: "blaze", name: "Blaze" },
      moves: [
        { id: "one", name: "One" },
        { id: "two", name: "Two" },
        { id: "three", name: "Three" },
        { id: "four", name: "Four" },
      ],
    });
  });
});
