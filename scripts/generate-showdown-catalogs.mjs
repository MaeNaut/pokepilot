import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SHOWDOWN_DATA_URL = "https://play.pokemonshowdown.com/data";
const SHOWDOWN_MODS_URL =
  "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods";
const SOURCES = {
  abilities: `${SHOWDOWN_DATA_URL}/abilities.js`,
  baseLearnsets: `${SHOWDOWN_DATA_URL}/learnsets.json`,
  championsFormats: `${SHOWDOWN_MODS_URL}/champions/formats-data.ts`,
  championsItems: `${SHOWDOWN_MODS_URL}/champions/items.ts`,
  championsLearnsets: `${SHOWDOWN_MODS_URL}/champions/learnsets.ts`,
  items: `${SHOWDOWN_DATA_URL}/items.js`,
  pokedex: `${SHOWDOWN_DATA_URL}/pokedex.json`,
  teambuilderTables: `${SHOWDOWN_DATA_URL}/teambuilder-tables.js`,
};
const REGULATION_MB_FORMAT_ID = "gen9-regulation-mb";
const LEGALITY_EXCLUDED_TIERS = new Set(["illegal"]);
const FLAT_RULE_BANNED_TAGS = new Set(["mythical", "restricted legendary"]);
const LEARNSET_PARENT_OVERRIDES = new Map([
  ["floettemega", "floetteeternal"],
]);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "public", "data");

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeAssetId(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchSource(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status}).`);
  }

  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchSource(url));
}

function readShowdownExport(source, exportName, sourceUrl) {
  const sandbox = { exports: {} };

  vm.runInNewContext(source, sandbox, {
    filename: sourceUrl,
    timeout: 5_000,
  });

  const value = sandbox.exports[exportName];

  if (!value || typeof value !== "object") {
    throw new Error(`${exportName} was not present in ${sourceUrl}.`);
  }

  return value;
}

function compareCatalogEntries(first, second) {
  const firstNumber = first.number > 0 ? first.number : Number.MAX_SAFE_INTEGER;
  const secondNumber = second.number > 0 ? second.number : Number.MAX_SAFE_INTEGER;

  return firstNumber - secondNumber || first.name.localeCompare(second.name);
}

function normalizeItems(rawItems) {
  return Object.entries(rawItems)
    .map(([showdownId, item]) => ({
      showdownId,
      assetId: normalizeAssetId(item.name ?? showdownId),
      name: item.name ?? showdownId,
      number: typeof item.num === "number" ? item.num : 0,
      description: item.desc ?? "",
      shortDescription: item.shortDesc ?? item.desc ?? "",
      isMegaStone: Boolean(item.megaStone),
    }))
    .filter((item) => item.assetId && item.name)
    .sort(compareCatalogEntries);
}

function normalizeAbilities(rawAbilities) {
  return Object.entries(rawAbilities)
    .map(([showdownId, ability]) => ({
      showdownId,
      name: ability.name ?? showdownId,
      number: typeof ability.num === "number" ? ability.num : 0,
      description: ability.desc ?? "",
      shortDescription: ability.shortDesc ?? ability.desc ?? "",
    }))
    .filter((ability) => ability.showdownId && ability.name)
    .sort(compareCatalogEntries);
}

function countBraceDelta(line) {
  return (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
}

function parseTopLevelObjectBlocks(text) {
  const blocks = new Map();
  let activeKey = null;
  let activeDepth = 0;
  let activeLines = [];

  for (const line of text.split(/\r?\n/)) {
    if (!activeKey) {
      const match = line.match(/^\s*([a-z0-9]+):\s*\{/);

      if (!match) {
        continue;
      }

      activeKey = normalizeId(match[1]);
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
      activeDepth = 0;
      activeLines = [];
      continue;
    }

    activeLines.push(line);
  }

  return blocks;
}

function extractTsStringField(block, fieldName) {
  const pattern = new RegExp(`${fieldName}\\s*:\\s*(?:"([^"]+)"|'([^']+)'|null)`);
  const match = block.match(pattern);

  if (!match) {
    return undefined;
  }

  return match[1] ?? match[2] ?? null;
}

