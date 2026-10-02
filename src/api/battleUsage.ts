import type { PokemonMove, TeamMember } from "../types";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { normalizeShowdownId } from "./showdownIds";
import {
  BATTLE_USAGE_MAX_AGE, BATTLE_USAGE_PATH, BATTLE_USAGE_PROVIDER, BATTLE_USAGE_TTL,
  isBattleUsageSet,
  type BattleUsageSnapshot, type BattleUsageSet, type BattleUsageSource,
} from "./battleUsageData";
export type { BattleUsageSet, BattleUsageSpread, BattleUsageOption, BattleUsageSource } from "./battleUsageData";

type Cached = BattleUsageSnapshot & { cachedAt: number };
const memory = new Map<BattleFormat, Cached>();
const pending = new Map<BattleFormat, Promise<Cached | null>>();
const details = new Map<string, Promise<BattleUsageSet>>();
const retryAfter = new Map<BattleFormat, number>();
const keyFor = (format: BattleFormat) => `pokepilot:battle-usage:v1:${format}`;

function valid(value: unknown, format: BattleFormat): value is Cached {
  const item = value as Cached | null;
  return !!item && item.provider === BATTLE_USAGE_PROVIDER && item.battleFormat === format &&
    /^M\d+$/.test(item.season) && /^\d{4}-\d{2}-\d{2}$/.test(item.sourceDate) &&
    Number.isFinite(item.cachedAt) && item.cachedAt <= Date.now() &&
    Date.parse(item.sourceDate) <= Date.now() && Date.now() - Date.parse(item.sourceDate) < BATTLE_USAGE_MAX_AGE &&
    Number.isFinite(Date.parse(item.generatedAt)) && Date.parse(item.generatedAt) <= Date.now() &&
    Array.isArray(item.sets) && item.sets.length > 0 && item.sets.every((set) => isBattleUsageSet(set, item.sourceDate, item.season));
}
function readCache(format: BattleFormat) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(format)) ?? "null");
    return valid(value, format) ? value : null;
  } catch { return null; }
}
async function loadSnapshot(format: BattleFormat): Promise<Cached | null> {
  const cached = memory.get(format) ?? readCache(format);
  if (cached && valid(cached, format)) {
    memory.set(format, cached);
    if (Date.now() - cached.cachedAt < BATTLE_USAGE_TTL && !cached.stale) return cached;
  }
  if ((retryAfter.get(format) ?? 0) > Date.now()) return cached && valid(cached, format) ? { ...cached, stale: true } : null;
  if (!pending.has(format)) {
    pending.set(format, (async () => {
      try {
        const response = await fetch(`${BATTLE_USAGE_PATH}/${format}`, { signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error("Usage unavailable");
        const snapshot: Cached = { ...await response.json(), cachedAt: Date.now() };
        if (!valid(snapshot, format)) throw new Error("Invalid usage snapshot");
        if (snapshot.stale) retryAfter.set(format, Date.now() + 60_000);
        else retryAfter.delete(format);
        memory.set(format, snapshot);
        try { localStorage.setItem(keyFor(format), JSON.stringify(snapshot)); } catch { /* Memory cache remains usable. */ }
        return snapshot;
      } catch {
        retryAfter.set(format, Date.now() + 60_000);
        return cached && valid(cached, format) ? { ...cached, stale: true } : null;
      } finally { pending.delete(format); }
    })());
  }
  return pending.get(format)!;
}

export async function loadBattleUsagePokemonIds(format: BattleFormat = "doubles") {
  return (await loadBattleUsageSets(format)).map((set) => set.pokemonId);
}
export async function loadBattleUsageSets(format: BattleFormat = "doubles") {
  const snapshot = await loadSnapshot(format);
  if (!snapshot) throw new Error("Champions battle usage data is unavailable.");
  return snapshot.sets;
}
export async function loadBattleUsageSource(format: BattleFormat = "doubles"): Promise<BattleUsageSource | null> {
  const snapshot = await loadSnapshot(format);
  if (!snapshot) return null;
  const { provider, sourceDate, season, generatedAt, stale } = snapshot;
  return { provider, sourceDate, season, generatedAt, stale: stale || Date.now() - Date.parse(sourceDate) > 2 * 24 * BATTLE_USAGE_TTL };
}
export async function loadPopularUsageSet(pokemonId: string, format: BattleFormat = "doubles") {
  const snapshot = await loadSnapshot(format);
  if (!snapshot) return null;
  const lookupId = pokemonId.replace(/-mega(?:-.+)?$/, "");
  const aliases = [...getPokemonLookupAliases(pokemonId), ...getPokemonLookupAliases(lookupId)].map(normalizeShowdownId);
  const base = aliases.flatMap((id) => snapshot.sets.filter((set) => normalizeShowdownId(set.pokemonId) === id))[0];
  if (!base) return null;
  const key = `${format}:${snapshot.generatedAt}:${snapshot.sourceDate}:${base.pokemonId}`;
  if (!details.has(key)) {
    if (details.size >= 600) details.clear();
    details.set(key, (async () => {
      try {
        const response = await fetch(`${BATTLE_USAGE_PATH}/${format}/${normalizeShowdownId(base.pokemonId)}`, { signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error("Detail unavailable");
        const set = await response.json() as BattleUsageSet;
        if (set.pokemonId !== base.pokemonId || !valid({ ...snapshot, sets: [set] }, format)) throw new Error("Detail mismatch");
        return set;
      } catch {
        details.delete(key);
        return base;
      }
    })());
  }
  return details.get(key)!;
}

export function resolveBattleUsageAbility(member: TeamMember, ability: string | undefined, fallback = "") {
  if (!ability) return fallback;
  return member.abilities?.find((name) => normalizeShowdownId(name) === normalizeShowdownId(ability)) ?? fallback;
}
export function resolveBattleUsageMoveIds(moves: PokemonMove[] | undefined, usageMoveIds: string[], limit = 4) {
  const lookup = new Map<string, PokemonMove>();
  for (const move of moves ?? []) {
    lookup.set(normalizeShowdownId(move.id), move);
    lookup.set(normalizeShowdownId(move.name), move);
  }
  return [...new Set(usageMoveIds.flatMap((id) => {
    const move = lookup.get(normalizeShowdownId(id));
    return move ? [move.id] : [];
  }))].slice(0, limit);
}
