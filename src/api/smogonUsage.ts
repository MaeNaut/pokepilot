import type { PokemonMove, StatBlock, TeamMember } from "../types";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { toPokemonId } from "../utils/showdownText";
import { normalizeShowdownId } from "./showdownIds";

export type SmogonUsageSet = {
  pokemonId: string;
  pokemonName: string;
  sourceMonth: string;
  cutoff: number;
  ability?: string;
  itemName?: string;
  itemNames?: string[];
  itemOptions?: SmogonUsageOption[];
  nature?: string;
  evs?: Partial<StatBlock>;
  spreads?: SmogonUsageSpread[];
  moveIds: string[];
  moveOptions?: SmogonUsageOption[];
};

export type SmogonUsageOption = {
  id: string;
  usagePercent: number;
};

export type SmogonUsageSpread = {
  nature: string;
  evs: Partial<StatBlock>;
  usagePercent: number;
};

export function resolveSmogonUsageAbility(
  member: TeamMember,
  ability: string | undefined,
  fallback = "",
) {
  if (!ability) {
    return fallback;
  }

  const abilityId = normalizeShowdownId(ability);
  return member.abilities?.find(
    (name) => normalizeShowdownId(name) === abilityId,
  ) ?? ability;
}

export type SmogonUsageRegulation = "mc" | "mb";

export type SmogonUsageSource = {
  regulation: SmogonUsageRegulation;
  sourceMonth: string;
  cutoff: number;
};

type SmogonUsageSnapshot = SmogonUsageSource & {
  sets: SmogonUsageSet[];
};

type CachedSmogonUsageSnapshot = SmogonUsageSnapshot & { cachedAt: number };

const SMOGON_STATS_BASE_URL = "/smogon-stats";
const SMOGON_FORMAT_IDS: Record<SmogonUsageRegulation, Record<BattleFormat, string>> = {
  mc: {
    singles: "gen9championsbssregmc",
    doubles: "gen9championsvgc2026regmc",
  },
  mb: {
    singles: "gen9championsbssregmb",
    doubles: "gen9championsvgc2026regmb",
  },
};
const SMOGON_USAGE_CACHE_KEY = "pokepilot:smogon-usage:v7";
const SMOGON_USAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const SMOGON_FALLBACK_CACHE_TTL_MS = 1000 * 60 * 60;
const FIRST_MC_USAGE_MONTH = "2026-09";
const SMOGON_MOVE_CANDIDATE_LIMIT = 8;
const SMOGON_ITEM_CANDIDATE_LIMIT = 4;
const SMOGON_SPREAD_CANDIDATE_LIMIT = 6;
const preferredCutoffs = [1630, 1500, 0];
const sectionLabels = new Set([
  "Abilities",
  "Items",
  "Spreads",
  "Moves",
  "Teammates",
  "Checks and Counters",
]);

const memorySnapshots: Partial<Record<BattleFormat, CachedSmogonUsageSnapshot>> = {};
const smogonUsagePromises: Partial<
  Record<BattleFormat, Promise<SmogonUsageSnapshot | null>>
> = {};

function getMonthCandidates() {
  const candidates: string[] = [];
  const cursor = new Date();

  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() - 1);

  for (let index = 0; index < 12; index += 1) {
    candidates.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  return candidates;
}

export function getSmogonUsageFormatId(
  battleFormat: BattleFormat,
  regulation: SmogonUsageRegulation,
) {
  return SMOGON_FORMAT_IDS[regulation][battleFormat];
}

function getMovesetUrl(
  month: string,
  cutoff: number,
  battleFormat: BattleFormat,
  regulation: SmogonUsageRegulation,
) {
  return `${SMOGON_STATS_BASE_URL}/${month}/moveset/${getSmogonUsageFormatId(
    battleFormat,
    regulation,
  )}-${cutoff}.txt`;
}

function cleanTableRow(line: string) {
  const match = line.match(/^\s*\|\s*(.*?)\s*\|\s*$/);

  return match?.[1].trim();
}

function parsePercentEntry(line: string) {
  const match = line.match(/^(.+?)\s+([\d.]+)%$/);

  if (!match) {
    return null;
  }

  const label = match[1].trim();

  if (!label || label.toLowerCase() === "other") {
    return null;
  }

  return {
    label,
    usagePercent: Number.parseFloat(match[2]),
  };
}

