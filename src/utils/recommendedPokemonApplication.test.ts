import { describe, expect, it } from "vitest";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
} from "../types";
import {
  createEmptyBuildState,
  patchBuildStateSlot,
} from "./teamBuildState";
import { validateRecommendedPokemonApplication } from "./recommendedPokemonApplication";

function createMember(id: string, ability: string): TeamMember {
  return {
    id,
    name: id,
    types: id === "pelipper" ? ["water", "flying"] : ["water", "ground"],
    roles: [],
    abilities: [ability],
    moves: [
      {
        id: id === "pelipper" ? "hurricane" : "earthquake",
        name: id === "pelipper" ? "Hurricane" : "Earthquake",
        type: id === "pelipper" ? "flying" : "ground",
        category: "special",
        power: 100,
        accuracy: 100,
        pp: 10,
        description: "",
      },
    ],
  };
}

const pelipper = createMember("pelipper", "Drizzle");
const swampert = createMember("swampert", "Torrent");

const pokemonIndex: PokemonIndexEntry[] = [
  {
    name: "pelipper",
    showdownId: "pelipper",
    displayName: "Pelipper",
    speciesKey: "pelipper",
    sortNumber: 279,
    types: ["water", "flying"],
    abilities: ["Drizzle"],
    formKind: "base",
    isSelectorOption: true,
  },
  {
    name: "swampert",
    showdownId: "swampert",
    displayName: "Swampert",
    speciesKey: "swampert",
    sortNumber: 260,
    types: ["water", "ground"],
    abilities: ["Torrent"],
    formKind: "base",
    isSelectorOption: true,
  },
];

const itemIndex: ItemIndexEntry[] = [
  {
    id: 1,
    name: "focus-sash",
    showdownId: "focussash",
    displayName: "Focus Sash",
    isMegaStone: false,
  },
];

const choiceBand: ItemIndexEntry = {
  id: 2,
  name: "choice-band",
  showdownId: "choiceband",
  displayName: "Choice Band",
  isMegaStone: false,
};

function createLegality(
  overrides: Partial<ShowdownLegalitySnapshot> = {},
): ShowdownLegalitySnapshot {
  return {
    pokemonIds: new Set(["pelipper", "swampert"]),
    knownPokemonIds: new Set(["pelipper", "swampert"]),
    itemIds: new Set(["focussash"]),
    abilityByPokemon: new Map([
      ["pelipper", new Set(["drizzle"])],
      ["swampert", new Set(["torrent"])],
    ]),
    moveByPokemon: new Map([
      ["pelipper", new Set(["hurricane"])],
      ["swampert", new Set(["earthquake"])],
    ]),
    loadedFormatId: "gen9-regulation-mb",
    dataMod: "champions",
    generatedAt: 1,
    source: "showdown",
    ...overrides,
  };
}

function createTeam(): TeamSlot[] {
  return [swampert, null, null, null, null, null];
}

function createPelipperBuildState() {
  return patchBuildStateSlot(createEmptyBuildState(), 1, {
    item: { id: "focus-sash", name: "Focus Sash" },
    ability: "Drizzle",
    nature: "timid",
    moveIds: ["hurricane"],
  });
}

describe("recommended Pokemon application validation", () => {
  it("accepts a legal candidate and popular-set patch", () => {
    const result = validateRecommendedPokemonApplication({
      currentTeam: createTeam(),
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState: createPelipperBuildState(),
      legality: createLegality(),
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("valid");
    expect(result.proposedTeam[1]?.id).toBe("pelipper");
  });

  it("blocks stale recommendations when the target slot is no longer empty", () => {
    const result = validateRecommendedPokemonApplication({
      currentTeam: [swampert, pelipper, null, null, null, null],
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState: createPelipperBuildState(),
      legality: createLegality(),
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("stale-target");
    }
  });

  it("blocks a recommendation whose target slot no longer exists", () => {
    const result = validateRecommendedPokemonApplication({
      currentTeam: createTeam(),
      slotIndex: 6,
      candidate: pelipper,
      proposedBuildState: createPelipperBuildState(),
      legality: createLegality(),
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("stale-target");
    }
  });

  it("blocks illegal popular-set elements before mutating the team", () => {
    const proposedBuildState = patchBuildStateSlot(
      createPelipperBuildState(),
      1,
      {
        item: { id: "choice-band", name: "Choice Band" },
        ability: "Keen Eye",
        moveIds: ["earthquake"],
      },
    );
    const result = validateRecommendedPokemonApplication({
      currentTeam: createTeam(),
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState,
      legality: createLegality(),
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("invalid");
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["illegal-item", "illegal-ability", "illegal-move"]),
      );
    }
  });

  it("blocks an illegal candidate Pokemon even when its set is otherwise valid", () => {
    const result = validateRecommendedPokemonApplication({
      currentTeam: createTeam(),
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState: createPelipperBuildState(),
      legality: createLegality({ pokemonIds: new Set(["swampert"]) }),
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("invalid");
      expect(result.issues.map((issue) => issue.code)).toContain(
        "illegal-pokemon",
      );
    }
  });

  it("blocks Species Clause and Item Clause conflicts introduced by the slot", () => {
    const currentTeam: TeamSlot[] = [
      swampert,
      null,
      pelipper,
      null,
      null,
      null,
    ];
    const existingBuildState = patchBuildStateSlot(
      createEmptyBuildState(),
      2,
      { item: { id: "focus-sash", name: "Focus Sash" } },
    );
    const result = validateRecommendedPokemonApplication({
      currentTeam,
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState: patchBuildStateSlot(existingBuildState, 1, {
        item: { id: "focus-sash", name: "Focus Sash" },
        ability: "Drizzle",
      }),
      legality: createLegality(),
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["duplicate-species", "duplicate-item"]),
      );
    }
  });

  it("blocks application when legality cannot be verified", () => {
    const result = validateRecommendedPokemonApplication({
      currentTeam: createTeam(),
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState: createPelipperBuildState(),
      legality: null,
      pokemonIndex,
      itemIndex,
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("legality-unavailable");
      expect(result.issues.map((issue) => issue.code)).toContain(
        "legality-unavailable",
      );
    }
  });

  it("ignores an unrelated existing-slot issue for a legal candidate", () => {
    const existingBuildState = patchBuildStateSlot(createEmptyBuildState(), 0, {
      item: { id: "choice-band", name: "Choice Band" },
    });
    const result = validateRecommendedPokemonApplication({
      currentTeam: createTeam(),
      slotIndex: 1,
      candidate: pelipper,
      proposedBuildState: patchBuildStateSlot(existingBuildState, 1, {
        ability: "Drizzle",
        moveIds: ["hurricane"],
      }),
      legality: createLegality(),
      pokemonIndex,
      itemIndex: [...itemIndex, choiceBand],
    });

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.validity.status).toBe("invalid");
      expect(
        result.validity.slotResults[0].issues.map((issue) => issue.code),
      ).toContain("illegal-item");
    }
  });
});
