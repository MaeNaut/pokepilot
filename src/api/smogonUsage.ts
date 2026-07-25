import type { PokemonMove, StatBlock } from "../types";
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
  nature?: string;
  evs?: Partial<StatBlock>;
  moveIds: string[];
};

type SmogonUsageSnapshot = {
  sourceMonth: string;
  cutoff: number;
  sets: SmogonUsageSet[];
};

const SMOGON_STATS_BASE_URL = "/smogon-stats";
const SMOGON_FORMAT_IDS: Record<BattleFormat, string> = {
  singles: "gen9championsbssregmb",
  doubles: "gen9championsvgc2026regmb",
};
const SMOGON_USAGE_CACHE_KEY = "pokepilot:smogon-usage:v3";
const SMOGON_USAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const SMOGON_MOVE_CANDIDATE_LIMIT = 8;
const preferredCutoffs = [1630, 1500, 0];
const sectionLabels = new Set([
  "Abilities",
  "Items",
  "Spreads",
  "Moves",
  "Teammates",
  "Checks and Counters",
]);

const memorySnapshots: Partial<Record<BattleFormat, SmogonUsageSnapshot>> = {};
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

export function getSmogonUsageFormatId(battleFormat: BattleFormat) {
  return SMOGON_FORMAT_IDS[battleFormat];
}

function getMovesetUrl(
  month: string,
  cutoff: number,
  battleFormat: BattleFormat,
) {
  return `${SMOGON_STATS_BASE_URL}/${month}/moveset/${getSmogonUsageFormatId(
    battleFormat,
  )}-${cutoff}.txt`;
}

function cleanTableRow(line: string) {
  const match = line.match(/^\s*\|\s*(.*?)\s*\|\s*$/);

  return match?.[1].trim();
}

function parsePercentLine(line: string) {
  const match = line.match(/^(.+?)\s+([\d.]+)%$/);

  if (!match) {
    return null;
  }

  const label = match[1].trim();

  if (!label || label.toLowerCase() === "other") {
    return null;
  }

  return label;
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
    moveIds: [],
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

    const label = parsePercentLine(row);

    if (!label) {
      continue;
    }

    if (activeSection === "Abilities" && !set.ability) {
      set.ability = label;
      continue;
    }

    if (activeSection === "Items" && !set.itemName && label !== "Nothing") {
      set.itemName = label;
      continue;
    }

    if (activeSection === "Spreads" && !set.evs) {
      const spread = parseSpread(label);

      if (spread) {
        set.nature = spread.nature;
        set.evs = spread.evs;
      }

      continue;
    }

    if (
      activeSection === "Moves" &&
      label !== "Nothing" &&
      set.moveIds.length < SMOGON_MOVE_CANDIDATE_LIMIT
    ) {
      set.moveIds.push(normalizeShowdownId(label));
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

function parseMovesetText(
  text: string,
  sourceMonth: string,
  cutoff: number,
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
    sourceMonth,
    cutoff,
    sets,
  };
}

function getCacheKey(battleFormat: BattleFormat) {
  return `${SMOGON_USAGE_CACHE_KEY}:${battleFormat}`;
}

function getCachedSnapshot(battleFormat: BattleFormat) {
  try {
    const cacheKey = getCacheKey(battleFormat);
    const cachedValue = localStorage.getItem(cacheKey);

    if (!cachedValue) {
      return null;
    }

    const parsed = JSON.parse(cachedValue) as SmogonUsageSnapshot & {
      cachedAt?: number;
    };

    if (
      !parsed.cachedAt ||
      Date.now() - parsed.cachedAt > SMOGON_USAGE_CACHE_TTL_MS ||
      !Array.isArray(parsed.sets)
    ) {
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
  snapshot: SmogonUsageSnapshot,
) {
  try {
    localStorage.setItem(
      getCacheKey(battleFormat),
      JSON.stringify({
        ...snapshot,
        cachedAt: Date.now(),
      }),
    );
  } catch {
    // Usage data remains available in memory when browser storage is unavailable.
  }
}

async function fetchSmogonUsageSnapshot(battleFormat: BattleFormat) {
  for (const month of getMonthCandidates()) {
    for (const cutoff of preferredCutoffs) {
      try {
        const response = await fetch(
          getMovesetUrl(month, cutoff, battleFormat),
        );

        if (!response.ok) {
          continue;
        }

        const snapshot = parseMovesetText(await response.text(), month, cutoff);

        if (snapshot.sets.length === 0) {
          continue;
        }

        memorySnapshots[battleFormat] = snapshot;
        saveSnapshot(battleFormat, snapshot);
        return snapshot;
      } catch {
        // Try the next month/cutoff candidate.
      }
    }
  }

  return null;
}

async function loadSmogonUsageSnapshot(battleFormat: BattleFormat) {
  const memorySnapshot = memorySnapshots[battleFormat];

  if (memorySnapshot) {
    return memorySnapshot;
  }

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
