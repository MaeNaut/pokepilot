export type ShowdownLegalitySnapshot = {
  pokemonIds: Set<string>;
  knownPokemonIds: Set<string>;
  itemIds: Set<string>;
  abilityByPokemon: Map<string, Set<string>>;
  moveByPokemon: Map<string, Set<string>>;
  loadedFormatId: string;
  dataMod: string;
  generatedAt: number;
  source: "showdown";
  error?: string;
};

type ShowdownPokedexEntry = {
  tier?: string;
  isNonstandard?: string | null;
  abilities?: unknown;
  tags?: string[];
};

type ShowdownLearnsetEntry = {
  learnset?: Record<string, string[] | unknown>;
};

type ShowdownFormatsDataEntry = {
  tier?: string;
  isNonstandard?: string | null;
};

type ShowdownFormatSource = {
  dataMod: "base" | "champions";
  formatsDataUrl?: string;
  learnsetsUrl?: string;
  itemsUrl?: string;
  teambuilderTablesUrl?: string;
};

const SHOWDOWN_POKEDEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";
const SHOWDOWN_LEARNSETS_URL = "https://play.pokemonshowdown.com/data/learnsets.json";
const SHOWDOWN_TEAMBUILDER_TABLES_URL =
  "https://play.pokemonshowdown.com/data/teambuilder-tables.js";
const SHOWDOWN_RAW_BASE_URL =
  "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods";
const SHOWDOWN_CHAMPIONS_FORMATS_DATA_URL = `${SHOWDOWN_RAW_BASE_URL}/champions/formats-data.ts`;
const SHOWDOWN_CHAMPIONS_LEARNSETS_URL = `${SHOWDOWN_RAW_BASE_URL}/champions/learnsets.ts`;
const SHOWDOWN_CHAMPIONS_ITEMS_URL = `${SHOWDOWN_RAW_BASE_URL}/champions/items.ts`;
const SHOWDOWN_LEGALITY_CACHE_PREFIX = "pokepilot:showdown-legality:v5:";
const SHOWDOWN_DEFAULT_FORMAT_ID = "showdown-default";
const SHOWDOWN_LEGALITY_TTL_MS = 1000 * 60 * 60 * 12;

const LEGALITY_EXCLUDED_TIERS = new Set(["illegal"]);
const FLAT_RULE_BANNED_TAGS = new Set(["mythical", "restricted legendary"]);

type CachePayload = {
  loadedFormatId: string;
  dataMod: string;
  generatedAt: number;
  pokemonIds: string[];
  knownPokemonIds: string[];
  itemIds: string[];
  abilityByPokemon: Array<[string, string[]]>;
  moveByPokemon: Array<[string, string[]]>;
};

export function getShowdownLookupKeys(value: string) {
  const cleaned = value.trim().toLowerCase();

  if (!cleaned) {
    return [];
  }

  const noSeparator = cleaned.replace(/[^a-z0-9]/g, "");
  const dashed = cleaned.replace(/[^a-z0-9]+/g, "-");

  const values = [cleaned, dashed, noSeparator];
  const genderMatch = dashed.match(/^(.+)-(male|female)(-.+)?$/);

  if (genderMatch) {
    const [, baseName, gender, suffix = ""] = genderMatch;

    if (gender === "female") {
      values.push(`${baseName}f${suffix}`, `${baseName}-f${suffix}`);
    } else {
      values.push(`${baseName}${suffix}`, baseName);
    }
  }

  return [...new Set(values)];
}

function getBaseSpeciesKey(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return;
  }

  const parts = normalized.split("-");
  if (parts.length <= 1) {
    return;
  }

  return parts[0];
}

function collectCandidateLookupKeys(pokemonId: string, speciesKey?: string) {
  const keys = new Set<string>();

  for (const key of getShowdownLookupKeys(pokemonId)) {
    keys.add(key);
    keys.add(normalizeLookup(key));
  }

  if (speciesKey) {
    for (const key of getShowdownLookupKeys(speciesKey)) {
      keys.add(key);
      keys.add(normalizeLookup(key));
    }

    const baseSpecies = getBaseSpeciesKey(speciesKey);
    if (baseSpecies) {
      for (const key of getShowdownLookupKeys(baseSpecies)) {
        keys.add(key);
        keys.add(normalizeLookup(key));
      }
    }
  }

  return keys;
}

