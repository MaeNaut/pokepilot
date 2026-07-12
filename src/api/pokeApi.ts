import {
  pokemonTypes,
  type PokemonMove,
  type PokemonType,
  type StatBlock,
  type TeamMember,
} from "../types";
import {
  getPokemonLookupAliases,
  getPreferredPokeApiId,
} from "../utils/pokemonAliases";
import {
  getLegalMoves,
  loadShowdownLegality,
  type ShowdownLegalitySnapshot,
} from "./showdownLegality";
import {
  findShowdownSpecies,
  loadShowdownData,
  type ShowdownDataSnapshot,
} from "./showdownData";
import { syntheticGenderFormSources } from "./pokemonIndex";
import {
  cleanLegacyDataCaches,
  POKEMON_CACHE_PREFIX,
} from "./legacyDataCache";
import { formatIdLabel, normalizeShowdownId } from "./showdownIds";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const SHOWDOWN_FORMAT_ID = "gen9-regulation-mb";
type PokeApiPokemon = {
  name: string;
  sprites: {
    front_default: string | null;
    front_female?: string | null;
    other?: {
      home?: {
        front_default: string | null;
        front_female?: string | null;
      };
      "official-artwork"?: {
        front_default: string | null;
        front_female?: string | null;
      };
    };
    versions?: {
      "generation-ix"?: {
        "scarlet-violet"?: {
          front_default: string | null;
          front_female?: string | null;
        };
      };
      "generation-viii"?: {
        icons?: {
          front_default: string | null;
          front_female?: string | null;
        };
      };
      "generation-vii"?: {
        icons?: {
          front_default: string | null;
          front_female?: string | null;
        };
      };
    };
  };
  abilities: Array<{
    ability: {
      name: string;
    };
  }>;
  moves: Array<{
    move: {
      name: string;
    };
  }>;
  stats: Array<{
    base_stat: number;
    stat: {
      name: string;
    };
  }>;
  types: Array<{
    slot: number;
    type: {
      name: string;
    };
  }>;
};

const pendingPokemonByLookup = new Map<string, Promise<TeamMember>>();

function isPokemonType(value: string): value is PokemonType {
  return pokemonTypes.includes(value as PokemonType);
}

function getStat(data: PokeApiPokemon, statName: string) {
  return data.stats.find((item) => item.stat.name === statName)?.base_stat ?? 1;
}

function getPokeApiBaseStats(data: PokeApiPokemon): StatBlock {
  return {
    hp: getStat(data, "hp"),
    attack: getStat(data, "attack"),
    defense: getStat(data, "defense"),
    specialAttack: getStat(data, "special-attack"),
    specialDefense: getStat(data, "special-defense"),
    speed: getStat(data, "speed"),
  };
}

function inferRoles(stats: StatBlock): string[] {
  const bulk = stats.hp + stats.defense + stats.specialDefense;

  const roles = [
    stats.specialAttack > stats.attack ? "special attacker" : "physical attacker",
    stats.speed >= 95
      ? "speed control"
      : bulk >= 250
        ? "bulky pivot"
        : "coverage",
  ];

  return [...new Set(roles)];
}

function compareMovesByTypeThenName(first: PokemonMove, second: PokemonMove) {
  const typeOrder =
    pokemonTypes.indexOf(first.type) - pokemonTypes.indexOf(second.type);

  if (typeOrder !== 0) {
    return typeOrder;
  }

  return first.name.localeCompare(second.name);
}

function hasMoveCategory(move: Partial<PokemonMove>) {
  return (
    move.category === "Physical" ||
    move.category === "Special" ||
    move.category === "Status"
  );
}

function hasCategorizedMoves(pokemon: Partial<TeamMember>) {
  return (
    pokemon.source === "showdown" &&
    Array.isArray(pokemon.moves) &&
    pokemon.moves.length > 0 &&
    pokemon.moves.every(hasMoveCategory) &&
    typeof pokemon.iconSpriteUrl === "string"
  );
}

function readCachedPokemon(cacheKey: string) {
  try {
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as Partial<TeamMember>;

    if (hasCategorizedMoves(parsed)) {
      return parsed as TeamMember;
    }

    localStorage.removeItem(cacheKey);
  } catch {
    // A malformed or unavailable cache should fall through to live data.
  }

  return null;
}

function cachePokemon(cacheKey: string, pokemon: TeamMember) {
  if (!hasCategorizedMoves(pokemon)) {
    return;
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify(pokemon));
  } catch {
    // A storage quota failure should not discard successfully loaded data.
  }
}

function getPokeApiCurrentIconSpriteUrl(
  data: PokeApiPokemon,
  spriteGender?: "female",
) {
  if (spriteGender === "female") {
    return (
      data.sprites.versions?.["generation-ix"]?.["scarlet-violet"]?.front_female ??
      undefined
    );
  }

  return (
    data.sprites.versions?.["generation-ix"]?.["scarlet-violet"]?.front_default ??
    undefined
  );
}

function getPokeApiDefaultSpriteUrl(
  data: PokeApiPokemon,
  spriteGender?: "female",
) {
  if (spriteGender === "female") {
    return data.sprites.front_female ?? data.sprites.front_default ?? undefined;
  }

  return data.sprites.front_default ?? undefined;
}

function getPokeApiLegacyIconSpriteUrl(
  data: PokeApiPokemon,
  spriteGender?: "female",
) {
  if (spriteGender === "female") {
    return (
      data.sprites.versions?.["generation-viii"]?.icons?.front_female ??
      data.sprites.versions?.["generation-vii"]?.icons?.front_female ??
      undefined
    );
  }

  return (
    data.sprites.versions?.["generation-viii"]?.icons?.front_default ??
    data.sprites.versions?.["generation-vii"]?.icons?.front_default ??
    undefined
  );
}

