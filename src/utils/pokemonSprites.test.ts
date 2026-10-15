import { describe, expect, it } from "vitest";
import {
  getPokeApiChampionsSpriteUrl,
  getPokeApiChampionsSpriteUrlFromKnownSprites,
  getKnownPokemonArtworkUrl,
  getKnownPokemonIconUrl,
  showKnownPokemonArtworkFallback,
  normalizePokeApiGenerationNineSpriteUrl,
} from "./pokemonSprites";

describe("PokeAPI sprite URLs", () => {
  it("uses generation-nine menu icons instead of 3D renders", () => {
    expect(getPokeApiChampionsSpriteUrl(445)).toContain("/champions/icons/445.png");
  });

  it("normalizes saved render paths to menu icons without changing gender, query or artwork", () => {
    const base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
    expect(normalizePokeApiGenerationNineSpriteUrl(`${base}/versions/generation-ix/scarlet-violet/female/668.png?v=1#icon`))
      .toBe(`${base}/versions/generation-ix/scarlet-violet/icons/668-female.png?v=1#icon`);
    const iconUrl = `${base}/versions/generation-ix/champions/icons/445.png`;
    expect(normalizePokeApiGenerationNineSpriteUrl(iconUrl)).toBe(iconUrl);
    expect(normalizePokeApiGenerationNineSpriteUrl(`${base}/versions/generation-ix/champions/445.webp`))
      .toBe(iconUrl);
    expect(normalizePokeApiGenerationNineSpriteUrl(`${base}/other/official-artwork/445.png`))
      .toBe(`${base}/other/official-artwork/445.png`);
    expect(normalizePokeApiGenerationNineSpriteUrl("https://example.test/generation-ix/445.png"))
      .toBe("https://example.test/generation-ix/445.png");
  });

  it("recovers the ID from new WebP icons as well as old PNGs", () => {
    expect(getPokeApiChampionsSpriteUrlFromKnownSprites([
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/730.webp",
    ])).toBe(getPokeApiChampionsSpriteUrl(730));
  });
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
      .toContain("/champions/icons/10326.png");
    expect(getKnownPokemonArtworkUrl("pyroar-female"))
      .toContain("/home/female/668.png");
    expect(getKnownPokemonIconUrl("oinkologne-female"))
      .toContain("/scarlet-violet/icons/916-female.png");
  });

  it("uses Mega Lucario Z assets rather than ordinary Mega Lucario", () => {
    expect(getKnownPokemonIconUrl("lucario-mega-z")).toBe(getPokeApiChampionsSpriteUrl(10310));
    expect(getKnownPokemonArtworkUrl("lucario-mega-z"))
      .toContain("/official-artwork/10310.png");
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
