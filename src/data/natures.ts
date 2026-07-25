import type { StatBlock, StatKey } from "../types";

export type BattleStatKey = Exclude<StatKey, "hp">;

export type Nature = {
  id: string;
  label: string;
  up: BattleStatKey;
  down: BattleStatKey;
};

export const statKeys: StatKey[] = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

export const statLabels: Record<StatKey, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  specialAttack: "Sp.A",
  specialDefense: "Sp.D",
  speed: "Spe",
};

export const battleStatKeys: BattleStatKey[] = [
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

export const natureStatLabels: Record<BattleStatKey, string> = {
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Speed",
};

export const natures: Nature[] = [
  { id: "hardy", label: "Hardy", up: "attack", down: "attack" },
  { id: "lonely", label: "Lonely", up: "attack", down: "defense" },
  { id: "adamant", label: "Adamant", up: "attack", down: "specialAttack" },
  { id: "naughty", label: "Naughty", up: "attack", down: "specialDefense" },
  { id: "brave", label: "Brave", up: "attack", down: "speed" },
  { id: "modest", label: "Modest", up: "specialAttack", down: "attack" },
  { id: "mild", label: "Mild", up: "specialAttack", down: "defense" },
  { id: "bashful", label: "Bashful", up: "specialAttack", down: "specialAttack" },
  { id: "rash", label: "Rash", up: "specialAttack", down: "specialDefense" },
  { id: "quiet", label: "Quiet", up: "specialAttack", down: "speed" },
  { id: "timid", label: "Timid", up: "speed", down: "attack" },
  { id: "hasty", label: "Hasty", up: "speed", down: "defense" },
  { id: "jolly", label: "Jolly", up: "speed", down: "specialAttack" },
  { id: "naive", label: "Naive", up: "speed", down: "specialDefense" },
  { id: "serious", label: "Serious", up: "speed", down: "speed" },
  { id: "bold", label: "Bold", up: "defense", down: "attack" },
  { id: "docile", label: "Docile", up: "defense", down: "defense" },
  { id: "impish", label: "Impish", up: "defense", down: "specialAttack" },
  { id: "lax", label: "Lax", up: "defense", down: "specialDefense" },
  { id: "relaxed", label: "Relaxed", up: "defense", down: "speed" },
  { id: "calm", label: "Calm", up: "specialDefense", down: "attack" },
  { id: "gentle", label: "Gentle", up: "specialDefense", down: "defense" },
  { id: "careful", label: "Careful", up: "specialDefense", down: "specialAttack" },
  { id: "quirky", label: "Quirky", up: "specialDefense", down: "specialDefense" },
  { id: "sassy", label: "Sassy", up: "specialDefense", down: "speed" },
];

export const defaultEvs: StatBlock = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

export const CHAMPIONS_MAX_EV_PER_STAT = 32;
export const CHAMPIONS_MAX_EV_TOTAL = 66;

const CHAMPIONS_IV_STAT_BONUS = 20;
const CHAMPIONS_HP_STAT_BONUS = 75;
const natureById = new Map(natures.map((nature) => [nature.id, nature]));
const natureByAlignment = new Map(
  natures.map((nature) => [`${nature.up}:${nature.down}`, nature]),
);

export function getNatureById(id: string) {
  return natureById.get(id) ?? natures[0];
}

export function getNatureByAlignment(up: BattleStatKey, down: BattleStatKey) {
  return natureByAlignment.get(`${up}:${down}`) ?? natures[0];
}

function getNatureMultiplier(nature: Nature, stat: StatKey) {
  if (stat === "hp" || nature.up === nature.down) {
    return 1;
  }

  if (nature.up === stat) {
    return 1.1;
  }

  return nature.down === stat ? 0.9 : 1;
}

export function calculateChampionsStats(
  baseStats: StatBlock,
  evs: StatBlock,
  nature: Nature,
) {
  return statKeys.reduce((result, stat) => {
    const ev = Math.max(0, Math.min(CHAMPIONS_MAX_EV_PER_STAT, evs[stat]));
    const rawStat =
      baseStats[stat] +
      (stat === "hp" ? CHAMPIONS_HP_STAT_BONUS : CHAMPIONS_IV_STAT_BONUS) +
      ev;

    result[stat] = Math.floor(rawStat * getNatureMultiplier(nature, stat));
    return result;
  }, {} as StatBlock);
}
