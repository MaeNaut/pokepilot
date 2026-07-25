import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { regulationMbSnapshotFixture } from "../test/fixtures/showdownLegalityFixtures";
import {
  getPokemonCandidateAbilities,
  getLegalAbilities,
  getLegalMoves,
  hydrateShowdownLegalitySnapshot,
  isItemLegal,
  isPokemonLegal,
  loadShowdownLegality,
} from "./showdownLegality";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createFetchResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

describe("Showdown Regulation M-B compact snapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.endsWith("/data/showdown-regulation-mb.json")) {
          return createFetchResponse(regulationMbSnapshotFixture);
        }

        throw new Error(`Unexpected fixture URL: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the compact snapshot once and reuses it for the session", async () => {
    const [snapshot, duplicateSnapshot] = await Promise.all([
      loadShowdownLegality("gen9championsvgc2026regmb"),
      loadShowdownLegality("gen9championsvgc2026regmb"),
    ]);
    const reusedSnapshot = await loadShowdownLegality("gen9-regulation-mb");

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.dataMod).toBe("champions");
    expect(duplicateSnapshot.pokemonIds).toBe(snapshot.pokemonIds);
    expect(reusedSnapshot.pokemonIds).toBe(snapshot.pokemonIds);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(isPokemonLegal(snapshot, "rotom-wash", "rotom")).toBe(true);
    expect(isPokemonLegal(snapshot, "floette-eternal", "floette")).toBe(true);
    expect(isPokemonLegal(snapshot, "garchomp-mega-z", "garchomp")).toBe(false);
    expect(isItemLegal(snapshot, "leftovers")).toBe(true);
    expect(isItemLegal(snapshot, "focus-sash")).toBe(true);
    expect(isItemLegal(snapshot, "choice-band")).toBe(false);
  });

  it("combines form-specific moves with the base species map", () => {
    const snapshot = hydrateShowdownLegalitySnapshot(
      regulationMbSnapshotFixture,
    );
    const moves = getLegalMoves(snapshot, "rotom-wash", "rotom");

    expect(moves).toEqual(
      new Set(["hydropump", "thunderbolt", "protect", "shadowball"]),
    );
    expect(getLegalAbilities(snapshot, "rotom-wash", "rotom")).toEqual(
      new Set(["levitate"]),
    );
  });

  it("preserves Champions-only signature moves for exceptional forms", () => {
    const snapshot = hydrateShowdownLegalitySnapshot(
      regulationMbSnapshotFixture,
    );
    const moves = getLegalMoves(snapshot, "floette-eternal", "floette");

    expect(moves).toEqual(new Set(["lightofruin", "moonblast"]));
    expect(getLegalMoves(snapshot, "floette-mega", "floette")).toEqual(
      new Set(["lightofruin", "moonblast"]),
    );
  });

  it("does not truncate hyphenated base species into a false lookup key", () => {
    const snapshot = hydrateShowdownLegalitySnapshot({
      ...regulationMbSnapshotFixture,
      moveByPokemon: [
        ...regulationMbSnapshotFixture.moveByPokemon,
        ["mrmime", ["protect"]],
        ["mr", ["shadowball"]],
      ],
    });

    expect(getLegalMoves(snapshot, "mr-mime", "mr-mime")).toEqual(
      new Set(["protect"]),
    );
  });

  it("exposes legal Mega-only abilities through base Pokemon candidate filters", () => {
    const snapshot = hydrateShowdownLegalitySnapshot({
      ...regulationMbSnapshotFixture,
      pokemonIds: [
        ...regulationMbSnapshotFixture.pokemonIds,
        "eelektross",
        "eelektrossmega",
        "slowbrogalar",
        "slowbromega",
        "victreebel",
        "victreebelmega",
      ],
      knownPokemonIds: [
        ...regulationMbSnapshotFixture.knownPokemonIds,
        "eelektross",
        "eelektrossmega",
        "slowbrogalar",
        "slowbromega",
        "victreebel",
        "victreebelmega",
      ],
      abilityByPokemon: [
        ...regulationMbSnapshotFixture.abilityByPokemon,
        ["eelektross", ["levitate"]],
        ["eelektrossmega", ["eelevate"]],
        ["slowbrogalar", ["quickdraw"]],
        ["slowbromega", ["shellarmor"]],
        ["victreebel", ["chlorophyll"]],
        ["victreebelmega", ["innardsout"]],
      ],
    });
    const pokemonIndex = [
      {
        name: "eelektross",
        showdownId: "eelektross",
        displayName: "Eelektross",
        speciesKey: "eelektross",
        sortNumber: 604,
        types: ["electric"],
        abilities: ["Levitate"],
        formKind: "base",
        isSelectorOption: true,
      },
      {
        name: "eelektross-mega",
        showdownId: "eelektrossmega",
        displayName: "Eelektross Mega",
        speciesKey: "eelektross",
        sortNumber: 604,
        types: ["electric"],
        abilities: ["Eelevate"],
        formKind: "mega",
        isSelectorOption: false,
      },
      {
        name: "victreebel",
        showdownId: "victreebel",
        displayName: "Victreebel",
        speciesKey: "victreebel",
        sortNumber: 71,
        types: ["grass", "poison"],
        abilities: ["Chlorophyll"],
        formKind: "base",
        isSelectorOption: true,
      },
      {
        name: "victreebel-mega",
        showdownId: "victreebelmega",
        displayName: "Victreebel Mega",
        speciesKey: "victreebel",
        sortNumber: 71,
        types: ["grass", "poison"],
        abilities: ["Innards Out"],
        formKind: "mega",
        isSelectorOption: false,
      },
      {
        name: "slowbro-galar",
        showdownId: "slowbrogalar",
        displayName: "Slowbro Galar",
        speciesKey: "slowbro",
        sortNumber: 80,
        types: ["poison", "psychic"],
        abilities: ["Quick Draw"],
        formKind: "regional",
        isSelectorOption: true,
      },
      {
        name: "slowbro-mega",
        showdownId: "slowbromega",
        displayName: "Slowbro Mega",
        speciesKey: "slowbro",
        sortNumber: 80,
        types: ["water", "psychic"],
        abilities: ["Shell Armor"],
        formKind: "mega",
        isSelectorOption: false,
      },
    ] satisfies import("../types").PokemonIndexEntry[];

    expect(
      getPokemonCandidateAbilities(snapshot, pokemonIndex[0], pokemonIndex).map(
        (ability) => ability.id,
      ),
    ).toEqual(["levitate", "eelevate"]);
    expect(
      getPokemonCandidateAbilities(snapshot, pokemonIndex[2], pokemonIndex).map(
        (ability) => ability.id,
      ),
    ).toEqual(["chlorophyll", "innardsout"]);
    expect(
      getPokemonCandidateAbilities(snapshot, pokemonIndex[4], pokemonIndex).map(
        (ability) => ability.id,
      ),
    ).toEqual(["quickdraw"]);
  });

});
