export const POKEAPI_CHAMPIONS_SPRITE_BASE_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/champions";

export function isFullShowdownSpriteUrl(url: string | undefined) {
  return Boolean(url?.includes("/sprites/home/") || url?.includes("/sprites/home-centered/"));
}

export function getPokeApiChampionsSpriteUrl(pokemonId: number | string) {
  return `${POKEAPI_CHAMPIONS_SPRITE_BASE_URL}/${pokemonId}.png`;
}

export function getPokeApiChampionsSpriteUrlFromKnownSprites(
  urls: Array<string | undefined>,
) {
  for (const url of urls) {
    if (!url?.startsWith("https://raw.githubusercontent.com/PokeAPI/sprites/")) {
      continue;
    }

    const pokemonId = url.match(/\/(\d+)\.png(?:\?.*)?$/)?.[1];

    if (pokemonId) {
      return getPokeApiChampionsSpriteUrl(pokemonId);
    }
  }

  return undefined;
}
