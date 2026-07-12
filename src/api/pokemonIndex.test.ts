import { describe, expect, it } from "vitest";
import {
  expectedHiddenPickerForms,
  expectedVisiblePickerForms,
  showdownPokemonIndexFixture,
} from "../test/fixtures/pokemonFormFixtures";
import { createPokemonIndex } from "./pokemonIndex";

describe("Showdown Pokemon index normalization", () => {
  const index = createPokemonIndex(showdownPokemonIndexFixture);
  const byName = new Map(index.map((entry) => [entry.name, entry]));

  it("keeps selectable defaults and hides cosmetic or alternate battle states", () => {
    for (const pokemonId of expectedVisiblePickerForms) {
      expect(byName.get(pokemonId)?.isSelectorOption, pokemonId).toBe(true);
    }

    for (const pokemonId of expectedHiddenPickerForms) {
      expect(byName.get(pokemonId)?.isSelectorOption, pokemonId).toBe(false);
    }
  });

  it("uses clean display names for default battle-state forms", () => {
    expect(byName.get("aegislash-shield")?.displayName).toBe("Aegislash");
    expect(byName.get("mimikyu-disguised")?.displayName).toBe("Mimikyu");
    expect(byName.get("morpeko-full-belly")?.displayName).toBe("Morpeko");
    expect(byName.get("palafin-zero")?.displayName).toBe("Palafin");
  });

  it("keeps Showdown IDs while preserving asset-compatible UI IDs", () => {
    expect(byName.get("farfetchd")?.showdownId).toBe("farfetchd");
    expect(byName.get("flabebe")?.showdownId).toBe("flabebe");
    expect(byName.get("mr-mime")?.showdownId).toBe("mrmime");
    expect(byName.get("tauros-paldea-aqua-breed")).toMatchObject({
      showdownId: "taurospaldeaaqua",
      speciesKey: "tauros",
      sortNumber: 128,
      formKind: "regional",
    });
    expect(byName.get("charizard-mega-x")).toMatchObject({
      showdownId: "charizardmegax",
      speciesKey: "charizard",
      formKind: "mega",
      isSelectorOption: false,
    });
  });

  it("creates Pyroar's visual female form but keeps one usage-backed picker entry", () => {
    expect(byName.get("pyroar-male")?.displayName).toBe("Pyroar");
    expect(byName.get("pyroar-male")?.isSelectorOption).toBe(true);
    expect(byName.get("pyroar-female")?.formKind).toBe("gender");
    expect(byName.get("pyroar-female")?.isSelectorOption).toBe(false);
  });
});
