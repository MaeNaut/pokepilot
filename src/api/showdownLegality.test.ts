import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  championsFormatsDataFixture,
  championsItemsFixture,
  championsLearnsetsFixture,
  showdownBaseLearnsetsFixture,
  showdownPokedexFixture,
} from "../test/fixtures/showdownLegalityFixtures";
import {
  getLegalAbilities,
  getLegalMoves,
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
    text: async () => String(payload),
  } as Response;
}

describe("Showdown Regulation M-B snapshot parsing", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.endsWith("/pokedex.json")) {
          return createFetchResponse(showdownPokedexFixture);
        }

        if (url.endsWith("/learnsets.json")) {
          return createFetchResponse(showdownBaseLearnsetsFixture);
        }

        if (url.endsWith("/formats-data.ts")) {
          return createFetchResponse(championsFormatsDataFixture);
        }

        if (url.endsWith("/learnsets.ts")) {
          return createFetchResponse(championsLearnsetsFixture);
        }

        if (url.endsWith("/items.ts")) {
          return createFetchResponse(championsItemsFixture);
        }

        if (url.endsWith("/teambuilder-tables.js")) {
          return createFetchResponse("no fixture table");
        }

        throw new Error(`Unexpected fixture URL: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a deterministic Champions legality snapshot from raw source fixtures", async () => {
    const snapshot = await loadShowdownLegality("gen9championsvgc2026regmb");

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.dataMod).toBe("champions");
    expect(isPokemonLegal(snapshot, "rotom-wash", "rotom")).toBe(true);
    expect(isPokemonLegal(snapshot, "floette-eternal", "floette")).toBe(true);
    expect(isPokemonLegal(snapshot, "garchomp-mega-z", "garchomp")).toBe(false);
    expect(isItemLegal(snapshot, "leftovers")).toBe(true);
    expect(isItemLegal(snapshot, "focus-sash")).toBe(true);
    expect(isItemLegal(snapshot, "choice-band")).toBe(false);
  });

  it("combines form-specific Champions moves with the base species learnset", async () => {
    const snapshot = await loadShowdownLegality("gen9championsvgc2026regmb");
    const moves = getLegalMoves(snapshot, "rotom-wash", "rotom");

    expect(moves).toEqual(
      new Set(["hydropump", "thunderbolt", "protect", "shadowball"]),
    );
    expect(getLegalAbilities(snapshot, "rotom-wash", "rotom")).toEqual(
      new Set(["levitate"]),
    );
  });

  it("preserves Champions-only signature moves for exceptional forms", async () => {
    const snapshot = await loadShowdownLegality("gen9championsvgc2026regmb");
    const moves = getLegalMoves(snapshot, "floette-eternal", "floette");

    expect(moves).toEqual(new Set(["lightofruin", "moonblast"]));
    expect(moves?.has("lightofruin")).toBe(true);
    expect(moves?.has("moonblast")).toBe(true);
  });
});