function parseFormatsData(text) {
  const entries = new Map();

  for (const [key, block] of parseTopLevelObjectBlocks(text)) {
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

function parseLearnsets(text) {
  const entries = new Map();

  for (const [key, block] of parseTopLevelObjectBlocks(text)) {
    const moves = new Set();

    for (const line of block.split(/\r?\n/)) {
      const match = line.match(/^\s*([a-z0-9]+):\s*\[/);

      if (match) {
        moves.add(normalizeId(match[1]));
      }
    }

    if (moves.size > 0) {
      entries.set(key, moves);
    }
  }

  return entries;
}

function parseItems(text) {
  const itemIds = new Set();

  for (const [key, block] of parseTopLevelObjectBlocks(text)) {
    if (typeof extractTsStringField(block, "isNonstandard") !== "string") {
      itemIds.add(key);
    }
  }

  return itemIds;
}

function parseTeamBuilderTable(text) {
  const prefix = "JSON.parse('";
  const start = text.indexOf(prefix);
  const end = text.lastIndexOf("');");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start + prefix.length, end).replace(/\\'/g, "'"));
  } catch {
    return null;
  }
}

function parseTeamBuilderItems(text) {
  const table = parseTeamBuilderTable(text);
  const rawItems = table?.champions?.items ?? table?.items;

  if (!Array.isArray(rawItems)) {
    return new Set();
  }

  return new Set(
    rawItems
      .filter((item) => typeof item === "string")
      .map(normalizeId)
      .filter(Boolean),
  );
}

function parseAbilityValue(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(parseAbilityValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(parseAbilityValue);
  }

  return [];
}

function isLegalPokemon(formatsEntry, pokedexEntry) {
  if (
    formatsEntry.tier &&
    LEGALITY_EXCLUDED_TIERS.has(formatsEntry.tier.toLowerCase())
  ) {
    return false;
  }

  if (formatsEntry.isNonstandard) {
    return false;
  }

  return !pokedexEntry?.tags?.some((tag) =>
    FLAT_RULE_BANNED_TAGS.has(String(tag).toLowerCase()),
  );
}

function getLearnsetMoves(entry) {
  if (!entry?.learnset || typeof entry.learnset !== "object") {
    return null;
  }

  const moves = Object.keys(entry.learnset).map(normalizeId).filter(Boolean);
  return moves.length > 0 ? new Set(moves) : null;
}

function sortedValues(values) {
  return [...values].sort();
}

function sortedSetEntries(entries) {
  return [...entries]
    .filter(([, values]) => values.size > 0)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, values]) => [key, sortedValues(values)]);
}

