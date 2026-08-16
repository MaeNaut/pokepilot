import {
  calculate,
  Field,
  Generations,
  Move,
  Pokemon,
  type State,
  type StatsTable,
  toID,
} from "@smogon/calc";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  getNatureById,
} from "../data/natures";
import { typeChart } from "../data/typeChart";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds";
import type {
  PokemonItem,
  PokemonMove,
  PokemonType,
  StatBlock,
  StatKey,
  TeamMember,
} from "../types";

export const CALCULATOR_LEVEL = 50;

export type CalculatorBoosts = Record<
  Exclude<StatKey, "hp">,
  number
>;

export type CalculatorPokemonStatus = "healthy" | "burned";

export type CalculatorPokemon = {
  member: TeamMember;
  item: PokemonItem | null;
  ability: string;
  natureId: string;
  evs: StatBlock;
  boosts: CalculatorBoosts;
  currentHp: number;
  status: CalculatorPokemonStatus;
  move: PokemonMove;
};

export type CalculatorField = {
  weather: "none" | "sun" | "rain" | "sand" | "snow";
  terrain: "none" | "electric" | "grassy" | "psychic" | "misty";
  room: "none" | "magic" | "wonder" | "gravity";
  aura: "none" | "fairy";
  gameType: "singles" | "doubles";
  isCritical: boolean;
  isSpread: boolean;
  isHelpingHand: boolean;
  isTailwind: boolean;
  isFriendGuard: boolean;
  isPlusMinus: boolean;
  isWall: boolean;
};

export type DamageCalculationResult =
  | {
      status: "ready";
      minDamage: number;
      maxDamage: number;
      minPercent: number;
      maxPercent: number;
      defenderCurrentHp: number;
      defenderMaxHp: number;
      oneHitKoChance: number;
      koHits: number;
      koChance: number | null;
      effectiveness: number;
      attackStat: number;
      defenseStat: number;
      offensivePower: number | null;
      description: string;
    }
  | {
      status: "unsupported";
      reason: "missing-stats" | "status-move" | "invalid-move";
    };

const generation = Generations.get(9);

const engineStatKeys: Record<StatKey, keyof StatsTable> = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  specialAttack: "spa",
  specialDefense: "spd",
  speed: "spe",
};

const engineTypeNames: Record<PokemonType, string> = {
  normal: "Normal",
  fire: "Fire",
  water: "Water",
  electric: "Electric",
  grass: "Grass",
  ice: "Ice",
  fighting: "Fighting",
  poison: "Poison",
  ground: "Ground",
  flying: "Flying",
  psychic: "Psychic",
  bug: "Bug",
  rock: "Rock",
  ghost: "Ghost",
  dragon: "Dragon",
  dark: "Dark",
  steel: "Steel",
  fairy: "Fairy",
};

const pokemonTypesByEngineName = Object.fromEntries(
  Object.entries(engineTypeNames).map(([type, engineName]) => [
    engineName,
    type as PokemonType,
  ]),
) as Record<string, PokemonType>;

const weatherNames = {
  none: undefined,
  sun: "Sun",
  rain: "Rain",
  sand: "Sand",
  snow: "Snow",
} as const;

const terrainNames = {
  none: undefined,
  electric: "Electric",
  grassy: "Grassy",
  psychic: "Psychic",
  misty: "Misty",
} as const;

export function statPointsToEvs(statPoints: number) {
  const value = Math.max(
    0,
    Math.min(CHAMPIONS_MAX_EV_PER_STAT, Math.trunc(statPoints)),
  );
  return value === 0 ? 0 : value * 8 - 4;
}

function toEngineStats(stats: StatBlock) {
  return Object.fromEntries(
    Object.entries(engineStatKeys).map(([stat, engineStat]) => [
      engineStat,
      stats[stat as StatKey],
    ]),
  ) as StatsTable;
}

function toEngineEvs(evs: StatBlock) {
  return Object.fromEntries(
    Object.entries(engineStatKeys).map(([stat, engineStat]) => [
      engineStat,
      statPointsToEvs(evs[stat as StatKey]),
    ]),
  ) as StatsTable;
}

function toEngineBoosts(boosts: CalculatorBoosts) {
  return {
    atk: boosts.attack,
    def: boosts.defense,
    spa: boosts.specialAttack,
    spd: boosts.specialDefense,
    spe: boosts.speed,
  };
}

