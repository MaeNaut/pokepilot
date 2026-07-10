import {
  pokemonTypes,
  type ItemIndexEntry,
  type PokemonAbility,
  type PokemonItem,
  type PokemonIndexEntry,
  type PokemonType,
  type TeamMember,
} from "../types";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const SHOWDOWN_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";
const CACHE_PREFIX = "pokepilot:pokemon:v11:";
const ITEM_CACHE_PREFIX = "pokepilot:item:v2:";
const MOVE_CACHE_PREFIX = "pokepilot:move:v6:";
const ABILITY_CACHE_PREFIX = "pokepilot:ability:v1:";
const INDEX_CACHE_VERSION = 9;
const INDEX_CACHE_KEY = `pokepilot:pokemon-index:v${INDEX_CACHE_VERSION}`;
const ITEM_INDEX_CACHE_VERSION = 3;
const ITEM_INDEX_CACHE_KEY = `pokepilot:item-index:v${ITEM_INDEX_CACHE_VERSION}`;
const POKEMON_INDEX_LIMIT = 5000;
const ITEM_INDEX_LIMIT = 2500;
const NATIONAL_DEX_LIMIT = 1025;
const REGIONAL_FORM_MARKERS = ["alola", "galar", "hisui", "paldea"];
const GENDER_FORM_SPECIES: Record<
  string,
  {
    defaultName: string;
    forms: Record<"male" | "female", string>;
  }
> = {
  basculegion: {
    defaultName: "basculegion-male",
    forms: { male: "basculegion-male", female: "basculegion-female" },
  },
  meowstic: {
    defaultName: "meowstic-male",
    forms: { male: "meowstic-male", female: "meowstic-female" },
  },
  pyroar: {
    defaultName: "pyroar-male",
    forms: { male: "pyroar-male", female: "pyroar-female" },
  },
};
const SYNTHETIC_GENDER_FORM_SOURCES: Record<
  string,
  { sourceName: string; spriteGender: "female" }
> = {
  "pyroar-female": { sourceName: "pyroar-male", spriteGender: "female" },
};
const MEGA_STONE_NAME_EXCLUSIONS = new Set([
  "armorite-ore",
  "bergmite-ice",
  "black-augurite",
  "dynite-ore",
  "eviolite",
  "magnemite-candy",
  "magnemite-screw",
  "meditite-sweat",
  "meteorite",
  "meteorite--2",
  "meteorite--3",
  "meteorite--4",
  "meteorite-shard",
  "suite-key",
  "white-apricorn",
  "white-dish",
  "white-flute",
  "white-herb",
  "white-mane-hair",
]);
const SHOWDOWN_MOVE_FLAG_TAG_LABELS: Record<string, string> = {
  contact: "Contact",
  sound: "Sound",
  punch: "Punch",
  bite: "Bite",
  slicing: "Slicing",
  bullet: "Ball/Bomb",
  pulse: "Pulse",
  wind: "Wind",
  powder: "Powder",
  dance: "Dance",
  heal: "Recovery",
  bypasssub: "Bypass Sub",
  charge: "Charge",
  recharge: "Recharge",
};
const SHOWDOWN_MOVE_FLAG_TAG_ORDER = Object.keys(SHOWDOWN_MOVE_FLAG_TAG_LABELS);
const SHOWDOWN_SPREAD_TARGET_TAG_LABELS: Record<string, string> = {
  all: "Spread: All",
  allAdjacent: "Spread: Adjacent",
  allAdjacentFoes: "Spread: Foes",
};
const SHOWDOWN_PROTECTION_VOLATILES = new Set([
  "banefulbunker",
  "burningbulwark",
  "detect",
  "kingsshield",
  "obstruct",
  "protect",
  "silktrap",
  "spikyshield",
]);
const SHOWDOWN_PROTECTION_SIDE_CONDITIONS = new Set([
  "craftyshield",
  "matblock",
  "quickguard",
  "wideguard",
]);
const SHOWDOWN_SCREEN_SIDE_CONDITIONS = new Set([
  "auroraveil",
  "lightscreen",
  "mist",
  "reflect",
  "safeguard",
]);
const FORM_SPECIES_DEFAULTS: Record<string, string> = {
  aegislash: "aegislash-shield",
  castform: "castform",
  floette: "floette",
  florges: "florges",
  furfrou: "furfrou-natural",
  gourgeist: "gourgeist-average",
  lycanroc: "lycanroc-midday",
  maushold: "maushold-family-of-four",
  mimikyu: "mimikyu-disguised",
  morpeko: "morpeko-full-belly",
  palafin: "palafin-zero",
  rotom: "rotom",
  sinistcha: "sinistcha",
  vivillon: "vivillon",
};