function buildRegulationMbSnapshot({
  baseLearnsets,
  championsFormatsText,
  championsItemsText,
  championsLearnsetsText,
  pokedex,
  teambuilderTablesText,
}) {
  const formatsData = parseFormatsData(championsFormatsText);
  const championsLearnsets = parseLearnsets(championsLearnsetsText);
  const knownPokemonIds = new Set(formatsData.keys());
  const pokemonIds = new Set();

  for (const [pokemonId, entry] of formatsData) {
    if (isLegalPokemon(entry, pokedex[pokemonId])) {
      pokemonIds.add(pokemonId);
    }
  }

  const relevantPokemonIds = new Set(pokemonIds);

  for (const pokemonId of pokemonIds) {
    const baseSpeciesId =
      LEARNSET_PARENT_OVERRIDES.get(pokemonId) ??
      normalizeId(pokedex[pokemonId]?.baseSpecies);

    if (baseSpeciesId) {
      relevantPokemonIds.add(baseSpeciesId);
    }
  }

  const abilityByPokemon = new Map();
  const moveByPokemon = new Map();

  for (const pokemonId of relevantPokemonIds) {
    const abilities = new Set(
      parseAbilityValue(pokedex[pokemonId]?.abilities)
        .map(normalizeId)
        .filter(Boolean),
    );

    if (abilities.size > 0) {
      abilityByPokemon.set(pokemonId, abilities);
    }

    const baseMoves = getLearnsetMoves(baseLearnsets[pokemonId]);

    if (baseMoves) {
      moveByPokemon.set(pokemonId, baseMoves);
    }
  }

  for (const [pokemonId, moves] of championsLearnsets) {
    if (relevantPokemonIds.has(pokemonId)) {
      moveByPokemon.set(pokemonId, moves);
    }
  }

  for (const [pokemonId, parentId] of LEARNSET_PARENT_OVERRIDES) {
    const parentMoves = moveByPokemon.get(parentId);

    if (!pokemonIds.has(pokemonId) || !parentMoves) {
      continue;
    }

    moveByPokemon.set(
      pokemonId,
      new Set([...(moveByPokemon.get(pokemonId) ?? []), ...parentMoves]),
    );
  }

  const tableItems = parseTeamBuilderItems(teambuilderTablesText);
  const itemIds =
    tableItems.size > 0 ? tableItems : parseItems(championsItemsText);
  const snapshot = {
    schemaVersion: 1,
    formatId: REGULATION_MB_FORMAT_ID,
    dataMod: "champions",
    generatedAt: Date.now(),
    sources: {
      baseLearnsets: SOURCES.baseLearnsets,
      championsFormats: SOURCES.championsFormats,
      championsItems: SOURCES.championsItems,
      championsLearnsets: SOURCES.championsLearnsets,
      pokedex: SOURCES.pokedex,
      teambuilderTables: SOURCES.teambuilderTables,
    },
    pokemonIds: sortedValues(pokemonIds),
    knownPokemonIds: sortedValues(knownPokemonIds),
    itemIds: sortedValues(itemIds),
    abilityByPokemon: sortedSetEntries(abilityByPokemon),
    moveByPokemon: sortedSetEntries(moveByPokemon),
  };

  if (
    snapshot.pokemonIds.length < 50 ||
    snapshot.knownPokemonIds.length < snapshot.pokemonIds.length ||
    snapshot.itemIds.length < 20 ||
    snapshot.abilityByPokemon.length < 50 ||
    snapshot.moveByPokemon.length < 50
  ) {
    throw new Error("Generated Regulation M-B snapshot failed its sanity checks.");
  }

  return snapshot;
}

async function writeDataFile(filename, payload) {
  await writeFile(
    resolve(outputDirectory, filename),
    `${JSON.stringify(payload)}\n`,
    "utf8",
  );
}

const [
  abilitySource,
  baseLearnsets,
  championsFormatsText,
  championsItemsText,
  championsLearnsetsText,
  itemSource,
  pokedex,
  teambuilderTablesText,
] = await Promise.all([
  fetchSource(SOURCES.abilities),
  fetchJson(SOURCES.baseLearnsets),
  fetchSource(SOURCES.championsFormats),
  fetchSource(SOURCES.championsItems),
  fetchSource(SOURCES.championsLearnsets),
  fetchSource(SOURCES.items),
  fetchJson(SOURCES.pokedex),
  fetchSource(SOURCES.teambuilderTables),
]);
const rawItems = readShowdownExport(itemSource, "BattleItems", SOURCES.items);
const rawAbilities = readShowdownExport(
  abilitySource,
  "BattleAbilities",
  SOURCES.abilities,
);
const generatedAt = new Date().toISOString();

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeDataFile("showdown-items.json", {
    schemaVersion: 1,
    generatedAt,
    source: SOURCES.items,
    items: normalizeItems(rawItems),
  }),
  writeDataFile("showdown-abilities.json", {
    schemaVersion: 1,
    generatedAt,
    source: SOURCES.abilities,
    abilities: normalizeAbilities(rawAbilities),
  }),
  writeDataFile(
    "showdown-regulation-mb.json",
    buildRegulationMbSnapshot({
      baseLearnsets,
      championsFormatsText,
      championsItemsText,
      championsLearnsetsText,
      pokedex,
      teambuilderTablesText,
    }),
  ),
]);

console.log("Generated compact Showdown catalogs and Regulation M-B snapshot.");
