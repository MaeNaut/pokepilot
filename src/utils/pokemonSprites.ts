const POKEAPI_CHAMPIONS_SPRITE_BASE_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/champions";
const POKEAPI_SPRITE_BASE_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const KNOWN_FORM_SPRITE_IDS: Record<string, number> = {
  "basculegion-male": 902,
  "basculegion-female": 10248,
  "indeedee-male": 876,
  "indeedee-female": 10186,
  "meowstic-male": 678,
  "meowstic-female": 10025,
  "meowstic-male-mega": 10314,
  "meowstic-female-mega": 10326,
  "meowstic-m-mega": 10314,
  "meowstic-f-mega": 10326,
  "oinkologne-male": 916,
  "oinkologne-female": 10254,
  "pyroar-male": 668,
  "furfrou-natural": 676,
};

export function getKnownPokemonArtworkUrl(pokemonId: string) {
  if (pokemonId === "pyroar-female") {
    return `${POKEAPI_SPRITE_BASE_URL}/other/home/female/668.png`;
  }

  const spriteId = KNOWN_FORM_SPRITE_IDS[pokemonId];
  return spriteId
    ? `${POKEAPI_SPRITE_BASE_URL}/other/official-artwork/${spriteId}.png`
    : undefined;
}

export function getKnownPokemonIconUrl(pokemonId: string) {
  if (pokemonId === "pyroar-female") {
    return `${POKEAPI_SPRITE_BASE_URL}/versions/generation-ix/scarlet-violet/female/668.png`;
  }

  const spriteId = KNOWN_FORM_SPRITE_IDS[pokemonId];
  if (!spriteId) return undefined;

  return pokemonId.startsWith("oinkologne-")
    ? `${POKEAPI_SPRITE_BASE_URL}/${spriteId}.png`
    : getPokeApiChampionsSpriteUrl(spriteId);
}

export function showKnownPokemonArtworkFallback(image: HTMLImageElement, pokemonId: string) {
  const fallbackUrl = getKnownPokemonArtworkUrl(pokemonId);

  if (fallbackUrl && image.src !== fallbackUrl) {
    image.src = fallbackUrl;
    return;
  }

  image.hidden = true;
}

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
