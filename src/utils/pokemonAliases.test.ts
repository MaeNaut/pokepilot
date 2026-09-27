import { describe, expect, it } from "vitest";
import { pokemonAliasFixtures } from "../test/fixtures/pokemonFormFixtures";
import {
  getPokemonLookupAliases,
  getPokeApiLookupId,
  getPreferredPokeApiId,
  shouldKeepSelectedPokemonForUsageTarget,
} from "./pokemonAliases";

describe("Pokemon lookup aliases", () => {
  it.each(pokemonAliasFixtures)(
    "maps $input to the expected lookup keys",
    ({ input, expectedAliases }) => {
      expect(getPokemonLookupAliases(input)).toEqual(
        expect.arrayContaining([...expectedAliases]),
      );
    },
  );

  it("maps battle-state base species to their preferred PokeAPI forms", () => {
    expect(getPreferredPokeApiId("Aegislash")).toBe("aegislash-shield");
    expect(getPreferredPokeApiId("Mimikyu")).toBe("mimikyu-disguised");
    expect(getPreferredPokeApiId("Morpeko")).toBe("morpeko-full-belly");
    expect(getPreferredPokeApiId("Palafin")).toBe("palafin-zero");
  });

  it("migrates saved Meowstic Mega IDs to their PokeAPI-compatible forms", () => {
    expect(getPreferredPokeApiId("meowstic-m-mega"))
      .toBe("meowstic-male-mega");
    expect(getPreferredPokeApiId("meowstic-f-mega"))
      .toBe("meowstic-female-mega");
  });

  it("does not resolve base Pyroar through its Mega form", () => {
    expect(getPokemonLookupAliases("pyroar-male")).toContain("pyroar");
    expect(getPokemonLookupAliases("pyroar-male")).not.toContain("pyroarmega");
  });

  it.each([
    ["furfrou-natural", "furfrou"],
    ["gourgeist-average", "gourgeist"],
    ["lycanroc-midday", "lycanroc"],
  ])("resolves the default %s form to Showdown's %s species", (form, species) => {
    expect(getPokemonLookupAliases(form)).toContain(species);
  });

  it("keeps asset-only PokeAPI form IDs out of canonical Pokemon IDs", () => {
    expect(getPokeApiLookupId("Furfrou Natural")).toBe("furfrou");
    expect(getPreferredPokeApiId("Toxtricity")).toBeUndefined();
    expect(getPokeApiLookupId("Toxtricity")).toBe("toxtricity-amped");
    expect(getPreferredPokeApiId("Squawkabilly Yellow")).toBeUndefined();
    expect(getPokeApiLookupId("Squawkabilly Yellow")).toBe(
      "squawkabilly-yellow-plumage",
    );
  });

  it("folds cosmetic Squawkabilly colors into their mechanical representatives", () => {
    expect(getPokemonLookupAliases("Squawkabilly-Blue")).toContain(
      "squawkabilly",
    );
    expect(getPokemonLookupAliases("Squawkabilly-White")).toContain(
      "squawkabilly-yellow",
    );
  });

  it("keeps usage samples attached while switching equivalent battle forms", () => {
    expect(
      shouldKeepSelectedPokemonForUsageTarget("pyroar-female", "pyroar-male"),
    ).toBe(true);
    expect(
      shouldKeepSelectedPokemonForUsageTarget("aegislash-blade", "aegislash-shield"),
    ).toBe(true);
    expect(
      shouldKeepSelectedPokemonForUsageTarget("palafin-zero", "palafin-hero"),
    ).toBe(true);
    expect(
      shouldKeepSelectedPokemonForUsageTarget("morpeko-full-belly", "morpeko-hangry"),
    ).toBe(true);
    expect(
      shouldKeepSelectedPokemonForUsageTarget("rotom-wash", "rotom-heat"),
    ).toBe(false);
    expect(
      shouldKeepSelectedPokemonForUsageTarget("toxtricity", "toxtricity-low-key"),
    ).toBe(false);
    expect(
      shouldKeepSelectedPokemonForUsageTarget("indeedee-male", "indeedee-female"),
    ).toBe(false);
  });
});
