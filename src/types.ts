export const pokemonTypes = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export type PokemonType = (typeof pokemonTypes)[number];

export type DataLoadStatus = "idle" | "loading" | "ready" | "error";

export type StatKey =
  | "hp"
  | "attack"
  | "defense"
  | "specialAttack"
  | "specialDefense"
  | "speed";

export type StatBlock = Record<StatKey, number>;

export type PokemonMove = {
  id: string;
  name: string;
  type: PokemonType;
  category?: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  description: string;
  tags?: string[];
};

export type PokemonIndexEntry = {
  name: string;
  showdownId: string;
  displayName: string;
  speciesKey: string;
  sortNumber: number;
  formKind: "base" | "regional" | "form" | "gender" | "mega";
  formLabel?: string;
  isSelectorOption: boolean;
};

export type ItemIndexEntry = {
  id: number;
  name: string;
  showdownId: string;
  displayName: string;
  isMegaStone: boolean;
  effect?: string;
  spriteUrl?: string;
  fallbackSpriteUrl?: string;
};

export type PokemonItem = {
  id: string;
  showdownId?: string;
  name: string;
  spriteUrl?: string;
  fallbackSpriteUrl?: string;
  category?: string;
  effect?: string;
};

export type PokemonAbility = {
  id: string;
  name: string;
  effect?: string;
  shortEffect?: string;
};

export type TeamMember = {
  id: string;
  name: string;
  types: PokemonType[];
  roles: string[];
  spriteUrl?: string;
  iconSpriteUrl?: string;
  baseStats?: StatBlock;
  abilities?: string[];
  moves?: PokemonMove[];
  source?: "local" | "pokeapi" | "showdown";
};

export type TeamSlot = TeamMember | null;