function findSetByPokemonKey(
  source: Map<string, Set<string>>,
  pokemonId: string,
  speciesKey?: string,
) {
  const normalizedInput = pokemonId.trim().toLowerCase();
  const candidates = collectCandidateLookupKeys(normalizedInput, speciesKey);
  const result = new Set<string>();

  for (const key of candidates) {
    const entry = source.get(key);
    if (entry && entry.size > 0) {
      for (const move of entry) {
        result.add(move);
      }
    }
  }

  return result.size > 0 ? result : null;
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeAbility(value: string) {
  return normalizeLookup(value);
}

function hasMoveEntry(value: unknown): value is Record<string, string[] | unknown> {
  return typeof value === "object" && value !== null;
}

function asShowdownPokedexEntry(value: unknown): ShowdownPokedexEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;

  return {
    tier: typeof entry.tier === "string" ? entry.tier : undefined,
    isNonstandard: typeof entry.isNonstandard === "string" ? entry.isNonstandard : null,
    abilities: entry.abilities,
    tags: Array.isArray(entry.tags)
      ? entry.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined,
  };
}

function asShowdownLearnsetEntry(value: unknown): ShowdownLearnsetEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const learnset = hasMoveEntry(entry.learnset) ? (entry.learnset as Record<string, string[] | unknown>) : null;

  return {
    learnset: learnset ?? undefined,
  };
}

function parseAbilityValue(value: unknown): string[] {
  if (!value) {
    return [];
  }

  const values: string[] = [];

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      values.push(...parseAbilityValue(item));
    }

    return values;
  }

  if (typeof value === "object" && value !== null) {
    for (const raw of Object.values(value as Record<string, unknown>)) {
      values.push(...parseAbilityValue(raw));
    }
  }

  return values.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function extractAbilitySet(rawAbilities: unknown) {
  const abilities = parseAbilityValue(rawAbilities);

  return new Set(
    abilities
      .map((ability) => normalizeAbility(ability))
      .filter((ability) => ability.length > 0),
  );
}

function hasBannedFlatRulesTag(entry: ShowdownPokedexEntry | null) {
  return Boolean(
    entry?.tags?.some((tag) => FLAT_RULE_BANNED_TAGS.has(tag.toLowerCase())),
  );
}

function isCurrentStandard(entry: { isNonstandard?: string | null }) {
  return !entry.isNonstandard;
}

function isLegalPokemon(
  formatsEntry: ShowdownFormatsDataEntry | ShowdownPokedexEntry,
  pokedexEntry: ShowdownPokedexEntry | null,
) {
  if (formatsEntry.tier && LEGALITY_EXCLUDED_TIERS.has(formatsEntry.tier.toLowerCase())) {
    return false;
  }

  if (!isCurrentStandard(formatsEntry)) {
    return false;
  }

  if (hasBannedFlatRulesTag(pokedexEntry)) {
    return false;
  }

  return true;
}

function getFormatSource(formatId: string): ShowdownFormatSource {
  const normalized = normalizeLookup(formatId);
  const isChampionsRegulationMb =
    normalized === "gen9regulationmb" ||
    normalized === "gen9championsbssregmb" ||
    normalized === "gen9championsvgc2026regmb" ||
    normalized.includes("championsregmb") ||
    normalized.includes("regulationmb");

  if (isChampionsRegulationMb) {
    return {
      dataMod: "champions",
      formatsDataUrl: SHOWDOWN_CHAMPIONS_FORMATS_DATA_URL,
      learnsetsUrl: SHOWDOWN_CHAMPIONS_LEARNSETS_URL,
      itemsUrl: SHOWDOWN_CHAMPIONS_ITEMS_URL,
      teambuilderTablesUrl: SHOWDOWN_TEAMBUILDER_TABLES_URL,
    };
  }

  return { dataMod: "base" };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { mode: "cors" });

  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function fetchText(url: string) {
  const response = await fetch(url, { mode: "cors" });

  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }

  return response.text();
}

function toSetList(entries: Map<string, Set<string>>) {
  return Array.from(entries).map(([key, set]) => [key, Array.from(set)] as [string, string[]]);
}

function restoreSetList(
  entries: Array<[string, string[]]>,
): Map<string, Set<string>> {
  return new Map(
    entries.map(([key, values]) => [key, new Set(values.map((value) => normalizeLookup(value)))]),
  );
}

function countBraceDelta(line: string) {
  const openCount = line.match(/\{/g)?.length ?? 0;
  const closeCount = line.match(/\}/g)?.length ?? 0;

  return openCount - closeCount;
}

