import type { BattleFormat } from "../battleFormat/battleFormat";
import type { StatBlock } from "../types";
import { natures, statKeys } from "../data/natures";
import { normalizeShowdownId } from "./showdownIds";

export const BATTLE_USAGE_PROVIDER = "champions-battle-data" as const;
export const BATTLE_USAGE_TTL = 60 * 60 * 1000;
export const BATTLE_USAGE_MAX_AGE = 7 * 24 * BATTLE_USAGE_TTL;
export const BATTLE_USAGE_PATH = "/api/battle-usage";

export type BattleUsageOption = { id: string; usagePercent: number };
export type BattleUsageSpread = {
  nature: string;
  evs: Partial<StatBlock>;
  usagePercent: number;
};
export type BattleUsageSet = {
  pokemonId: string;
  pokemonName: string;
  sourceMonth: string;
  // Retained for stored analysis contracts: zero means no rating cutoff.
  cutoff: number;
  sourceDate?: string;
  season?: string;
  usageRank?: number;
  ability?: string;
  itemName?: string;
  itemNames?: string[];
  itemOptions?: BattleUsageOption[];
  nature?: string;
  evs?: Partial<StatBlock>;
  spreads?: BattleUsageSpread[];
  statPointSpreads?: { evs: StatBlock; usagePercent: number }[];
  moveIds: string[];
  moveOptions?: BattleUsageOption[];
};
export type BattleUsageSource = {
  provider: typeof BATTLE_USAGE_PROVIDER;
  sourceDate: string;
  season: string;
  generatedAt: string;
  stale?: boolean;
};
export type BattleUsageSnapshot = BattleUsageSource & {
  battleFormat: BattleFormat;
  sets: BattleUsageSet[];
};

