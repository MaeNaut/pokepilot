import type { StatBlock } from "../types";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { toPokemonId } from "../utils/showdownText";

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
const SMOGON_FORMAT_ID = "gen9championsvgc2026regmb";
const SMOGON_USAGE_CACHE_KEY = "pokepilot:smogon-usage:v1";
const SMOGON_USAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const preferredCutoffs = [1630, 1500, 0];
const sectionLabels = new Set(["Abilities", "Items", "Spreads", "Moves"]);

let memorySnapshot: SmogonUsageSnapshot | null = null;

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

function getMovesetUrl(month: string, cutoff: number) {
  return `${SMOGON_STATS_BASE_URL}/${month}/moveset/${SMOGON_FORMAT_ID}-${cutoff}.txt`;
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

    if (activeSection === "Moves" && set.moveIds.length < 4) {
      set.moveIds.push(toPokemonId(label));
    }
  }

  return set;
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

function getCachedSnapshot() {
  try {
    const cachedValue = localStorage.getItem(SMOGON_USAGE_CACHE_KEY);

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
      localStorage.removeItem(SMOGON_USAGE_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: SmogonUsageSnapshot) {
  localStorage.setItem(
    SMOGON_USAGE_CACHE_KEY,
    JSON.stringify({
      ...snapshot,
      cachedAt: Date.now(),
    }),
  );
}

async function loadSmogonUsageSnapshot() {
  if (memorySnapshot) {
    return memorySnapshot;
  }

  const cached = getCachedSnapshot();

  if (cached) {
    memorySnapshot = cached;
    return cached;
  }

  for (const month of getMonthCandidates()) {
    for (const cutoff of preferredCutoffs) {
      try {
        const response = await fetch(getMovesetUrl(month, cutoff));

        if (!response.ok) {
          continue;
        }

        const snapshot = parseMovesetText(await response.text(), month, cutoff);

        if (snapshot.sets.length === 0) {
          continue;
        }

        memorySnapshot = snapshot;
        saveSnapshot(snapshot);
        return snapshot;
      } catch {
        // Try the next month/cutoff candidate.
      }
    }
  }

  return null;
}

export async function loadPopularSmogonSet(pokemonId: string) {
  const snapshot = await loadSmogonUsageSnapshot();
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

export async function loadSmogonUsagePokemonIds() {
  const snapshot = await loadSmogonUsageSnapshot();

  if (!snapshot) {
    throw new Error("Smogon usage data is unavailable.");
  }

  return snapshot.sets.map((set) => set.pokemonId);
}