function getSpeciesOverrides(
  pokemon: CalculatorPokemon,
): NonNullable<State.Pokemon["overrides"]> {
  const member = pokemon.member;
  const speciesId = normalizeId(member.showdownId ?? member.id);
  const knownSpecies = generation.species.get(toID(speciesId));
  const types = member.types.map((type) => engineTypeNames[type]);

  return {
    kind: "Species",
    id: speciesId,
    name: member.showdownName ?? member.name,
    types,
    baseStats: toEngineStats(member.baseStats!),
    weightkg: knownSpecies?.weightkg ?? 100,
    abilities: {
      0: pokemon.ability || member.abilities?.[0] || "",
    },
  } as unknown as NonNullable<State.Pokemon["overrides"]>;
}

function getMoveFlags(move: PokemonMove) {
  const tags = new Set(move.tags ?? []);

  return {
    contact: tags.has("Contact") ? 1 : 0,
    sound: tags.has("Sound") ? 1 : 0,
    punch: tags.has("Punch") ? 1 : 0,
    bite: tags.has("Bite") ? 1 : 0,
    pulse: tags.has("Pulse") ? 1 : 0,
    slicing: tags.has("Slicing") ? 1 : 0,
    bullet: tags.has("Ball/Bomb") ? 1 : 0,
    wind: tags.has("Wind") ? 1 : 0,
  } as const;
}

function getMoveTarget(move: PokemonMove, isSpread: boolean) {
  if (!isSpread) {
    return "normal" as const;
  }

  if (move.tags?.includes("Spread: Foes")) {
    return "allAdjacentFoes" as const;
  }

  if (
    move.tags?.includes("Spread: All") ||
    move.tags?.includes("Spread: Adjacent")
  ) {
    return "allAdjacent" as const;
  }

  return "normal" as const;
}

function getMoveOverrides(
  move: PokemonMove,
  isSpread: boolean,
): NonNullable<State.Move["overrides"]> {
  return {
    kind: "Move",
    id: normalizeId(move.id),
    name: move.name,
    type: engineTypeNames[move.type],
    category:
      move.category === "Physical"
        ? "Physical"
        : move.category === "Special"
          ? "Special"
          : "Status",
    flags: getMoveFlags(move),
    target: getMoveTarget(move, isSpread),
    ...(move.power !== null ? { basePower: move.power } : {}),
  } as unknown as NonNullable<State.Move["overrides"]>;
}

function createEnginePokemon(
  pokemon: CalculatorPokemon,
  options: { abilityOn?: boolean } = {},
) {
  const maxHp =
    pokemon.member.baseStats!.hp +
    75 +
    Math.max(
      0,
      Math.min(CHAMPIONS_MAX_EV_PER_STAT, pokemon.evs.hp),
    );

  return new Pokemon(
    generation,
    pokemon.member.showdownName ?? pokemon.member.name,
    {
      level: CALCULATOR_LEVEL,
      ability: pokemon.ability || undefined,
      abilityOn: options.abilityOn,
      item: pokemon.item?.name || undefined,
      nature: getNatureById(pokemon.natureId).label,
      evs: toEngineEvs(pokemon.evs),
      boosts: toEngineBoosts(pokemon.boosts),
      curHP: Math.max(1, Math.min(maxHp, pokemon.currentHp)),
      status: pokemon.status === "burned" ? "brn" : "",
      overrides: getSpeciesOverrides(pokemon),
    },
  );
}

function getEffectiveness(
  moveType: PokemonType,
  defenderTypes: PokemonType[],
  isGravity: boolean,
) {
  return defenderTypes.reduce(
    (multiplier, defenderType) => {
      const typeMultiplier =
        isGravity && moveType === "ground" && defenderType === "flying"
          ? 1
          : (typeChart[moveType][defenderType] ?? 1);

      return multiplier * typeMultiplier;
    },
    1,
  );
}

function flattenDamageRolls(damage: number | number[] | number[][]): number[] {
  if (typeof damage === "number") {
    return [damage];
  }

  if (damage.every((value) => typeof value === "number")) {
    return damage as number[];
  }

  const hitRolls = damage as number[][];
  const rollCount = Math.max(0, ...hitRolls.map((rolls) => rolls.length));

  return Array.from({ length: rollCount }, (_, rollIndex) =>
    hitRolls.reduce(
      (total, rolls) =>
        total + (rolls[rollIndex] ?? rolls[rolls.length - 1] ?? 0),
      0,
    ),
  );
}

function getOffensiveStat(result: ReturnType<typeof calculate>) {
  const source =
    result.move.overrideOffensivePokemon === "target"
      ? result.defender
      : result.attacker;
  const stat =
    result.move.overrideOffensiveStat ??
    (result.move.category === "Special" ? "spa" : "atk");

  return source.stats[stat];
}

