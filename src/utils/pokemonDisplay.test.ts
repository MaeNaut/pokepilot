import { describe, expect, it } from "vitest";
import type { PokemonIndexEntry } from "../types";
import {
  getPokemonNameFallback,
  shouldIncludePokemonForm,
} from "./pokemonDisplay";

function entry(
  patch: Partial<PokemonIndexEntry> & Pick<PokemonIndexEntry, "name">,
): PokemonIndexEntry {
  return {
    showdownId: patch.name.replace(/-/g, ""),
    displayName: patch.name,
    speciesKey: patch.name,
    sortNumber: 1,
    types: [],
    abilities: [],
    formKind: "base",
    isSelectorOption: true,
    ...patch,
  };
}

describe("Pokemon form display", () => {
  it.each([
    entry({ name: "indeedee-female", displayName: "Indeedee Female", speciesKey: "indeedee", formKind: "gender", formLabel: "Female" }),
    entry({ name: "rotom-wash", displayName: "Rotom Wash", speciesKey: "rotom", formKind: "form", formLabel: "Wash" }),
    entry({ name: "persian-alola", displayName: "Persian Alola", speciesKey: "persian", formKind: "regional", formLabel: "Alola" }),
    entry({ name: "toxtricity", displayName: "Toxtricity", speciesKey: "toxtricity", formLabel: "Amped" }),
    entry({ name: "squawkabilly", displayName: "Squawkabilly", speciesKey: "squawkabilly", formLabel: "Green" }),
  ])("includes the fixed form for $name", (candidate) => {
    expect(shouldIncludePokemonForm(candidate)).toBe(true);
  });

  it.each([
    entry({ name: "aegislash-shield", displayName: "Aegislash", speciesKey: "aegislash", formKind: "form", formLabel: "Shield" }),
    entry({ name: "lucario-mega-z", displayName: "Lucario Mega Z", speciesKey: "lucario", formKind: "mega", formLabel: "Mega Z" }),
  ])("keeps battle states behind their dedicated control for $name", (candidate) => {
    expect(shouldIncludePokemonForm(candidate)).toBe(false);
  });

  it("adds labels to named default forms without duplicating other forms", () => {
    expect(getPokemonNameFallback(entry({ name: "toxtricity", displayName: "Toxtricity", speciesKey: "toxtricity", formLabel: "Amped" }))).toBe("Toxtricity Amped");
    expect(getPokemonNameFallback(entry({ name: "toxtricity-low-key", displayName: "Toxtricity Low Key", speciesKey: "toxtricity", formKind: "form", formLabel: "Low Key" }))).toBe("Toxtricity Low Key");
  });
});