function parseSpread(value: string) {
  const match = value.match(/^([^:]+):(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    nature: match[1].trim().toLowerCase(),
    evs: {
      hp: Number.parseInt(match[2], 10),
      attack: Number.parseInt(match[3], 10),
      defense: Number.parseInt(match[4], 10),
      specialAttack: Number.parseInt(match[5], 10),
      specialDefense: Number.parseInt(match[6], 10),
      speed: Number.parseInt(match[7], 10),
    },
  };
}

function parsePokemonBlock(
  pokemonName: string,
  block: string,
  sourceMonth: string,
  cutoff: number,
): SmogonUsageSet {
  const set: SmogonUsageSet = {
    pokemonId: toPokemonId(pokemonName),
    pokemonName,
    sourceMonth,
    cutoff,
    itemNames: [],
    itemOptions: [],
    spreads: [],
    moveIds: [],
    moveOptions: [],
  };
  let activeSection: string | null = null;

  for (const rawLine of block.split(/\r?\n/)) {
    const row = cleanTableRow(rawLine);

    if (!row) {
      continue;
    }

    if (sectionLabels.has(row)) {
      activeSection = row;
      continue;
    }

    if (!activeSection || row.includes(":") && !row.match(/^[^:]+:\d+\/\d+/)) {
      continue;
    }

    const percentEntry = parsePercentEntry(row);
    const label = percentEntry?.label ?? null;

    if (!label) {
      continue;
    }

    if (activeSection === "Abilities" && !set.ability) {
      set.ability = label;
      continue;
    }

    if (activeSection === "Items" && label !== "Nothing") {
      if (!set.itemName) set.itemName = label;
      if ((set.itemNames?.length ?? 0) < SMOGON_ITEM_CANDIDATE_LIMIT) {
        set.itemNames?.push(label);
        set.itemOptions?.push({
          id: normalizeShowdownId(label),
          usagePercent: percentEntry?.usagePercent ?? 0,
        });
      }
      continue;
    }

    if (activeSection === "Spreads") {
      const spread = parseSpread(label);

      if (spread) {
        if (!set.evs) {
          set.nature = spread.nature;
          set.evs = spread.evs;
        }
        if ((set.spreads?.length ?? 0) < SMOGON_SPREAD_CANDIDATE_LIMIT) {
          set.spreads?.push({
            ...spread,
            usagePercent: percentEntry?.usagePercent ?? 0,
          });
        }
      }

      continue;
    }

    if (
      activeSection === "Moves" &&
      label !== "Nothing" &&
      set.moveIds.length < SMOGON_MOVE_CANDIDATE_LIMIT
    ) {
      const moveId = normalizeShowdownId(label);
      set.moveIds.push(moveId);
      set.moveOptions?.push({
        id: moveId,
        usagePercent: percentEntry?.usagePercent ?? 0,
      });
    }
  }

  return set;
}

export function resolveSmogonUsageMoveIds(
  moves: PokemonMove[] | undefined,
  usageMoveIds: string[],
  limit = 4,
) {
  const movesByLookup = new Map<string, PokemonMove>();

  for (const move of moves ?? []) {
    movesByLookup.set(normalizeShowdownId(move.id), move);
    movesByLookup.set(normalizeShowdownId(move.name), move);
  }

  const resolvedMoveIds: string[] = [];

  for (const usageMoveId of usageMoveIds) {
    const move = movesByLookup.get(normalizeShowdownId(usageMoveId));

    if (move && !resolvedMoveIds.includes(move.id)) {
      resolvedMoveIds.push(move.id);
    }

    if (resolvedMoveIds.length >= limit) {
      break;
    }
  }

  return resolvedMoveIds;
}

export function parseSmogonMovesetText(
  text: string,
  sourceMonth: string,
  cutoff: number,
  regulation: SmogonUsageRegulation = "mb",
): SmogonUsageSnapshot {
  const headerPattern =
    /(?:^|\n)\s*\+-+\+\s*\n\s*\|\s*([^|\n]+?)\s*\|\s*\n\s*\+-+\+\s*\n\s*\|\s*Raw count:/g;
  const matches = [...text.matchAll(headerPattern)];
  const sets: SmogonUsageSet[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const pokemonName = match[1].trim();
    const blockStart = match.index ?? 0;
    const blockEnd = matches[index + 1]?.index ?? text.length;
    const block = text.slice(blockStart, blockEnd);

    sets.push(parsePokemonBlock(pokemonName, block, sourceMonth, cutoff));
  }

  return {
    regulation,
    sourceMonth,
    cutoff,
    sets,
  };
}

function getCacheKey(battleFormat: BattleFormat) {
  return `${SMOGON_USAGE_CACHE_KEY}:${battleFormat}`;
}

function isFreshSnapshot(snapshot: CachedSmogonUsageSnapshot) {
  return (
    (snapshot.regulation === "mc" || snapshot.regulation === "mb") &&
    Number.isFinite(snapshot.cachedAt) &&
    snapshot.cachedAt <= Date.now() &&
    Date.now() - snapshot.cachedAt <= (snapshot.regulation === "mc"
      ? SMOGON_USAGE_CACHE_TTL_MS
      : SMOGON_FALLBACK_CACHE_TTL_MS) &&
    /^\d{4}-\d{2}$/.test(snapshot.sourceMonth) &&
    preferredCutoffs.includes(snapshot.cutoff) &&
    Array.isArray(snapshot.sets) &&
    snapshot.sets.length > 0
  );
}

function getCachedSnapshot(battleFormat: BattleFormat) {
  try {
    const cacheKey = getCacheKey(battleFormat);
    const cachedValue = localStorage.getItem(cacheKey);

    if (!cachedValue) {
      return null;
    }

    const parsed = JSON.parse(cachedValue) as CachedSmogonUsageSnapshot;

    if (!isFreshSnapshot(parsed)) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveSnapshot(
  battleFormat: BattleFormat,
  snapshot: CachedSmogonUsageSnapshot,
) {
  try {
    localStorage.setItem(
      getCacheKey(battleFormat),
      JSON.stringify(snapshot),
    );
  } catch {
    // Usage data remains available in memory when browser storage is unavailable.
  }
}

async function fetchSmogonUsageSnapshot(battleFormat: BattleFormat) {
  for (const regulation of ["mc", "mb"] as const) {
    for (const month of getMonthCandidates()) {
      if (regulation === "mc" && month < FIRST_MC_USAGE_MONTH) {
        continue;
      }
      for (const cutoff of preferredCutoffs) {
        try {
          const response = await fetch(
            getMovesetUrl(month, cutoff, battleFormat, regulation),
          );

          if (!response.ok) {
            continue;
          }

          const snapshot = parseSmogonMovesetText(
            await response.text(),
            month,
            cutoff,
            regulation,
          );

          if (snapshot.sets.length === 0) {
            continue;
          }

          const cachedSnapshot = { ...snapshot, cachedAt: Date.now() };
          memorySnapshots[battleFormat] = cachedSnapshot;
          saveSnapshot(battleFormat, cachedSnapshot);
          return snapshot;
        } catch {
          // Try the next month/cutoff candidate.
        }
      }
    }
  }

  return null;
}

async function loadSmogonUsageSnapshot(battleFormat: BattleFormat) {
  const memorySnapshot = memorySnapshots[battleFormat];

  if (memorySnapshot && isFreshSnapshot(memorySnapshot)) {
    return memorySnapshot;
  }
  delete memorySnapshots[battleFormat];

  const cached = getCachedSnapshot(battleFormat);

  if (cached) {
    memorySnapshots[battleFormat] = cached;
    return cached;
  }

  if (!smogonUsagePromises[battleFormat]) {
    smogonUsagePromises[battleFormat] =
      fetchSmogonUsageSnapshot(battleFormat);
  }

  try {
    return await smogonUsagePromises[battleFormat];
  } finally {
    delete smogonUsagePromises[battleFormat];
  }
}

export async function loadPopularSmogonSet(
  pokemonId: string,
  battleFormat: BattleFormat = "doubles",
) {
  const snapshot = await loadSmogonUsageSnapshot(battleFormat);
  const lookupCandidates = getPokemonLookupAliases(pokemonId).map(toPokemonId);

  if (!snapshot || lookupCandidates.length === 0) {
    return null;
  }

  const exactMatch = lookupCandidates
    .map((candidate) => snapshot.sets.find((set) => set.pokemonId === candidate))
    .find((set): set is SmogonUsageSet => Boolean(set));

  if (exactMatch) {
    return exactMatch;
  }

  return (
    lookupCandidates
      .map((candidate) =>
        snapshot.sets.find((set) => set.pokemonId.startsWith(`${candidate}-`)),
      )
      .find((set): set is SmogonUsageSet => Boolean(set)) ?? null
  );
}

export async function loadSmogonUsagePokemonIds(
  battleFormat: BattleFormat = "doubles",
) {
  const snapshot = await loadSmogonUsageSnapshot(battleFormat);

  if (!snapshot) {
    throw new Error("Smogon usage data is unavailable.");
  }

  return snapshot.sets.map((set) => set.pokemonId);
}

export async function loadSmogonUsageSets(
  battleFormat: BattleFormat = "doubles",
) {
  const snapshot = await loadSmogonUsageSnapshot(battleFormat);

  if (!snapshot) {
    throw new Error("Smogon usage data is unavailable.");
  }

  return snapshot.sets;
}

export async function loadSmogonUsageSource(
  battleFormat: BattleFormat = "doubles",
): Promise<SmogonUsageSource | null> {
  const snapshot = await loadSmogonUsageSnapshot(battleFormat);

  if (!snapshot) {
    return null;
  }

  return {
    regulation: snapshot.regulation,
    sourceMonth: snapshot.sourceMonth,
    cutoff: snapshot.cutoff,
  };
}
