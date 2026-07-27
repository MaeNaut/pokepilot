import type {
  CalculatorBoosts,
  CalculatorField,
  CalculatorPokemon,
  DamageCalculationResult,
} from "../../calculator/damageCalculator";
import type {
  PokemonItem,
  PokemonMove,
  PokemonType,
  StatBlock,
  TeamMember,
} from "../../types";

type ReadyDamageResult = Extract<
  DamageCalculationResult,
  { status: "ready" }
>;

export type DamageReferenceFixture = {
  id: string;
  attacker: CalculatorPokemon;
  defender: CalculatorPokemon;
  field: CalculatorField;
  capturedComparatorRange?: readonly [number, number];
  expected: Pick<
    ReadyDamageResult,
    | "minDamage"
    | "maxDamage"
    | "defenderMaxHp"
    | "effectiveness"
    | "attackStat"
    | "defenseStat"
  >;
};

export const damageReferenceSource = {
  name: "Champions mechanics research with live calculator inputs",
  mechanicsUrl:
    "https://www.smogon.com/forums/threads/champions-battle-mechanics-research.3780372/",
  comparatorUrl: "https://pkmnchamps.com/calculator",
  capturedOn: "2026-07-26",
  regulation: "M-B",
  format: "singles",
} as const;

const emptyStats: StatBlock = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

