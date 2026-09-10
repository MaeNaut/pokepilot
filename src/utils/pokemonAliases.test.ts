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

  it("keeps asset-only PokeAPI form IDs out of canonical Pokemon IDs", () => {
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