export function isBattleUsageSet(value: unknown, date: string, season: string): value is BattleUsageSet {
  const set = record(value);
  const validPoints = (value: unknown) => {
    const spread = record(value);
    return statKeys.every((stat) => Number.isInteger(spread[stat]) && Number(spread[stat]) >= 0 && Number(spread[stat]) <= 32) &&
      statKeys.reduce((sum, stat) => sum + Number(spread[stat]), 0) <= 66;
  };
  const validOptions = (value: unknown) => value === undefined || (Array.isArray(value) && value.every((option) => {
    const row = record(option);
    return !!text(row.id) && percent(row.usagePercent) !== null;
  }));
  return !!text(set.pokemonId) && !!text(set.pokemonName) && set.sourceDate === date && set.season === season &&
    set.sourceMonth === date.slice(0, 7) && set.cutoff === 0 &&
    Number.isInteger(set.usageRank) && Number(set.usageRank) > 0 &&
    natures.some((nature) => nature.id === set.nature) && validPoints(set.evs) &&
    (set.ability === undefined || typeof set.ability === "string") &&
    (set.itemName === undefined || typeof set.itemName === "string") &&
    (set.itemNames === undefined || (Array.isArray(set.itemNames) && set.itemNames.every((name) => typeof name === "string"))) &&
    Array.isArray(set.moveIds) && set.moveIds.length > 0 && set.moveIds.every((id) => !!text(id)) &&
    validOptions(set.moveOptions) && validOptions(set.itemOptions) &&
    (set.statPointSpreads === undefined || (Array.isArray(set.statPointSpreads) && set.statPointSpreads.every((spread) =>
      validPoints(record(spread).evs) && percent(record(spread).usagePercent) !== null)));
}

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : {};
}
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function names(value: unknown) {
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string" && !!name.trim()) : [];
}
function percent(value: unknown): number | null {
  if (!isNumeric(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}
function isNumeric(value: unknown) {
  return typeof value === "number" || (typeof value === "string" && !!value.trim());
}
function points(row: RecordValue): StatBlock | null {
  const fields = {
    hp: "hp_points", attack: "attack_points", defense: "defense_points",
    specialAttack: "sp_atk_points", specialDefense: "sp_def_points", speed: "speed_points",
  } as const;
  const entries = Object.entries(fields).map(([stat, field]) => [stat, row[field]] as const);
  if (entries.some(([, value]) => !isNumeric(value) || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 32)) return null;
  const result = Object.fromEntries(entries.map(([stat, value]) => [stat, Number(value)])) as StatBlock;
  return Object.values(result).reduce((sum, value) => sum + value, 0) <= 66 ? result : null;
}
function sourceDate(value: unknown) {
  const match = text(value).match(/^(\d{2})_(\d{2})_(\d{4})$/);
  if (!match) return null;
  const date = `${match[3]}-${match[2]}-${match[1]}`;
  const stamp = Date.parse(date);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date ? date : null;
}
function usableDate(date: string, now: number) {
  const stamp = Date.parse(date);
  return Number.isFinite(stamp) && stamp <= now && now - stamp <= BATTLE_USAGE_MAX_AGE;
}
function nature(row: RecordValue) {
  const id = normalizeShowdownId(text(row.name));
  return natures.some((entry) => entry.id === id) ? id : undefined;
}
function optionRows(rows: RecordValue[], category: string): BattleUsageOption[] {
  return rows.filter((row) => row.category === category).flatMap((row) => {
    const usagePercent = percent(row.percentage_value);
    const id = normalizeShowdownId(text(row.name));
    return id && id !== "nothing" && usagePercent !== null ? [{ id, usagePercent }] : [];
  });
}

function createSet(name: string, rank: number, date: string, season: string, rows: RecordValue[], values?: RecordValue): BattleUsageSet {
  const first = (category: string) => rows.find((row) => row.category === category) ?? {};
  const categoryNames = (category: string) => names(values?.[category] ?? rows.filter((row) => row.category === category).map((row) => row.name));
  const itemNames = categoryNames("held_item").filter((name) => normalizeShowdownId(name) !== "nothing").slice(0, 4);
  const statPointSpreads = rows.filter((row) => row.category === "stat_points").flatMap((row) => {
    const evs = points(row);
    const usagePercent = percent(row.percentage_value);
    return evs && usagePercent !== null ? [{ evs, usagePercent }] : [];
  }).slice(0, 6);
  return {
    pokemonId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    pokemonName: name, sourceMonth: date.slice(0, 7), cutoff: 0,
    sourceDate: date, season, usageRank: rank,
    ability: text(first("ability").name) || undefined,
    itemName: itemNames[0], itemNames,
    nature: nature(first("stat_alignment")),
    evs: statPointSpreads[0]?.evs,
    statPointSpreads,
    // Nature and point distributions are separate measurements, not joint sets.
    moveIds: categoryNames("move").map(normalizeShowdownId).filter((id) => id && id !== "nothing").slice(0, 8),
    ...(values ? {} : {
      itemOptions: optionRows(rows, "held_item").slice(0, 4),
      moveOptions: optionRows(rows, "move").slice(0, 8),
    }),
  };
}

export function parseBattleUsageIndex(input: unknown, battleFormat: BattleFormat, now = Date.now()): BattleUsageSnapshot {
  const root = record(input);
  const generatedAt = text(root.generatedAt);
  if (!usableDate(generatedAt, now) || !Array.isArray(root.pokemon)) throw new Error("Invalid battle usage index");
  const format = battleFormat === "singles" ? "Singles" : "Doubles";
  let rankedEntries = 0;
  const sets = root.pokemon.flatMap((value) => {
    const entry = record(value);
    const name = text(entry.showdownName);
    const summary = record(record(record(entry.summary).battleSummary).Current);
    const battle = record(summary[format]);
    const rank = Number(battle.position);
    if (!name || !Number.isInteger(rank) || rank < 1) return [];
    rankedEntries += 1;
    if (!Array.isArray(entry.battleDataCsvs)) return [];
    const dated = entry.battleDataCsvs.map(record).filter((file) => file.format === format && file.daily === true)
      .map((file) => ({ date: sourceDate(file.date), season: text(file.season) }))
      .filter((file) => file.date && /^M\d+$/.test(file.season))
      .sort((a, b) => b.date!.localeCompare(a.date!));
    const latest = dated[0];
    if (!latest?.date || !usableDate(latest.date, now)) return [];
    const rows = Object.values(record(battle.top)).map(record);
    const set = createSet(name, rank, latest.date, latest.season, rows, record(battle.values));
    return set.moveIds.length && set.nature && set.evs ? [set] : [];
  }).sort((a, b) => a.usageRank! - b.usageRank!);
  if (!sets.length) throw new Error("Battle usage data is unavailable");
  const newestDate = [...sets].sort((a, b) => b.sourceDate!.localeCompare(a.sourceDate!))[0].sourceDate!;
  const season = sets.find((set) => set.sourceDate === newestDate)!.season!;
  const currentSets = sets.filter((set) => set.sourceDate === newestDate && set.season === season);
  // Do not publish an incomplete rollover snapshot or mix seasons.
  if (currentSets.length < rankedEntries * 0.9) throw new Error("Incomplete battle usage update");
  if (new Set(currentSets.map((set) => normalizeShowdownId(set.pokemonId))).size !== currentSets.length ||
    new Set(currentSets.map((set) => set.usageRank)).size !== currentSets.length) throw new Error("Duplicate battle usage entries");
  return { provider: BATTLE_USAGE_PROVIDER, battleFormat, sourceDate: newestDate, season, generatedAt, sets: currentSets };
}

export function parseBattleUsageDetail(input: unknown, base: BattleUsageSet, battleFormat: BattleFormat): BattleUsageSet {
  const root = record(input);
  const format = battleFormat === "singles" ? "Singles" : "Doubles";
  if (root.format !== format || normalizeShowdownId(text(root.showdownId)) !== normalizeShowdownId(base.pokemonName) || !Array.isArray(root.daily)) throw new Error("Mismatched usage detail");
  const daily = root.daily.map(record).find((entry) => sourceDate(entry.date) === base.sourceDate && entry.season === base.season);
  if (!daily || !Array.isArray(daily.rows)) throw new Error("Mismatched usage date");
  const rows = daily.rows.map(record).filter((row) => isNumeric(row.rank) && Number.isInteger(Number(row.rank)) &&
    Number(row.rank) > 0 && percent(row.percentage_value) !== null).sort((a, b) => Number(a.rank) - Number(b.rank));
  const set = createSet(base.pokemonName, base.usageRank!, base.sourceDate!, base.season!, rows);
  if (!set.moveIds.length || !set.evs || !set.nature || !set.ability) throw new Error("Incomplete usage detail");
  return set;
}
