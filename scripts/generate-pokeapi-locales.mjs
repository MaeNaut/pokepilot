import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readModData } from "./lib/showdownModData.mjs";

const POKEAPI_CSV_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
const KOREAN_LANGUAGE_ID = "3";
const SHOWDOWN_KO_ROOT =
  "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/ko";
const SOURCES = {
  abilities: "abilities.csv",
  abilityFlavorText: "ability_flavor_text.csv",
  abilityNames: "ability_names.csv",
  items: "items.csv",
  itemFlavorText: "item_flavor_text.csv",
  itemNames: "item_names.csv",
  moves: "moves.csv",
  moveFlavorText: "move_flavor_text.csv",
  moveNames: "move_names.csv",
  natures: "natures.csv",
  natureNames: "nature_names.csv",
  pokemon: "pokemon.csv",
  pokemonForms: "pokemon_forms.csv",
  pokemonFormNames: "pokemon_form_names.csv",
  pokemonSpecies: "pokemon_species.csv",
  pokemonSpeciesNames: "pokemon_species_names.csv",
  types: "types.csv",
  typeNames: "type_names.csv",
};
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "src", "i18n", "data");

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...values] = rows;

  if (!headers) {
    return [];
  }

  return values
    .filter((cells) => cells.some(Boolean))
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
    );
}

async function fetchCsv(filename) {
  const url = `${POKEAPI_CSV_ROOT}/${filename}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status}).`);
  }

  return parseCsv(await response.text());
}

