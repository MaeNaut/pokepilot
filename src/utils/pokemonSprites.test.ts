import { describe, expect, it } from "vitest";
import {
  getPokeApiChampionsSpriteUrl,
  getPokeApiChampionsSpriteUrlFromKnownSprites,
  getKnownPokemonArtworkUrl,
  getKnownPokemonIconUrl,
  showKnownPokemonArtworkFallback,
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

  it("uses the correct fallback art and icon for gendered forms", () => {
    expect(getKnownPokemonArtworkUrl("meowstic-female"))
      .toContain("/official-artwork/10025.png");
    expect(getKnownPokemonIconUrl("meowstic-female-mega"))
      .toContain("/champions/10326.png");
    expect(getKnownPokemonArtworkUrl("pyroar-female"))
      .toContain("/home/female/668.png");
    expect(getKnownPokemonIconUrl("oinkologne-female"))
      .toContain("/pokemon/10254.png");
  });

  it("replaces a broken saved image once and then hides it if the fallback fails", () => {
    const image = { src: "https://example.test/broken.png", hidden: false } as HTMLImageElement;

    showKnownPokemonArtworkFallback(image, "meowstic-female");
    expect(image.src).toContain("/official-artwork/10025.png");
    expect(image.hidden).toBe(false);

    showKnownPokemonArtworkFallback(image, "meowstic-female");
    expect(image.hidden).toBe(true);
  });
});