function parseTopLevelObjectBlocks(text: string) {
  const blocks = new Map<string, string>();
  const lines = text.split(/\r?\n/);
  let activeKey: string | null = null;
  let activeDepth = 0;
  let activeLines: string[] = [];

  for (const line of lines) {
    if (!activeKey) {
      const match = line.match(/^\s*([a-z0-9]+):\s*\{/);

      if (!match) {
        continue;
      }

      activeKey = normalizeLookup(match[1]);
      activeDepth = countBraceDelta(line);
      activeLines = [];

      if (activeDepth <= 0) {
        blocks.set(activeKey, "");
        activeKey = null;
      }

      continue;
    }

    activeDepth += countBraceDelta(line);

    if (activeDepth <= 0) {
      blocks.set(activeKey, activeLines.join("\n"));
      activeKey = null;
      activeLines = [];
      activeDepth = 0;
      continue;
    }

    activeLines.push(line);
  }

  return blocks;
}

function extractTsStringField(block: string, fieldName: string) {
  const pattern = new RegExp(`${fieldName}\\s*:\\s*(?:"([^"]+)"|'([^']+)'|null)`);
  const match = block.match(pattern);

  if (!match) {
    return undefined;
  }

  return match[1] ?? match[2] ?? null;
}

function parseFormatsData(text: string): Map<string, ShowdownFormatsDataEntry> {
  const blocks = parseTopLevelObjectBlocks(text);
  const entries = new Map<string, ShowdownFormatsDataEntry>();

  for (const [key, block] of blocks) {
    const tier = extractTsStringField(block, "tier");
    const isNonstandard = extractTsStringField(block, "isNonstandard");

    entries.set(key, {
      tier: typeof tier === "string" ? tier : undefined,
      isNonstandard:
        typeof isNonstandard === "string"
          ? isNonstandard
          : isNonstandard === null
            ? null
            : undefined,
    });
  }

  return entries;
}

function parseLearnsets(text: string): Map<string, Set<string>> {
  const blocks = parseTopLevelObjectBlocks(text);
  const entries = new Map<string, Set<string>>();

  for (const [key, block] of blocks) {
    const moveSet = new Set<string>();

    for (const line of block.split(/\r?\n/)) {
      const match = line.match(/^\s*([a-z0-9]+):\s*\[/);

      if (match) {
        moveSet.add(normalizeLookup(match[1]));
      }
    }

    if (moveSet.size > 0) {
      entries.set(key, moveSet);
    }
  }

  return entries;
}

function parseItems(text: string): Set<string> {
  const blocks = parseTopLevelObjectBlocks(text);
  const itemIds = new Set<string>();

  for (const [key, block] of blocks) {
    const isNonstandard = extractTsStringField(block, "isNonstandard");

    if (typeof isNonstandard === "string") {
      continue;
    }

    itemIds.add(key);
  }

  return itemIds;
}

type TeamBuilderTableSection = {
  items?: unknown;
};

type TeamBuilderTable = TeamBuilderTableSection & {
  champions?: TeamBuilderTableSection;
};

function parseTeamBuilderTable(text: string): TeamBuilderTable | null {
  const prefix = "JSON.parse('";
  const start = text.indexOf(prefix);
  const end = text.lastIndexOf("');");

  if (start < 0 || end <= start) {
    return null;
  }

  const jsonText = text.slice(start + prefix.length, end).replace(/\\'/g, "'");

  try {
    const parsed = JSON.parse(jsonText) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as TeamBuilderTable;
  } catch {
    return null;
  }
}

function collectTeamBuilderItems(rawItems: unknown) {
  const itemIds = new Set<string>();

  if (!Array.isArray(rawItems)) {
    return itemIds;
  }

  for (const item of rawItems) {
    if (typeof item === "string") {
      addLookupVariants(itemIds, item);
    }
  }

  return itemIds;
}

function parseTeamBuilderItems(text: string, dataMod: ShowdownFormatSource["dataMod"]) {
  const table = parseTeamBuilderTable(text);
  const section = dataMod === "champions" ? table?.champions : table;

  return collectTeamBuilderItems(section?.items ?? table?.items);
}

function addLookupVariants(target: Set<string>, value: string) {
  for (const key of getShowdownLookupKeys(value)) {
    target.add(key);
    target.add(normalizeLookup(key));
  }

  target.add(normalizeLookup(value));
}

function setByLookupVariants(
  target: Map<string, Set<string>>,
  value: string,
  source: Set<string>,
) {
  for (const key of getShowdownLookupKeys(value)) {
    target.set(key, new Set(source));
    target.set(normalizeLookup(key), new Set(source));
  }

  target.set(normalizeLookup(value), new Set(source));
}

function buildMoveMapFromLearnsets(payload: Record<string, unknown>) {
  const moveByPokemon = new Map<string, Set<string>>();

  for (const [entryName, entryValue] of Object.entries(payload)) {
    const entry = asShowdownLearnsetEntry(entryValue);
    const learnset = entry?.learnset;

    if (!learnset) {
      continue;
    }

    const moveSet = new Set<string>();

    for (const moveName of Object.keys(learnset)) {
      moveSet.add(normalizeLookup(moveName));
    }

    setByLookupVariants(moveByPokemon, entryName, moveSet);
  }

  return moveByPokemon;
}

function getCachedSnapshot(formatId: string): ShowdownLegalitySnapshot | null {
  try {
    const cachedValue = localStorage.getItem(`${SHOWDOWN_LEGALITY_CACHE_PREFIX}${formatId}`);
    if (!cachedValue) {
      return null;
    }

    const parsed = JSON.parse(cachedValue) as CachePayload & { error?: string };
    const hasRequired =
      typeof parsed.generatedAt === "number" &&
      typeof parsed.dataMod === "string" &&
      Array.isArray(parsed.pokemonIds) &&
      Array.isArray(parsed.knownPokemonIds) &&
      Array.isArray(parsed.itemIds) &&
      Array.isArray(parsed.abilityByPokemon) &&
      Array.isArray(parsed.moveByPokemon);

    if (!hasRequired) {
      localStorage.removeItem(`${SHOWDOWN_LEGALITY_CACHE_PREFIX}${formatId}`);
      return null;
    }

    const isFresh = Date.now() - parsed.generatedAt < SHOWDOWN_LEGALITY_TTL_MS;
    if (!isFresh) {
      localStorage.removeItem(`${SHOWDOWN_LEGALITY_CACHE_PREFIX}${formatId}`);
      return null;
    }

    return {
      loadedFormatId: parsed.loadedFormatId,
      dataMod: parsed.dataMod,
      generatedAt: parsed.generatedAt,
      pokemonIds: new Set(parsed.pokemonIds.map((value) => normalizeLookup(value))),
      knownPokemonIds: new Set(
        parsed.knownPokemonIds.map((value) => normalizeLookup(value)),
      ),
      itemIds: new Set(parsed.itemIds.map((value) => normalizeLookup(value))),
      abilityByPokemon: restoreSetList(parsed.abilityByPokemon),
      moveByPokemon: restoreSetList(parsed.moveByPokemon),
      source: "showdown",
    };
  } catch {
    return null;
  }
}

function saveSnapshot(formatId: string, snapshot: ShowdownLegalitySnapshot) {
  const payload: CachePayload = {
    loadedFormatId: snapshot.loadedFormatId,
    dataMod: snapshot.dataMod,
    generatedAt: snapshot.generatedAt,
    pokemonIds: Array.from(snapshot.pokemonIds),
    knownPokemonIds: Array.from(snapshot.knownPokemonIds),
    itemIds: Array.from(snapshot.itemIds),
    abilityByPokemon: toSetList(snapshot.abilityByPokemon),
    moveByPokemon: toSetList(snapshot.moveByPokemon),
  };

  localStorage.setItem(`${SHOWDOWN_LEGALITY_CACHE_PREFIX}${formatId}`, JSON.stringify(payload));
}

export async function loadShowdownLegality(
  formatId: string = SHOWDOWN_DEFAULT_FORMAT_ID,
): Promise<ShowdownLegalitySnapshot> {
  const cached = getCachedSnapshot(formatId);
  if (cached) {
    return cached;
  }

  const source = getFormatSource(formatId);

  try {
    const [
      pokedexPayload,
      learnsetPayload,
      formatsDataText,
      championsLearnsetsText,
      itemsText,
      teambuilderTablesText,
    ] = await Promise.all([
      fetchJson<Record<string, unknown>>(SHOWDOWN_POKEDEX_URL),
      fetchJson<Record<string, unknown>>(SHOWDOWN_LEARNSETS_URL),
      source.formatsDataUrl ? fetchText(source.formatsDataUrl) : Promise.resolve(null),
      source.learnsetsUrl ? fetchText(source.learnsetsUrl) : Promise.resolve(null),
      source.itemsUrl ? fetchText(source.itemsUrl) : Promise.resolve(null),
      source.teambuilderTablesUrl
        ? fetchText(source.teambuilderTablesUrl)
        : Promise.resolve(null),
    ]);

    const pokemonIds = new Set<string>();
    const knownPokemonIds = new Set<string>();
    const itemIds = teambuilderTablesText
      ? parseTeamBuilderItems(teambuilderTablesText, source.dataMod)
      : new Set<string>();

    if (itemIds.size === 0 && itemsText) {
      for (const itemId of parseItems(itemsText)) {
        addLookupVariants(itemIds, itemId);
      }
    }

    const abilityByPokemon = new Map<string, Set<string>>();
    const baseMoveByPokemon = buildMoveMapFromLearnsets(learnsetPayload);
    const moveByPokemon = new Map(baseMoveByPokemon);
    const formatsData = formatsDataText ? parseFormatsData(formatsDataText) : null;
    const championsMoveByPokemon = championsLearnsetsText
      ? parseLearnsets(championsLearnsetsText)
      : null;

    for (const [entryName, entryValue] of Object.entries(pokedexPayload)) {
      const entry = asShowdownPokedexEntry(entryValue);

      if (!entry) {
        continue;
      }

      const keys = getShowdownLookupKeys(entryName);
      const normalized = normalizeLookup(entryName);
      const abilitySet = extractAbilitySet(entry.abilities);

      setByLookupVariants(
        abilityByPokemon,
        entryName,
        new Set(Array.from(abilitySet).map(normalizeAbility)),
      );

      if (source.dataMod !== "base") {
        continue;
      }

      for (const key of keys) {
        knownPokemonIds.add(key);
        knownPokemonIds.add(normalized);
      }

      if (!isLegalPokemon(entry, entry)) {
        continue;
      }

      addLookupVariants(pokemonIds, entryName);
    }

    if (formatsData) {
      for (const [entryName, entry] of formatsData) {
        const pokedexEntry = asShowdownPokedexEntry(pokedexPayload[entryName]);
        addLookupVariants(knownPokemonIds, entryName);

        if (!isLegalPokemon(entry, pokedexEntry)) {
          continue;
        }

        addLookupVariants(pokemonIds, entryName);
      }
    }

    if (championsMoveByPokemon) {
      for (const [entryName, moveSet] of championsMoveByPokemon) {
        setByLookupVariants(moveByPokemon, entryName, moveSet);
      }
    }

    const snapshot: ShowdownLegalitySnapshot = {
      pokemonIds,
      knownPokemonIds,
      itemIds,
      abilityByPokemon,
      moveByPokemon,
      loadedFormatId: formatId,
      dataMod: source.dataMod,
      generatedAt: Date.now(),
      source: "showdown",
    };

    saveSnapshot(formatId, snapshot);
    return snapshot;
  } catch (error) {
    return {
      pokemonIds: new Set<string>(),
      knownPokemonIds: new Set<string>(),
      itemIds: new Set<string>(),
      abilityByPokemon: new Map<string, Set<string>>(),
      moveByPokemon: new Map<string, Set<string>>(),
      loadedFormatId: formatId,
      dataMod: source.dataMod,
      generatedAt: Date.now(),
      source: "showdown",
      error: error instanceof Error ? error.message : "Unknown legality fetch error.",
    };
  }
}

export function isPokemonLegal(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
) {
  if (!showdownLegality || showdownLegality.pokemonIds.size === 0) {
    return true;
  }

  const exactKeys = getShowdownLookupKeys(pokemonId).map((lookup) => normalizeLookup(lookup));

  if (exactKeys.some((lookup) => showdownLegality.pokemonIds.has(lookup))) {
    return true;
  }

  if (exactKeys.some((lookup) => showdownLegality.knownPokemonIds.has(lookup))) {
    return false;
  }

  return [...collectCandidateLookupKeys(pokemonId, speciesKey)].some((lookup) =>
    showdownLegality.pokemonIds.has(lookup),
  );
}

export function isItemLegal(
  showdownLegality: ShowdownLegalitySnapshot | null,
  itemId: string,
) {
  if (!showdownLegality || showdownLegality.itemIds.size === 0) {
    return true;
  }

  return getShowdownLookupKeys(itemId).some((lookup) =>
    showdownLegality.itemIds.has(normalizeLookup(lookup)),
  );
}

export function getLegalAbilities(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
) {
  if (!showdownLegality || showdownLegality.abilityByPokemon.size === 0) {
    return null;
  }

  return findSetByPokemonKey(showdownLegality.abilityByPokemon, pokemonId, speciesKey);
}

export function getLegalMoves(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
) {
  if (!showdownLegality || showdownLegality.moveByPokemon.size === 0) {
    return null;
  }

  return findSetByPokemonKey(showdownLegality.moveByPokemon, pokemonId, speciesKey);
}
