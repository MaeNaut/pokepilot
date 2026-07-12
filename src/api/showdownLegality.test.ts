import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { regulationMbSnapshotFixture } from "../test/fixtures/showdownLegalityFixtures";
import {
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

});