type PokeApiPokemon = {
  id: number;
  name: string;
  sprites: {
    front_default: string | null;
    front_female?: string | null;
    other?: {
      home?: {
        front_default: string | null;
        front_female?: string | null;
      };
      "official-artwork"?: {
        front_default: string | null;
        front_female?: string | null;
      };
    };
    versions?: {
      "generation-ix"?: {
        "scarlet-violet"?: {
          front_default: string | null;
          front_female?: string | null;
        };
      };
      "generation-viii"?: {
        icons?: {
          front_default: string | null;
          front_female?: string | null;
        };
      };
      "generation-vii"?: {
        icons?: {
          front_default: string | null;
          front_female?: string | null;
        };
      };
    };
  };
  abilities: Array<{
    ability: {
      name: string;
    };
  }>;
  moves: Array<{
    move: {
      name: string;
    };
    version_group_details: Array<{
      level_learned_at: number;
      move_learn_method: {
        name: string;
      };
      version_group: {
        name: string;
      };
    }>;
  }>;
  stats: Array<{
    base_stat: number;
    stat: {
      name: string;
    };
  }>;
  types: Array<{
    slot: number;
    type: {
      name: string;
    };
  }>;
};

type PokeApiListResponse = {
  count: number;
  results: Array<{
    name: string;
    url: string;
  }>;
};

type PokeApiItem = {
  id: number;
  name: string;
  category?: {
    name: string;
  };
  effect_entries: Array<{
    effect: string;
    language: {
      name: string;
    };
  }>;
  sprites: {
    default: string | null;
  };
};

type PokeApiItemCategory = {
  items: Array<{
    name: string;
    url: string;
  }>;
};

type PokeApiMove = {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  damage_class: {
    name: string;
  };
  type: {
    name: string;
  };
  effect_entries: Array<{
    effect: string;
    short_effect: string;
    language: {
      name: string;
    };
  }>;
};

type PokeApiAbility = {
  id: number;
  name: string;
  effect_entries: Array<{
    effect: string;
    short_effect: string;
    language: {
      name: string;
    };
  }>;
};

type ShowdownMove = {
  accuracy?: number | boolean;
  basePower?: number;
  boosts?: Record<string, number>;
  category?: string;
  critRatio?: number;
  damage?: number | string;
  drain?: unknown;
  forceSwitch?: unknown;
  flags?: Record<string, number | boolean | undefined>;
  hasCrashDamage?: boolean;
  heal?: unknown;
  mindBlownRecoil?: boolean;
  multihit?: number | number[];
  priority?: number;
  pseudoWeather?: string;
  recoil?: unknown;
  secondary?: ShowdownMoveSecondary;
  secondaries?: ShowdownMoveSecondary[];
  self?: {
    boosts?: Record<string, number>;
    volatileStatus?: string;
  };
  selfBoost?: {
    boosts?: Record<string, number>;
  };
  selfSwitch?: unknown;
  selfdestruct?: string | boolean;
  sideCondition?: string;
  slotCondition?: string;
  stallingMove?: boolean;
  target?: string;
  terrain?: string;
  volatileStatus?: string;
  weather?: string;
  willCrit?: boolean;
};

type ShowdownMoveSecondary = {
  boosts?: Record<string, number>;
  self?: {
    boosts?: Record<string, number>;
  };
};

let showdownMoveTagMapPromise: Promise<Map<string, string[]>> | null = null;

function formatLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFormLabel(name: string, speciesKey: string) {
  const suffix = name === speciesKey ? "base" : name.replace(`${speciesKey}-`, "");
  return formatLabel(suffix);
}

function getGenderMetaByName(name: string) {
  for (const [speciesKey, config] of Object.entries(GENDER_FORM_SPECIES)) {
    const matchedGender = Object.entries(config.forms).find(
      ([, formName]) => name === formName || name.startsWith(`${formName}-mega`),
    )?.[0] as "male" | "female" | undefined;

    if (matchedGender) {
      return {
        speciesKey,
        gender: matchedGender,
        label: matchedGender === "male" ? "Male" : "Female",
      };
    }
  }

  return null;
}

