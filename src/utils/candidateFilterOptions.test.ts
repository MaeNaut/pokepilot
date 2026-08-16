import { describe, expect, it } from "vitest";
import type { PokemonCandidateFilters, PokemonMove } from "../types";
import {
  filterCandidateOptionsByQuery,
  getCandidateAbilityOptions,
  getCandidateMoveOptions,
  getSelectedCandidateMoveOptions,
  indexCandidateMoves,
} from "./candidateFilterOptions";

const pokemonOptions = [
  {
    types: ["fire", "flying"] as const,
    abilityOptions: [
      { id: "blaze", name: "Blaze" },
      { id: "solarpower", name: "Solar Power" },
    ],
    moveIds: ["heatwave", "tailwind", "protect"],
  },
  {
    types: ["water"] as const,
    abilityOptions: [{ id: "drizzle", name: "Drizzle" }],
    moveIds: ["hydropump", "tailwind", "protect"],
  },
];

const moveIndex: PokemonMove[] = [
  {
    id: "heatwave",
    name: "Heat Wave",
    type: "fire",
    category: "Special",
    power: 95,
    accuracy: 90,
    pp: 10,
    description: "",
  },
  {
    id: "tailwind",
    name: "Tailwind",
    type: "flying",
    category: "Status",
    power: null,
    accuracy: null,
    pp: 15,
    description: "",
  },
  {
    id: "protect",
    name: "Protect",
    type: "normal",
    category: "Status",
    power: null,
    accuracy: null,
    pp: 10,
    description: "",
  },
];

const emptyFilters: PokemonCandidateFilters = {
  types: [],
  ability: null,
  moves: [],
};

describe("candidate filter options", () => {
  it("collects unique abilities from Pokemon that match the other filters", () => {
    expect(
      getCandidateAbilityOptions(pokemonOptions, {
        ...emptyFilters,
        types: ["fire"],
      }),
    ).toEqual([
      { id: "blaze", name: "Blaze" },
      { id: "solarpower", name: "Solar Power" },
    ]);
  });

  it("keeps the edited move slot replaceable while retaining other filters", () => {
    const moveById = indexCandidateMoves(moveIndex);
    const filters: PokemonCandidateFilters = {
      ...emptyFilters,
      types: ["fire"],
      moves: [{ id: "heatwave", name: "Heat Wave" }],
    };

    expect(
      getCandidateMoveOptions(
        pokemonOptions,
        filters,
        0,
        moveById,
        (_, fallback) => fallback,
      ).map((move) => move.id),
    ).toEqual(["heatwave", "protect", "tailwind"]);
    expect(getSelectedCandidateMoveOptions(filters, moveById)[0]).toMatchObject({
      id: "heatwave",
      type: "fire",
      power: 95,
    });
  });

  it("filters localized labels and canonical ids", () => {
    const options = [
      { id: "heatwave", name: "Heat Wave" },
      { id: "tailwind", name: "Tailwind" },
    ];

    expect(filterCandidateOptionsByQuery(options, "heat")).toEqual([
      options[0],
    ]);
    expect(filterCandidateOptionsByQuery(options, "tailwind")).toEqual([
      options[1],
    ]);
  });
});
