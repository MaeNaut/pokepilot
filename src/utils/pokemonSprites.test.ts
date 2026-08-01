import { describe, expect, it } from "vitest";
import {
  getPokeApiChampionsSpriteUrl,
  getPokeApiChampionsSpriteUrlFromKnownSprites,
} from "./pokemonSprites";

describe("PokeAPI sprite URLs", () => {
  it("upgrades a previously saved Scarlet/Violet icon to its Champions URL", () => {
    expect(
      getPokeApiChampionsSpriteUrlFromKnownSprites([
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/560.png",
      ]),
    ).toBe(getPokeApiChampionsSpriteUrl(560));
  });

  it("can recover the Pokemon ID from saved official artwork", () => {
    expect(
      getPokeApiChampionsSpriteUrlFromKnownSprites([
        undefined,
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10289.png",
      ]),
    ).toBe(getPokeApiChampionsSpriteUrl(10289));
  });

  it("does not derive a Champions URL from unrelated sprite hosts", () => {
    expect(
      getPokeApiChampionsSpriteUrlFromKnownSprites([
        "https://play.pokemonshowdown.com/sprites/gen5/560.png",
      ]),
    ).toBeUndefined();
  });
});