function getIdFromPokemonUrl(url: string) {
  const match = url.match(/\/pokemon\/(\d+)\/?$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function getIdFromItemUrl(url: string) {
  const match = url.match(/\/item\/(\d+)\/?$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function isPokemonType(value: string): value is PokemonType {
  return pokemonTypes.includes(value as PokemonType);
}

function looksLikeMegaStoneName(name: string) {
  if (MEGA_STONE_NAME_EXCLUSIONS.has(name)) {
    return false;
  }

  if (name.startsWith("rotom-bike")) {
    return false;
  }

  return /(?:ite|nite|tite|site|zite)(?:-[xyz])?$/.test(name);
}

function getMegaMeta(name: string, id: number, canonicalIdByName: Map<string, number>) {
  const parts = name.split("-");
  const megaIndex = parts.indexOf("mega");

  if (megaIndex === -1) {
    return null;
  }

  const rawSpeciesKey = parts.slice(0, megaIndex).join("-");
  const genderMeta = getGenderMetaByName(rawSpeciesKey);
  const speciesKey = genderMeta?.speciesKey ?? rawSpeciesKey;
  const megaSuffix = parts.slice(megaIndex + 1).join("-");
  const formLabel = megaSuffix ? `Mega ${formatLabel(megaSuffix)}` : "Mega";

  return {
    displayName: `${formatLabel(speciesKey)} ${formLabel}`,
    speciesKey,
    sortNumber: canonicalIdByName.get(rawSpeciesKey) ?? canonicalIdByName.get(speciesKey) ?? id,
    formKind: "mega" as const,
    formLabel,
    isSelectorOption: false,
  };
}

function getGenderMeta(name: string, id: number, canonicalIdByName: Map<string, number>) {
  const genderMeta = getGenderMetaByName(name);

  if (!genderMeta) {
    return null;
  }

  const config = GENDER_FORM_SPECIES[genderMeta.speciesKey];

  return {
    displayName: `${formatLabel(genderMeta.speciesKey)} ${genderMeta.label}`,
    speciesKey: genderMeta.speciesKey,
    sortNumber:
      canonicalIdByName.get(config.defaultName) ??
      canonicalIdByName.get(genderMeta.speciesKey) ??
      id,
    formKind: "gender" as const,
    formLabel: genderMeta.label,
    isSelectorOption: true,
  };
}

function getRegionalMeta(name: string, id: number, canonicalIdByName: Map<string, number>) {
  const parts = name.split("-");
  const regionIndex = parts.findIndex((part) => REGIONAL_FORM_MARKERS.includes(part));

  if (regionIndex <= 0) {
    return null;
  }

  const speciesKey = parts.slice(0, regionIndex).join("-");
  const sortNumber = canonicalIdByName.get(speciesKey);

  if (!sortNumber) {
    return null;
  }

  return {
    speciesKey,
    sortNumber,
    formKind: "regional" as const,
    formLabel: formatFormLabel(name, speciesKey),
    isSelectorOption: true,
  };
}

function getFormMeta(
  name: string,
  id: number,
  canonicalIdByName: Map<string, number>,
  defaultIdBySpecies: Map<string, number>,
) {
  const speciesKey = Object.keys(FORM_SPECIES_DEFAULTS).find(
    (key) => name === key || name.startsWith(`${key}-`),
  );

  if (!speciesKey) {
    return null;
  }

  const defaultName = FORM_SPECIES_DEFAULTS[speciesKey];

  return {
    speciesKey,
    sortNumber:
      defaultIdBySpecies.get(speciesKey) ??
      canonicalIdByName.get(defaultName) ??
      canonicalIdByName.get(speciesKey) ??
      id,
    formKind: "form" as const,
    formLabel: formatFormLabel(name, speciesKey),
    isSelectorOption: name === defaultName,
  };
}

function getCanonicalPrefix(name: string, canonicalIdByName: Map<string, number>) {
  const parts = name.split("-");

  for (let index = parts.length - 1; index > 0; index -= 1) {
    const candidate = parts.slice(0, index).join("-");

    if (canonicalIdByName.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getFallbackVariantMeta(
  name: string,
  id: number,
  canonicalIdByName: Map<string, number>,
) {
  if (id <= NATIONAL_DEX_LIMIT || !name.includes("-")) {
    return null;
  }

  const speciesKey = getCanonicalPrefix(name, canonicalIdByName);

  if (!speciesKey) {
    return null;
  }

  return {
    speciesKey,
    sortNumber: canonicalIdByName.get(speciesKey) ?? id,
    formKind: "form" as const,
    formLabel: formatFormLabel(name, speciesKey),
    isSelectorOption: false,
  };
}

function isMainPickerVariant(
  name: string,
  id: number,
  formKind: PokemonIndexEntry["formKind"],
) {
  if (formKind === "mega") {
    return false;
  }

  if (formKind === "regional") {
    return true;
  }

  if (formKind === "gender") {
    return true;
  }

  if (formKind === "form") {
    return id <= NATIONAL_DEX_LIMIT;
  }

  return id <= NATIONAL_DEX_LIMIT || !name.includes("-");
}

export async function fetchPokemonIndex(): Promise<PokemonIndexEntry[]> {
  const cached = localStorage.getItem(INDEX_CACHE_KEY);

  if (cached) {
    const parsed = JSON.parse(cached) as Partial<PokemonIndexEntry>[];

    if (
      parsed.every(
        (entry) =>
          typeof entry.name === "string" &&
          typeof entry.displayName === "string" &&
          typeof entry.sortNumber === "number" &&
          typeof entry.isSelectorOption === "boolean" &&
          entry.cacheVersion === INDEX_CACHE_VERSION,
      )
    ) {
      return parsed as PokemonIndexEntry[];
    }

    localStorage.removeItem(INDEX_CACHE_KEY);
  }

  const response = await fetch(`${POKEAPI_BASE_URL}/pokemon?limit=${POKEMON_INDEX_LIMIT}`);

  if (!response.ok) {
    throw new Error("Could not load the Pokemon index.");
  }

  const data = (await response.json()) as PokeApiListResponse;
  const baseIndex = data.results
    .map((entry) => ({
      id: getIdFromPokemonUrl(entry.url),
      name: entry.name,
      displayName: formatLabel(entry.name),
      url: entry.url,
    }))
    .filter((entry) => entry.id > 0);
  const existingPokemonNames = new Set(baseIndex.map((entry) => entry.name));

  for (const [formName, source] of Object.entries(SYNTHETIC_GENDER_FORM_SOURCES)) {
    if (existingPokemonNames.has(formName)) {
      continue;
    }

    const sourceEntry = baseIndex.find((entry) => entry.name === source.sourceName);

    if (!sourceEntry) {
      continue;
    }

    baseIndex.push({
      ...sourceEntry,
      id: sourceEntry.id + 50000,
      name: formName,
      displayName: formatLabel(formName),
    });
    existingPokemonNames.add(formName);
  }

  const canonicalIdByName = new Map(
    baseIndex
      .filter((entry) => entry.id <= NATIONAL_DEX_LIMIT)
      .map((entry) => [entry.name, entry.id]),
  );
  const defaultIdBySpecies = new Map(
    Object.entries(FORM_SPECIES_DEFAULTS).map(([speciesKey, defaultName]) => [
      speciesKey,
      canonicalIdByName.get(defaultName) ?? canonicalIdByName.get(speciesKey) ?? 0,
    ]),
  );
  const index = baseIndex
    .map((entry) => {
      const variantMeta =
        getMegaMeta(entry.name, entry.id, canonicalIdByName) ??
        getGenderMeta(entry.name, entry.id, canonicalIdByName) ??
        getRegionalMeta(entry.name, entry.id, canonicalIdByName) ??
        getFormMeta(entry.name, entry.id, canonicalIdByName, defaultIdBySpecies) ??
        getFallbackVariantMeta(entry.name, entry.id, canonicalIdByName);

      if (variantMeta) {
        const formKind = variantMeta.formKind;

        return {
          ...entry,
          ...variantMeta,
          isSelectorOption: isMainPickerVariant(entry.name, entry.id, formKind),
          cacheVersion: INDEX_CACHE_VERSION,
        };
      }

      const formKind = "base" as const;

      return {
        ...entry,
        speciesKey: entry.name,
        sortNumber: entry.id,
        formKind,
        isSelectorOption: isMainPickerVariant(entry.name, entry.id, formKind),
        cacheVersion: INDEX_CACHE_VERSION,
      };
    })
    .sort((a, b) => {
      const formRank = { base: 0, form: 0, gender: 0, regional: 1, mega: 2 };
      return (
        a.sortNumber - b.sortNumber ||
        formRank[a.formKind] - formRank[b.formKind] ||
        a.id - b.id
      );
    });

  localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(index));

  return index;
}

export async function fetchItemIndex(): Promise<ItemIndexEntry[]> {
  const cached = localStorage.getItem(ITEM_INDEX_CACHE_KEY);

  if (cached) {
    const parsed = JSON.parse(cached) as Partial<ItemIndexEntry>[];

    if (
      parsed.every(
        (entry) =>
          typeof entry.name === "string" &&
          typeof entry.displayName === "string" &&
          typeof entry.id === "number" &&
          typeof entry.isMegaStone === "boolean",
      )
    ) {
      return parsed as ItemIndexEntry[];
    }

    localStorage.removeItem(ITEM_INDEX_CACHE_KEY);
  }

  const [response, megaStoneNames] = await Promise.all([
    fetch(`${POKEAPI_BASE_URL}/item?limit=${ITEM_INDEX_LIMIT}`),
    fetchMegaStoneNames(),
  ]);

  if (!response.ok) {
    throw new Error("Could not load the item index.");
  }

  const data = (await response.json()) as PokeApiListResponse;
  const index = data.results
    .map((entry) => ({
      id: getIdFromItemUrl(entry.url),
      name: entry.name,
      displayName: formatLabel(entry.name),
      url: entry.url,
      isMegaStone: megaStoneNames.has(entry.name) || looksLikeMegaStoneName(entry.name),
    }))
    .filter((entry) => entry.id > 0)
    .sort((a, b) => a.id - b.id);

  localStorage.setItem(ITEM_INDEX_CACHE_KEY, JSON.stringify(index));

  return index;
}

async function fetchMegaStoneNames() {
  const fallbackMegaStoneNames = new Set([
    "abomasite",
    "absolite",
    "aerodactylite",
    "aggronite",
    "alakazite",
    "altarianite",
    "ampharosite",
    "audinite",
    "banettite",
    "beedrillite",
    "blastoisinite",
    "blazikenite",
    "cameruptite",
    "charizardite-x",
    "charizardite-y",
    "diancite",
    "galladite",
    "garchompite",
    "gardevoirite",
    "gengarite",
    "glalitite",
    "gyaradosite",
    "heracronite",
    "houndoominite",
    "kangaskhanite",
    "latiasite",
    "latiosite",
    "lopunnite",
    "lucarionite",
    "manectite",
    "mawilite",
    "medichamite",
    "metagrossite",
    "mewtwonite-x",
    "mewtwonite-y",
    "pidgeotite",
    "pinsirite",
    "sablenite",
    "salamencite",
    "sceptilite",
    "scizorite",
    "sharpedonite",
    "slowbronite",
    "steelixite",
    "swampertite",
    "tyranitarite",
    "venusaurite",
  ]);

  try {
    const response = await fetch(`${POKEAPI_BASE_URL}/item-category/mega-stones`);

    if (!response.ok) {
      return fallbackMegaStoneNames;
    }

    const data = (await response.json()) as PokeApiItemCategory;

    return new Set([...fallbackMegaStoneNames, ...data.items.map((item) => item.name)]);
  } catch {
    return fallbackMegaStoneNames;
  }
}

function getStat(data: PokeApiPokemon, statName: string) {
  return data.stats.find((item) => item.stat.name === statName)?.base_stat ?? 1;
}

function normalizeShowdownMoveKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function addMoveTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) {
    tags.push(tag);
  }
}

function hasStatBoosts(boosts?: Record<string, number>) {
  return Boolean(boosts && Object.values(boosts).some((value) => value !== 0));
}

function hasStatChange(move: ShowdownMove) {
  return (
    hasStatBoosts(move.boosts) ||
    hasStatBoosts(move.self?.boosts) ||
    hasStatBoosts(move.selfBoost?.boosts) ||
    hasStatBoosts(move.secondary?.boosts) ||
    hasStatBoosts(move.secondary?.self?.boosts) ||
    Boolean(
      move.secondaries?.some(
        (secondary) =>
          hasStatBoosts(secondary.boosts) || hasStatBoosts(secondary.self?.boosts),
      ),
    )
  );
}

function isDamagingShowdownMove(move: ShowdownMove) {
  return move.category === "Physical" || move.category === "Special";
}

function getSpreadTargetTag(target?: string) {
  return target ? SHOWDOWN_SPREAD_TARGET_TAG_LABELS[target] : undefined;
}

function getShowdownMoveTags(move: ShowdownMove) {
  const flags = move.flags ?? {};
  const tags: string[] = [];
  const spreadTargetTag = getSpreadTargetTag(move.target);

  for (const flag of SHOWDOWN_MOVE_FLAG_TAG_ORDER) {
    if (flags[flag]) {
      addMoveTag(tags, SHOWDOWN_MOVE_FLAG_TAG_LABELS[flag]);
    }
  }

  if (spreadTargetTag && isDamagingShowdownMove(move)) {
    addMoveTag(tags, spreadTargetTag);
  }

  if (move.damage !== undefined) {
    addMoveTag(tags, "Fixed Damage");
  }

  if (
    move.stallingMove ||
    (move.volatileStatus && SHOWDOWN_PROTECTION_VOLATILES.has(move.volatileStatus)) ||
    (move.sideCondition && SHOWDOWN_PROTECTION_SIDE_CONDITIONS.has(move.sideCondition))
  ) {
    addMoveTag(tags, "Protect");
  }

  if (move.volatileStatus === "partiallytrapped") {
    addMoveTag(tags, "Trap");
  }

  if (
    move.recoil ||
    move.hasCrashDamage ||
    move.mindBlownRecoil
  ) {
    addMoveTag(tags, "Recoil");
  }

  if (move.self?.volatileStatus === "lockedmove") {
    addMoveTag(tags, "Rampage");
  }

  if (hasStatChange(move)) {
    addMoveTag(tags, "Stat Change");
  }

  if (move.priority) {
    addMoveTag(tags, `Priority ${move.priority > 0 ? "+" : ""}${move.priority}`);
  }

  if (move.selfdestruct) {
    addMoveTag(tags, "Self-KO");
  }

  if ((move.critRatio ?? 0) > 1 || move.willCrit) {
    addMoveTag(tags, "High Crit");
  }

  if (move.multihit !== undefined) {
    addMoveTag(tags, "Multi-Hit");
  }

  if (move.accuracy === true && isDamagingShowdownMove(move)) {
    addMoveTag(tags, "Never Miss");
  }

  if (move.weather || move.terrain || move.pseudoWeather || move.slotCondition) {
    addMoveTag(tags, "Field");
  }

  if (move.sideCondition && !SHOWDOWN_PROTECTION_SIDE_CONDITIONS.has(move.sideCondition)) {
    addMoveTag(
      tags,
      SHOWDOWN_SCREEN_SIDE_CONDITIONS.has(move.sideCondition) ? "Screen" : "Field",
    );
  }

  if (move.drain || move.heal) {
    addMoveTag(tags, "Recovery");
  }

  if (move.selfSwitch || move.forceSwitch) {
    addMoveTag(tags, "Switch");
  }

  return tags;
}

async function loadShowdownMoveTagMap() {
  if (showdownMoveTagMapPromise) {
    return showdownMoveTagMapPromise;
  }

  showdownMoveTagMapPromise = (async () => {
    const response = await fetch(SHOWDOWN_MOVES_URL);

    if (!response.ok) {
      throw new Error("Could not load Showdown move flags.");
    }

    const data = (await response.json()) as Record<string, ShowdownMove>;
    const tagMap = new Map<string, string[]>();

    for (const [moveName, move] of Object.entries(data)) {
      const tags = getShowdownMoveTags(move);

      if (tags.length > 0) {
        tagMap.set(normalizeShowdownMoveKey(moveName), tags);
      }
    }

    return tagMap;
  })();

  return showdownMoveTagMapPromise;
}

async function fetchShowdownMoveTags(moveName: string) {
  try {
    const tagMap = await loadShowdownMoveTagMap();

    return tagMap.get(normalizeShowdownMoveKey(moveName)) ?? [];
  } catch {
    return [];
  }
}

function inferRoles(stats: PokeApiPokemon["stats"]): string[] {
  const statMap = new Map(stats.map((item) => [item.stat.name, item.base_stat]));
  const attack = statMap.get("attack") ?? 0;
  const specialAttack = statMap.get("special-attack") ?? 0;
  const speed = statMap.get("speed") ?? 0;
  const hp = statMap.get("hp") ?? 0;
  const defense = statMap.get("defense") ?? 0;
  const specialDefense = statMap.get("special-defense") ?? 0;
  const bulk = hp + defense + specialDefense;

  const roles = [
    specialAttack > attack ? "special attacker" : "physical attacker",
    speed >= 95 ? "speed control" : bulk >= 250 ? "bulky pivot" : "coverage",
  ];

  return [...new Set(roles)];
}

function normalizeMove(data: PokeApiMove, tags: string[] = []) {
  const englishEffect = data.effect_entries.find(
    (entry) => entry.language.name === "en",
  );
  const type = isPokemonType(data.type.name) ? data.type.name : "normal";

  return {
    id: data.name,
    name: formatLabel(data.name),
    type,
    category: formatLabel(data.damage_class.name),
    power: data.power,
    accuracy: data.accuracy,
    pp: data.pp ?? 0,
    description:
      englishEffect?.short_effect.replace(/\$effect_chance/g, "effect chance") ??
      englishEffect?.effect.replace(/\$effect_chance/g, "effect chance") ??
      "Move description is not available from PokeAPI.",
    tags,
  };
}

function compareMovesByTypeThenName(first: ReturnType<typeof normalizeMove>, second: ReturnType<typeof normalizeMove>) {
  const typeOrder =
    pokemonTypes.indexOf(first.type) - pokemonTypes.indexOf(second.type);

  if (typeOrder !== 0) {
    return typeOrder;
  }

  return first.name.localeCompare(second.name);
}

function hasMoveCategory(move: Partial<ReturnType<typeof normalizeMove>>) {
  return (
    move.category === "Physical" ||
    move.category === "Special" ||
    move.category === "Status"
  );
}

function hasCategorizedMoves(pokemon: Partial<TeamMember>) {
  return (
    Array.isArray(pokemon.moves) &&
    pokemon.moves.every(hasMoveCategory) &&
    typeof pokemon.iconSpriteUrl === "string"
  );
}

async function fetchMove(name: string) {
  const lookup = name.trim().toLowerCase().replace(/\s+/g, "-");
  const cacheKey = `${MOVE_CACHE_PREFIX}${lookup}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached) as Partial<ReturnType<typeof normalizeMove>>;

    if (hasMoveCategory(parsed)) {
      return parsed as ReturnType<typeof normalizeMove>;
    }

    localStorage.removeItem(cacheKey);
  }

  const response = await fetch(`${POKEAPI_BASE_URL}/move/${lookup}`);

  if (!response.ok) {
    throw new Error(`Could not find move "${name}".`);
  }

  const [data, tags] = await Promise.all([
    response.json() as Promise<PokeApiMove>,
    fetchShowdownMoveTags(lookup),
  ]);
  const move = normalizeMove(data, tags);

  localStorage.setItem(cacheKey, JSON.stringify(move));

  return move;
}

function getPokemonSpriteUrl(data: PokeApiPokemon, spriteGender?: "female") {
  if (spriteGender === "female") {
    return (
      data.sprites.other?.home?.front_female ??
      data.sprites.other?.["official-artwork"]?.front_female ??
      data.sprites.front_female ??
      data.sprites.other?.["official-artwork"]?.front_default ??
      data.sprites.front_default ??
      undefined
    );
  }

  return (
    data.sprites.other?.["official-artwork"]?.front_default ??
    data.sprites.front_default ??
    undefined
  );
}

function getPokemonIconSpriteUrl(data: PokeApiPokemon, spriteGender?: "female") {
  if (spriteGender === "female") {
    return (
      data.sprites.versions?.["generation-ix"]?.["scarlet-violet"]?.front_female ??
      data.sprites.versions?.["generation-viii"]?.icons?.front_female ??
      data.sprites.versions?.["generation-vii"]?.icons?.front_female ??
      data.sprites.front_female ??
      undefined
    );
  }

  return (
    data.sprites.versions?.["generation-ix"]?.["scarlet-violet"]?.front_default ??
    data.sprites.versions?.["generation-viii"]?.icons?.front_default ??
    data.sprites.versions?.["generation-vii"]?.icons?.front_default ??
    data.sprites.front_default ??
    undefined
  );
}

async function normalizePokemon(
  data: PokeApiPokemon,
  options: { id?: string; name?: string; spriteGender?: "female" } = {},
): Promise<TeamMember> {
  const types = data.types
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name)
    .filter(isPokemonType);
  const moveNames = [...new Set(data.moves.map((entry) => entry.move.name))].sort();
  const moves = (
    await Promise.all(
      moveNames.map(async (moveName) => {
        try {
          return await fetchMove(moveName);
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((move) => move !== null)
    .sort(compareMovesByTypeThenName);

  return {
    id: options.id ?? data.name,
    name: options.name ?? formatLabel(data.name),
    types,
    roles: inferRoles(data.stats),
    baseStats: {
      hp: getStat(data, "hp"),
      attack: getStat(data, "attack"),
      defense: getStat(data, "defense"),
      specialAttack: getStat(data, "special-attack"),
      specialDefense: getStat(data, "special-defense"),
      speed: getStat(data, "speed"),
    },
    abilities: data.abilities.map((entry) => formatLabel(entry.ability.name)),
    moves,
    spriteUrl: getPokemonSpriteUrl(data, options.spriteGender),
    iconSpriteUrl: getPokemonIconSpriteUrl(data, options.spriteGender),
    source: "pokeapi",
  };
}

export async function fetchPokemon(nameOrId: string): Promise<TeamMember> {
  const lookup = nameOrId.trim().toLowerCase().replace(/\s+/g, "-");
  const syntheticGenderForm = SYNTHETIC_GENDER_FORM_SOURCES[lookup];
  const apiLookup = syntheticGenderForm?.sourceName ?? lookup;

  if (!lookup) {
    throw new Error("Enter a Pokemon name or Pokedex number.");
  }

  const cacheKey = `${CACHE_PREFIX}${lookup}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached) as Partial<TeamMember>;

    if (hasCategorizedMoves(parsed)) {
      return parsed as TeamMember;
    }

    localStorage.removeItem(cacheKey);
  }

  const response = await fetch(`${POKEAPI_BASE_URL}/pokemon/${apiLookup}`);

  if (!response.ok) {
    throw new Error(`Could not find "${nameOrId}".`);
  }

  const data = (await response.json()) as PokeApiPokemon;
  const pokemon = await normalizePokemon(
    data,
    syntheticGenderForm
      ? {
          id: lookup,
          name: formatLabel(lookup),
          spriteGender: syntheticGenderForm.spriteGender,
        }
      : undefined,
  );

  localStorage.setItem(cacheKey, JSON.stringify(pokemon));

  return pokemon;
}

function normalizeItem(data: PokeApiItem): PokemonItem {
  const englishEffect = data.effect_entries.find(
    (entry) => entry.language.name === "en",
  )?.effect;

  return {
    id: data.name,
    name: formatLabel(data.name),
    spriteUrl: data.sprites.default ?? undefined,
    category:
      data.category?.name === "mega-stones" || looksLikeMegaStoneName(data.name)
        ? "Mega Stones"
        : data.category
          ? formatLabel(data.category.name)
          : undefined,
    effect: englishEffect,
  };
}

export async function fetchItem(nameOrId: string): Promise<PokemonItem> {
  const lookup = nameOrId.trim().toLowerCase().replace(/\s+/g, "-");

  if (!lookup) {
    throw new Error("Enter an item name or id.");
  }

  const cacheKey = `${ITEM_CACHE_PREFIX}${lookup}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    return JSON.parse(cached) as PokemonItem;
  }

  const response = await fetch(`${POKEAPI_BASE_URL}/item/${lookup}`);

  if (!response.ok) {
    throw new Error(`Could not find "${nameOrId}".`);
  }

  const data = (await response.json()) as PokeApiItem;
  const item = normalizeItem(data);

  localStorage.setItem(cacheKey, JSON.stringify(item));

  return item;
}

function normalizeAbility(data: PokeApiAbility): PokemonAbility {
  const englishEffect = data.effect_entries.find(
    (entry) => entry.language.name === "en",
  );

  return {
    id: data.name,
    name: formatLabel(data.name),
    effect: englishEffect?.effect,
    shortEffect: englishEffect?.short_effect,
  };
}

export async function fetchAbility(nameOrId: string): Promise<PokemonAbility> {
  const lookup = nameOrId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (!lookup) {
    throw new Error("Enter an ability name or id.");
  }

  const cacheKey = `${ABILITY_CACHE_PREFIX}${lookup}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    return JSON.parse(cached) as PokemonAbility;
  }

  const response = await fetch(`${POKEAPI_BASE_URL}/ability/${lookup}`);

  if (!response.ok) {
    throw new Error(`Could not find "${nameOrId}".`);
  }

  const data = (await response.json()) as PokeApiAbility;
  const ability = normalizeAbility(data);

  localStorage.setItem(cacheKey, JSON.stringify(ability));

  return ability;
}
