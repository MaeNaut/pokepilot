import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectedHiddenPickerForms,
  expectedVisiblePickerForms,
  pokemonIndexResponseFixture,
} from "../test/fixtures/pokemonFormFixtures";
import { fetchPokemonIndex } from "./pokeApi";

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

describe("PokeAPI Pokemon index normalization", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => pokemonIndexResponseFixture,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps selectable defaults and hides cosmetic or alternate battle states", async () => {
    const index = await fetchPokemonIndex();
    const byName = new Map(index.map((entry) => [entry.name, entry]));

    for (const pokemonId of expectedVisiblePickerForms) {
      expect(byName.get(pokemonId)?.isSelectorOption, pokemonId).toBe(true);
    }

    for (const pokemonId of expectedHiddenPickerForms) {
      expect(byName.get(pokemonId)?.isSelectorOption, pokemonId).toBe(false);
    }
  });

  it("uses clean display names for default battle-state forms", async () => {
    const index = await fetchPokemonIndex();
    const byName = new Map(index.map((entry) => [entry.name, entry]));

    expect(byName.get("aegislash-shield")?.displayName).toBe("Aegislash");
    expect(byName.get("mimikyu-disguised")?.displayName).toBe("Mimikyu");
    expect(byName.get("morpeko-full-belly")?.displayName).toBe("Morpeko");
    expect(byName.get("palafin-zero")?.displayName).toBe("Palafin");
  });

  it("creates Pyroar's visual female form but keeps one usage-backed picker entry", async () => {
    const index = await fetchPokemonIndex();
    const byName = new Map(index.map((entry) => [entry.name, entry]));

    expect(byName.get("pyroar-male")?.displayName).toBe("Pyroar");
    expect(byName.get("pyroar-male")?.isSelectorOption).toBe(true);
    expect(byName.get("pyroar-female")?.formKind).toBe("gender");
    expect(byName.get("pyroar-female")?.isSelectorOption).toBe(false);
  });
});