async function fetchShowdownText(category) {
  const url = `${SHOWDOWN_KO_ROOT}/${category}.ts`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status}).`);
  }

  return readModData(await response.text());
}

function createShowdownNames(entries) {
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, entry]) => typeof entry?.name === "string" && entry.name)
      .map(([id, entry]) => [normalizeId(id), entry.name]),
  );
}

function createShowdownDescriptions(entries) {
  return Object.fromEntries(
    Object.entries(entries)
      .map(([id, entry]) => [normalizeId(id), entry?.shortDesc ?? entry?.desc])
      .filter(([, description]) => typeof description === "string" && description),
  );
}

function withShowdownFallback(pokeApiEntries, showdownEntries) {
  return { ...showdownEntries, ...pokeApiEntries };
}

function createIdentifierById(rows) {
  return new Map(rows.map((row) => [row.id, row.identifier]));
}

function createLocalizedNames(rows, identifiersById, resourceIdKey) {
  const names = {};

  for (const row of rows) {
    if (row.local_language_id !== KOREAN_LANGUAGE_ID || !row.name) {
      continue;
    }

    const identifier = identifiersById.get(row[resourceIdKey]);
    const key = normalizeId(identifier);

    if (key) {
      names[key] = row.name;
    }
  }

  return names;
}

function createPokemonFormNames({ pokemon, pokemonForms, pokemonFormNames }) {
  const pokemonIdentifiersById = createIdentifierById(pokemon);
  const pokemonIdByFormId = new Map(
    pokemonForms.map((form) => [form.id, form.pokemon_id]),
  );
  const names = {};

  for (const row of pokemonFormNames) {
    if (row.local_language_id !== KOREAN_LANGUAGE_ID) {
      continue;
    }

    const pokemonId = pokemonIdByFormId.get(row.pokemon_form_id);
    const identifier = pokemonIdentifiersById.get(pokemonId);
    const key = normalizeId(identifier);
    const pokemonName = row.pokemon_name || "";
    const formName = row.form_name || "";

    if (key && (pokemonName || formName)) {
      names[key] = { pokemonName, formName };
    }
  }

  return names;
}

function createLocalizedDescriptions(rows, identifiersById, resourceIdKey) {
  const descriptionsByKey = new Map();

  for (const row of rows) {
    if (row.language_id !== KOREAN_LANGUAGE_ID || !row.flavor_text) {
      continue;
    }

    const identifier = identifiersById.get(row[resourceIdKey]);
    const key = normalizeId(identifier);
    const versionGroupId = Number(row.version_group_id ?? 0);
    const existing = descriptionsByKey.get(key);

    if (!key || (existing && existing.versionGroupId > versionGroupId)) {
      continue;
    }

    descriptionsByKey.set(key, {
      versionGroupId,
      text: row.flavor_text.replace(/\s+/g, " ").trim(),
    });
  }

  return Object.fromEntries(
    [...descriptionsByKey].map(([key, value]) => [key, value.text]),
  );
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([first], [second]) => first.localeCompare(second)),
  );
}

const [sourceEntries, showdownMoves, showdownItems, showdownAbilities] =
  await Promise.all([
    Promise.all(
      Object.entries(SOURCES).map(async ([key, filename]) => [key, await fetchCsv(filename)]),
    ),
    fetchShowdownText("moves"),
    fetchShowdownText("items"),
    fetchShowdownText("abilities"),
  ]);
const data = Object.fromEntries(sourceEntries);
const pokemonNames = createLocalizedNames(
  data.pokemonSpeciesNames,
  createIdentifierById(data.pokemonSpecies),
  "pokemon_species_id",
);

const pokemonFormNames = createPokemonFormNames({
  pokemon: data.pokemon,
  pokemonForms: data.pokemonForms,
  pokemonFormNames: data.pokemonFormNames,
});

const catalog = {
  schemaVersion: 1,
  locale: "ko",
  generatedAt: new Date().toISOString(),
  source: POKEAPI_CSV_ROOT,
  fallbackSource: SHOWDOWN_KO_ROOT,
  pokemon: sortRecord(pokemonNames),
  pokemonForms: sortRecord(pokemonFormNames),
  moves: sortRecord(
    withShowdownFallback(
      createLocalizedNames(
        data.moveNames,
        createIdentifierById(data.moves),
        "move_id",
      ),
      createShowdownNames(showdownMoves),
    ),
  ),
  moveDescriptions: sortRecord(
    withShowdownFallback(
      createLocalizedDescriptions(
        data.moveFlavorText,
        createIdentifierById(data.moves),
        "move_id",
      ),
      createShowdownDescriptions(showdownMoves),
    ),
  ),
  items: sortRecord(
    withShowdownFallback(
      createLocalizedNames(
        data.itemNames,
        createIdentifierById(data.items),
        "item_id",
      ),
      createShowdownNames(showdownItems),
    ),
  ),
  itemDescriptions: sortRecord(
    withShowdownFallback(
      createLocalizedDescriptions(
        data.itemFlavorText,
        createIdentifierById(data.items),
        "item_id",
      ),
      createShowdownDescriptions(showdownItems),
    ),
  ),
  abilities: sortRecord(
    withShowdownFallback(
      createLocalizedNames(
        data.abilityNames,
        createIdentifierById(data.abilities),
        "ability_id",
      ),
      createShowdownNames(showdownAbilities),
    ),
  ),
  abilityDescriptions: sortRecord(
    withShowdownFallback(
      createLocalizedDescriptions(
        data.abilityFlavorText,
        createIdentifierById(data.abilities),
        "ability_id",
      ),
      createShowdownDescriptions(showdownAbilities),
    ),
  ),
  types: sortRecord(
    createLocalizedNames(
      data.typeNames,
      createIdentifierById(data.types),
      "type_id",
    ),
  ),
  natures: sortRecord(
    createLocalizedNames(
      data.natureNames,
      createIdentifierById(data.natures),
      "nature_id",
    ),
  ),
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "ko-game-data.json"),
  `${JSON.stringify(catalog)}\n`,
  "utf8",
);

console.log(
  `Generated Korean game catalog: ${Object.entries(catalog)
    .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
    .map(([key, value]) => `${key}=${Object.keys(value).length}`)
    .join(", ")}`,
);