const emptyBoosts: CalculatorBoosts = {
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

const singlesField: CalculatorField = {
  weather: "none",
  terrain: "none",
  room: "none",
  aura: "none",
  gameType: "singles",
  isCritical: false,
  isSpread: false,
  isHelpingHand: false,
  isTailwind: false,
  isFriendGuard: false,
  isPlusMinus: false,
  isWall: false,
};

function createMove(
  id: string,
  name: string,
  type: PokemonType,
  category: "Physical" | "Special",
  power: number,
): PokemonMove {
  return {
    id,
    name,
    type,
    category,
    power,
    accuracy: 100,
    pp: 10,
    description: "",
  };
}

function createMember(
  id: string,
  name: string,
  types: PokemonType[],
  baseStats: StatBlock,
  abilities: string[],
  moves: PokemonMove[],
): TeamMember {
  return {
    id,
    name,
    showdownId: id,
    showdownName: name,
    types,
    roles: [],
    baseStats,
    abilities,
    moves,
  };
}

function createItem(id: string, name: string): PokemonItem {
  return {
    id,
    showdownId: id.replace(/-/g, ""),
    name,
  };
}

function createPokemon(
  member: TeamMember,
  options: {
    ability: string;
    natureId: string;
    evs: Partial<StatBlock>;
    item: PokemonItem | null;
    move: PokemonMove;
    currentHp?: number;
  },
): CalculatorPokemon {
  const evs = { ...emptyStats, ...options.evs };

  return {
    member,
    item: options.item,
    ability: options.ability,
    natureId: options.natureId,
    evs,
    boosts: emptyBoosts,
    currentHp:
      options.currentHp ??
      member.baseStats!.hp + 75 + Math.max(0, Math.min(32, evs.hp)),
    status: "healthy",
    move: options.move,
  };
}

const earthquake = createMove(
  "earthquake",
  "Earthquake",
  "ground",
  "Physical",
  100,
);
const outrage = createMove(
  "outrage",
  "Outrage",
  "dragon",
  "Physical",
  120,
);
const flareBlitz = createMove(
  "flare-blitz",
  "Flare Blitz",
  "fire",
  "Physical",
  120,
);
const darkestLariat = createMove(
  "darkest-lariat",
  "Darkest Lariat",
  "dark",
  "Physical",
  85,
);
const solarBeam = createMove(
  "solar-beam",
  "Solar Beam",
  "grass",
  "Special",
  120,
);
const flamethrower = createMove(
  "flamethrower",
  "Flamethrower",
  "fire",
  "Special",
  90,
);
const airSlash = createMove(
  "air-slash",
  "Air Slash",
  "flying",
  "Special",
  75,
);
const overheat = createMove(
  "overheat",
  "Overheat",
  "fire",
  "Special",
  130,
);

const garchomp = createMember(
  "garchomp",
  "Garchomp",
  ["dragon", "ground"],
  {
    hp: 108,
    attack: 130,
    defense: 95,
    specialAttack: 80,
    specialDefense: 85,
    speed: 102,
  },
  ["Rough Skin"],
  [earthquake, outrage],
);

const incineroar = createMember(
  "incineroar",
  "Incineroar",
  ["fire", "dark"],
  {
    hp: 95,
    attack: 115,
    defense: 90,
    specialAttack: 80,
    specialDefense: 90,
    speed: 60,
  },
  ["Blaze", "Intimidate"],
  [flareBlitz, darkestLariat],
);

const megaCharizardY = createMember(
  "charizardmegay",
  "Charizard-Mega-Y",
  ["fire", "flying"],
  {
    hp: 78,
    attack: 104,
    defense: 78,
    specialAttack: 159,
    specialDefense: 115,
    speed: 100,
  },
  ["Drought"],
  [solarBeam, flamethrower, airSlash, overheat],
);

const focusSash = createItem("focus-sash", "Focus Sash");
const sitrusBerry = createItem("sitrus-berry", "Sitrus Berry");
const charizarditeY = createItem("charizardite-y", "Charizardite Y");

function createGarchomp(move: PokemonMove) {
  return createPokemon(garchomp, {
    ability: "Rough Skin",
    natureId: "jolly",
    evs: { hp: 2, attack: 32, speed: 32 },
    item: focusSash,
    move,
  });
}

function createIncineroar(move: PokemonMove) {
  return createPokemon(incineroar, {
    ability: "Blaze",
    natureId: "adamant",
    evs: { hp: 32, defense: 32, specialDefense: 2 },
    item: sitrusBerry,
    move,
  });
}

function createMegaCharizardY(move: PokemonMove) {
  return createPokemon(megaCharizardY, {
    ability: "Drought",
    natureId: "modest",
    evs: { hp: 2, specialAttack: 32, speed: 32 },
    item: charizarditeY,
    move,
  });
}

export const damageReferenceFixtures: DamageReferenceFixture[] = [
  {
    id: "jolly Garchomp Earthquake into defensive Incineroar",
    attacker: createGarchomp(earthquake),
    defender: createIncineroar(flareBlitz),
    field: singlesField,
    capturedComparatorRange: [147, 174],
    expected: {
      minDamage: 146,
      maxDamage: 174,
      defenderMaxHp: 202,
      effectiveness: 2,
      attackStat: 182,
      defenseStat: 142,
    },
  },
  {
    id: "jolly Garchomp Outrage into defensive Incineroar",
    attacker: createGarchomp(outrage),
    defender: createIncineroar(flareBlitz),
    field: singlesField,
    expected: {
      minDamage: 87,
      maxDamage: 103,
      defenderMaxHp: 202,
      effectiveness: 1,
      attackStat: 182,
      defenseStat: 142,
    },
  },
  {
    id: "uninvested adamant Incineroar Flare Blitz into Garchomp",
    attacker: createIncineroar(flareBlitz),
    defender: createGarchomp(earthquake),
    field: singlesField,
    expected: {
      minDamage: 43,
      maxDamage: 51,
      defenderMaxHp: 185,
      effectiveness: 0.5,
      attackStat: 148,
      defenseStat: 115,
    },
  },
  {
    id: "uninvested adamant Incineroar Darkest Lariat into Garchomp",
    attacker: createIncineroar(darkestLariat),
    defender: createGarchomp(earthquake),
    field: singlesField,
    expected: {
      minDamage: 63,
      maxDamage: 75,
      defenderMaxHp: 185,
      effectiveness: 1,
      attackStat: 148,
      defenseStat: 115,
    },
  },
  {
    id: "modest Mega Charizard Y Solar Beam into Incineroar in sun",
    attacker: createMegaCharizardY(solarBeam),
    defender: createIncineroar(flareBlitz),
    field: { ...singlesField, weather: "sun" },
    expected: {
      minDamage: 47,
      maxDamage: 55,
      defenderMaxHp: 202,
      effectiveness: 0.5,
      attackStat: 232,
      defenseStat: 112,
    },
  },
  {
    id: "modest Mega Charizard Y Flamethrower into Incineroar in sun",
    attacker: createMegaCharizardY(flamethrower),
    defender: createIncineroar(flareBlitz),
    field: { ...singlesField, weather: "sun" },
    capturedComparatorRange: [79, 93],
    expected: {
      minDamage: 80,
      maxDamage: 94,
      defenderMaxHp: 202,
      effectiveness: 0.5,
      attackStat: 232,
      defenseStat: 112,
    },
  },
  {
    id: "modest Mega Charizard Y Air Slash into Incineroar",
    attacker: createMegaCharizardY(airSlash),
    defender: createIncineroar(flareBlitz),
    field: { ...singlesField, weather: "sun" },
    expected: {
      minDamage: 88,
      maxDamage: 105,
      defenderMaxHp: 202,
      effectiveness: 1,
      attackStat: 232,
      defenseStat: 112,
    },
  },
  {
    id: "modest Mega Charizard Y Overheat into Incineroar in sun",
    attacker: createMegaCharizardY(overheat),
    defender: createIncineroar(flareBlitz),
    field: { ...singlesField, weather: "sun" },
    capturedComparatorRange: [114, 134],
    expected: {
      minDamage: 114,
      maxDamage: 135,
      defenderMaxHp: 202,
      effectiveness: 0.5,
      attackStat: 232,
      defenseStat: 112,
    },
  },
];
