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

export const pokemonMoveTargets = [
  "self",
  "adjacent-ally",
  "adjacent-ally-or-self",
  "adjacent-foe",
  "any-adjacent",
  "all-adjacent",
  "all-adjacent-foes",
  "all",
  "ally-side",
  "foe-side",
  "field",
  "unknown",
] as const;

export type PokemonMoveTarget = (typeof pokemonMoveTargets)[number];

export const pokemonMoveStatStages = [
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
  "accuracy",
  "evasion",
] as const;

export type PokemonMoveStatStage = (typeof pokemonMoveStatStages)[number];

export type PokemonMoveStatChange = {
  stat: PokemonMoveStatStage;
  stages: number;
};

export const pokemonMoveFieldEffectKinds = [
  "weather",
  "terrain",
  "pseudo-weather",
  "side-condition",
  "slot-condition",
] as const;

export type PokemonMoveFieldEffect = {
  kind: (typeof pokemonMoveFieldEffectKinds)[number];
  id: string;
};

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
  target?: PokemonMoveTarget;
  priority?: number;
  targetStatChanges?: PokemonMoveStatChange[];
  fieldEffects?: PokemonMoveFieldEffect[];
};

export type PokemonCandidateFilterValue = {
  id: string;
  name: string;
};

export type PokemonCandidateFilters = {
  types: PokemonType[];
  ability: PokemonCandidateFilterValue | null;
  moves: PokemonCandidateFilterValue[];
};

export type PokemonIndexEntry = {
  name: string;
  showdownId: string;
  showdownName?: string;
  displayName: string;
  speciesKey: string;
  sortNumber: number;
  types: PokemonType[];
  abilities: string[];
  baseStats?: StatBlock;
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
  showdownId?: string;
  showdownName?: string;
  showdownGender?: "M" | "F";
  types: PokemonType[];
  roles: string[];
  spriteUrl?: string;
  iconSpriteUrl?: string;
  iconFallbackSpriteUrls?: string[];
  baseStats?: StatBlock;
  abilities?: string[];
  moves?: PokemonMove[];
  source?: "local" | "pokeapi" | "showdown";
};

export type TeamSlot = TeamMember | null;