function getPokemonSpriteUrl(
  data: PokeApiPokemon,
  spriteGender?: "female",
) {
  if (spriteGender === "female") {
    return (
      data.sprites.other?.["official-artwork"]?.front_female ??
      data.sprites.other?.home?.front_female ??
      data.sprites.front_female ??
      data.sprites.other?.["official-artwork"]?.front_default ??
      data.sprites.other?.home?.front_default ??
      data.sprites.front_default ??
      undefined
    );
  }

  return (
    data.sprites.other?.["official-artwork"]?.front_default ??
    data.sprites.front_default ??
    undefined
  );
}

function getPokemonIconSpriteUrl(
  data: PokeApiPokemon,
  spriteGender?: "female",
) {
  const defaultSpriteUrl = getPokeApiDefaultSpriteUrl(data, spriteGender);

  return (
    getPokeApiCurrentIconSpriteUrl(data, spriteGender) ??
    defaultSpriteUrl ??
    getPokeApiLegacyIconSpriteUrl(data, spriteGender)
  );
}

function normalizePokemon(
  data: PokeApiPokemon,
  showdownData: ShowdownDataSnapshot | null,
  showdownLegality: ShowdownLegalitySnapshot | null,
  options: { id?: string; name?: string; spriteGender?: "female" } = {},
): TeamMember {
  const pokemonId = options.id ?? data.name;
  const pokeApiTypes = data.types
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name)
    .filter(isPokemonType);
  const speciesCandidates = [pokemonId, data.name].flatMap((candidate) =>
    getPokemonLookupAliases(candidate),
  );
  const showdownSpecies = findShowdownSpecies(showdownData, speciesCandidates);
  const types = showdownSpecies?.types ?? pokeApiTypes;
  const baseStats = showdownSpecies?.baseStats ?? getPokeApiBaseStats(data);
  const legalMoveIds = getLegalMoves(
    showdownLegality,
    pokemonId,
    showdownSpecies?.baseSpecies,
  );
  const fallbackMoveIds = data.moves.map((entry) => entry.move.name);
  const moveIds = legalMoveIds?.size ? Array.from(legalMoveIds) : fallbackMoveIds;
  const moves = moveIds
    .map((moveId) => showdownData?.movesById[normalizeShowdownId(moveId)])
    .filter((move): move is PokemonMove => Boolean(move))
    .sort(compareMovesByTypeThenName);

  return {
    id: pokemonId,
    name: options.name ?? formatIdLabel(data.name),
    types,
    roles: inferRoles(baseStats),
    baseStats,
    abilities:
      showdownSpecies?.abilities.length
        ? showdownSpecies.abilities
        : data.abilities.map((entry) => formatIdLabel(entry.ability.name)),
    moves,
    spriteUrl: getPokemonSpriteUrl(data, options.spriteGender),
    iconSpriteUrl: getPokemonIconSpriteUrl(data, options.spriteGender),
    source: showdownSpecies ? "showdown" : "pokeapi",
  };
}

export async function fetchPokemon(nameOrId: string): Promise<TeamMember> {
  cleanLegacyDataCaches();

  const requestedLookup = nameOrId.trim().toLowerCase().replace(/\s+/g, "-");
  const lookup = getPreferredPokeApiId(requestedLookup) ?? requestedLookup;
  const syntheticGenderForm = syntheticGenderFormSources[lookup];
  const apiLookup = syntheticGenderForm?.sourceName ?? lookup;

  if (!lookup) {
    throw new Error("Enter a Pokemon name or Pokedex number.");
  }

  const cacheKey = `${POKEMON_CACHE_PREFIX}${lookup}`;
  const cachedPokemon = readCachedPokemon(cacheKey);

  if (cachedPokemon) {
    return cachedPokemon;
  }

  const pendingPokemon = pendingPokemonByLookup.get(lookup);

  if (pendingPokemon) {
    return pendingPokemon;
  }

  const pokemonPromise = fetchPokemonFromSources(
    nameOrId,
    lookup,
    apiLookup,
    syntheticGenderForm,
    cacheKey,
  );
  pendingPokemonByLookup.set(lookup, pokemonPromise);

  try {
    return await pokemonPromise;
  } finally {
    pendingPokemonByLookup.delete(lookup);
  }
}

async function fetchPokemonFromSources(
  requestedName: string,
  lookup: string,
  apiLookup: string,
  syntheticGenderForm: { sourceName: string; spriteGender: "female" } | undefined,
  cacheKey: string,
) {
  const [response, showdownData, showdownLegality] = await Promise.all([
    fetch(`${POKEAPI_BASE_URL}/pokemon/${apiLookup}`),
    loadShowdownData().catch(() => null),
    loadShowdownLegality(SHOWDOWN_FORMAT_ID).catch(() => null),
  ]);

  if (!response.ok) {
    throw new Error(`Could not find "${requestedName}".`);
  }

  const data = (await response.json()) as PokeApiPokemon;
  const pokemon = normalizePokemon(
    data,
    showdownData,
    showdownLegality,
    syntheticGenderForm
      ? {
          id: lookup,
          name: formatIdLabel(lookup),
          spriteGender: syntheticGenderForm.spriteGender,
        }
      : undefined,
  );

  cachePokemon(cacheKey, pokemon);

  return pokemon;
}