function getOffensivePower(
  result: ReturnType<typeof calculate>,
  attackStat: number,
) {
  const basePower = result.rawDesc.moveBP ?? result.move.bp;

  if (basePower <= 0 || attackStat <= 0) {
    return null;
  }

  const hasResolvedBasePower = result.rawDesc.moveBP !== undefined;
  const hitMultiplier = hasResolvedBasePower
    ? 1
    : Math.max(1, result.move.hits);
  const stabMultiplier = result.attacker.hasType(result.move.type)
    ? result.attacker.hasAbility("Adaptability")
      ? 2
      : 1.5
    : 1;

  return Math.round(
    attackStat * basePower * hitMultiplier * stabMultiplier,
  );
}

export function calculateChampionsDamage(
  attacker: CalculatorPokemon,
  defender: CalculatorPokemon,
  field: CalculatorField,
): DamageCalculationResult {
  if (!attacker.member.baseStats || !defender.member.baseStats) {
    return { status: "unsupported", reason: "missing-stats" };
  }

  if (
    attacker.move.category !== "Physical" &&
    attacker.move.category !== "Special"
  ) {
    return { status: "unsupported", reason: "status-move" };
  }

  if (!attacker.move.name) {
    return { status: "unsupported", reason: "invalid-move" };
  }

  const attackerAbilityId = normalizeId(attacker.ability);
  const engineAttacker = createEnginePokemon(attacker, {
    abilityOn:
      field.isPlusMinus &&
      (attackerAbilityId === "plus" || attackerAbilityId === "minus"),
  });
  const engineDefender = createEnginePokemon(defender);
  const engineMove = new Move(generation, attacker.move.name, {
    ability: attacker.ability || undefined,
    item: attacker.item?.name || undefined,
    species: attacker.member.showdownName ?? attacker.member.name,
    isCrit: field.isCritical,
    overrides: getMoveOverrides(attacker.move, field.isSpread),
  });
  const engineField = new Field({
    gameType: field.gameType === "doubles" ? "Doubles" : "Singles",
    weather: weatherNames[field.weather],
    terrain: terrainNames[field.terrain],
    isMagicRoom: field.room === "magic",
    isWonderRoom: field.room === "wonder",
    isGravity: field.room === "gravity",
    isFairyAura: field.aura === "fairy",
    attackerSide: {
      isHelpingHand: field.isHelpingHand,
      isTailwind: field.isTailwind,
    },
    defenderSide: {
      isReflect: field.isWall,
      isLightScreen: field.isWall,
      isFriendGuard: field.isFriendGuard,
    },
  });
  const result = calculate(
    generation,
    engineAttacker,
    engineDefender,
    engineMove,
    engineField,
  );
  const [minDamage, maxDamage] = result.range();
  const damageRolls = flattenDamageRolls(result.damage);
  const defenderCurrentHp = engineDefender.curHP();
  const defenderMaxHp = engineDefender.maxHP();
  const oneHitKoRolls = damageRolls.filter(
    (damage) => damage >= defenderCurrentHp,
  ).length;
  const oneHitKoChance =
    damageRolls.length > 0 ? (oneHitKoRolls / damageRolls.length) * 100 : 0;
  const ko = maxDamage > 0 ? result.kochance() : null;
  const effectiveness =
    maxDamage === 0
      ? 0
      : getEffectiveness(
          pokemonTypesByEngineName[result.move.type] ?? attacker.move.type,
          defender.member.types,
          field.room === "gravity",
        );
  const isPhysical = attacker.move.category === "Physical";
  const attackStat = getOffensiveStat(result);

  return {
    status: "ready",
    minDamage,
    maxDamage,
    minPercent: (minDamage / defenderMaxHp) * 100,
    maxPercent: (maxDamage / defenderMaxHp) * 100,
    defenderCurrentHp,
    defenderMaxHp,
    oneHitKoChance,
    koHits: ko?.n ?? 0,
    koChance: ko?.chance === undefined ? null : ko.chance * 100,
    effectiveness,
    attackStat,
    defenseStat: isPhysical
      ? engineDefender.stats.def
      : engineDefender.stats.spd,
    offensivePower: getOffensivePower(result, attackStat),
    description:
      maxDamage > 0
        ? result.fullDesc()
        : `${attacker.member.name}'s ${attacker.move.name} deals no damage to ${defender.member.name}.`,
  };
}
