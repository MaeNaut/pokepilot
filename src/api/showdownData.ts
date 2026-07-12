import {
  pokemonTypes,
  type PokemonMove,
  type PokemonType,
  type StatBlock,
} from "../types";
import { formatIdLabel, normalizeShowdownId } from "./showdownIds";

export type ShowdownSpeciesData = {
  id: string;
  name: string;
  num?: number;
  types?: PokemonType[];
  baseStats?: StatBlock;
  abilities: string[];
  baseSpecies?: string;
  forme?: string;
};

export type ShowdownDataSnapshot = {
  speciesById: Record<string, ShowdownSpeciesData>;
  movesById: Record<string, PokemonMove>;
};

type RawShowdownSpecies = {
  name?: string;
  num?: number;
  types?: unknown;
  baseStats?: unknown;
  abilities?: unknown;
  baseSpecies?: string;
  forme?: string;
};

type RawShowdownMove = {
  name?: string;
  accuracy?: number | boolean;
  basePower?: number;
  boosts?: Record<string, number>;
  category?: string;
  critRatio?: number;
  damage?: number | string;
  desc?: string;
  drain?: unknown;
  flags?: Record<string, number | boolean | undefined>;
  forceSwitch?: unknown;
  hasCrashDamage?: boolean;
  heal?: unknown;
  mindBlownRecoil?: boolean;
  multihit?: number | number[];
  pp?: number;
  priority?: number;
  pseudoWeather?: string;
  recoil?: unknown;
  secondary?: RawShowdownMoveSecondary;
  secondaries?: RawShowdownMoveSecondary[];
  self?: {
    boosts?: Record<string, number>;
    volatileStatus?: string;
  };
  selfBoost?: {
    boosts?: Record<string, number>;
  };
  selfSwitch?: unknown;
  selfdestruct?: string | boolean;
  shortDesc?: string;
  sideCondition?: string;
  slotCondition?: string;
  stallingMove?: boolean;
  target?: string;
  terrain?: string;
  type?: string;
  volatileStatus?: string;
  weather?: string;
  willCrit?: boolean;
};

type RawShowdownMoveSecondary = {
  boosts?: Record<string, number>;
  self?: {
    boosts?: Record<string, number>;
  };
};

type ShowdownDataCachePayload = ShowdownDataSnapshot & {
  cachedAt: number;
};

const SHOWDOWN_POKEDEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";
const SHOWDOWN_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";
const SHOWDOWN_DATA_CACHE_KEY = "pokepilot:showdown-data:v1";
const SHOWDOWN_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const MOVE_FLAG_TAG_LABELS: Record<string, string> = {
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
const MOVE_FLAG_TAG_ORDER = Object.keys(MOVE_FLAG_TAG_LABELS);
const SPREAD_TARGET_TAG_LABELS: Record<string, string> = {
  all: "Spread: All",
  allAdjacent: "Spread: Adjacent",
  allAdjacentFoes: "Spread: Foes",
};
const PROTECTION_VOLATILES = new Set([
  "banefulbunker",
  "burningbulwark",
  "detect",
  "kingsshield",
  "obstruct",
  "protect",
  "silktrap",
  "spikyshield",
]);
const PROTECTION_SIDE_CONDITIONS = new Set([
  "craftyshield",
  "matblock",
  "quickguard",
  "wideguard",
]);
const SCREEN_SIDE_CONDITIONS = new Set([
  "auroraveil",
  "lightscreen",
  "mist",
  "reflect",
  "safeguard",
]);

let showdownDataPromise: Promise<ShowdownDataSnapshot> | null = null;

function addMoveTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) {
    tags.push(tag);
  }
}

function hasStatBoosts(boosts?: Record<string, number>) {
  return Boolean(boosts && Object.values(boosts).some((value) => value !== 0));
}

function hasStatChange(move: RawShowdownMove) {
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

function isDamagingMove(move: RawShowdownMove) {
  return move.category === "Physical" || move.category === "Special";
}

function getMoveTags(move: RawShowdownMove) {
  const flags = move.flags ?? {};
  const tags: string[] = [];
  const spreadTargetTag = move.target
    ? SPREAD_TARGET_TAG_LABELS[move.target]
    : undefined;

  for (const flag of MOVE_FLAG_TAG_ORDER) {
    if (flags[flag]) {
      addMoveTag(tags, MOVE_FLAG_TAG_LABELS[flag]);
    }
  }

  if (spreadTargetTag && isDamagingMove(move)) {
    addMoveTag(tags, spreadTargetTag);
  }

  if (move.damage !== undefined) {
    addMoveTag(tags, "Fixed Damage");
  }

  if (
    move.stallingMove ||
    (move.volatileStatus && PROTECTION_VOLATILES.has(move.volatileStatus)) ||
    (move.sideCondition && PROTECTION_SIDE_CONDITIONS.has(move.sideCondition))
  ) {
    addMoveTag(tags, "Protect");
  }

  if (move.volatileStatus === "partiallytrapped") {
    addMoveTag(tags, "Trap");
  }

  if (move.recoil || move.hasCrashDamage || move.mindBlownRecoil) {
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

  if (move.accuracy === true && isDamagingMove(move)) {
    addMoveTag(tags, "Never Miss");
  }

  if (move.weather || move.terrain || move.pseudoWeather || move.slotCondition) {
    addMoveTag(tags, "Field");
  }

  if (move.sideCondition && !PROTECTION_SIDE_CONDITIONS.has(move.sideCondition)) {
    addMoveTag(
      tags,
      SCREEN_SIDE_CONDITIONS.has(move.sideCondition) ? "Screen" : "Field",
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

function normalizeTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const types = value
    .filter((type): type is string => typeof type === "string")
    .map((type) => type.toLowerCase())
    .filter((type): type is PokemonType =>
      pokemonTypes.includes(type as PokemonType),
    );

  return types.length > 0 ? types : undefined;
}

function normalizeBaseStats(value: unknown): StatBlock | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const stats = value as Record<string, unknown>;
  const values = ["hp", "atk", "def", "spa", "spd", "spe"].map(
    (key) => stats[key],
  );

  if (!values.every((stat) => typeof stat === "number")) {
    return undefined;
  }

  return {
    hp: values[0] as number,
    attack: values[1] as number,
    defense: values[2] as number,
    specialAttack: values[3] as number,
    specialDefense: values[4] as number,
    speed: values[5] as number,
  };
}

function normalizeAbilities(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value as Record<string, unknown>).filter(
    (ability): ability is string => typeof ability === "string" && ability.length > 0,
  );
}

function normalizeSpecies(
  id: string,
  species: RawShowdownSpecies,
): ShowdownSpeciesData {
  return {
    id: normalizeShowdownId(id),
    name: species.name ?? formatIdLabel(id),
    num: typeof species.num === "number" ? species.num : undefined,
    types: normalizeTypes(species.types),
    baseStats: normalizeBaseStats(species.baseStats),
    abilities: normalizeAbilities(species.abilities),
    baseSpecies: species.baseSpecies,
    forme: species.forme,
  };
}

function normalizeMove(id: string, move: RawShowdownMove): PokemonMove | null {
  const type = move.type?.toLowerCase();
  const category = move.category;

  if (
    !type ||
    !pokemonTypes.includes(type as PokemonType) ||
    (category !== "Physical" && category !== "Special" && category !== "Status")
  ) {
    return null;
  }

  return {
    id: normalizeShowdownId(id),
    name: move.name ?? formatIdLabel(id),
    type: type as PokemonType,
    category,
    power:
      typeof move.basePower === "number" && move.basePower > 0
        ? move.basePower
        : null,
    accuracy: typeof move.accuracy === "number" ? move.accuracy : null,
    pp: typeof move.pp === "number" ? move.pp : 0,
    description:
      move.shortDesc ?? move.desc ?? "Move description is not available from Showdown.",
    tags: getMoveTags(move),
  };
}

function normalizeSnapshot(
  rawSpecies: Record<string, RawShowdownSpecies>,
  rawMoves: Record<string, RawShowdownMove>,
): ShowdownDataSnapshot {
  const speciesById: Record<string, ShowdownSpeciesData> = {};
  const movesById: Record<string, PokemonMove> = {};

  for (const [id, species] of Object.entries(rawSpecies)) {
    const normalized = normalizeSpecies(id, species);
    speciesById[normalized.id] = normalized;
  }

  for (const [id, move] of Object.entries(rawMoves)) {
    const normalized = normalizeMove(id, move);

    if (normalized) {
      movesById[normalized.id] = normalized;
    }
  }

  return { speciesById, movesById };
}

function getCachedSnapshot() {
  try {
    const cachedValue = localStorage.getItem(SHOWDOWN_DATA_CACHE_KEY);

    if (!cachedValue) {
      return null;
    }

    const parsed = JSON.parse(cachedValue) as Partial<ShowdownDataCachePayload>;
    const isFresh =
      typeof parsed.cachedAt === "number" &&
      Date.now() - parsed.cachedAt < SHOWDOWN_DATA_CACHE_TTL_MS;

    if (!isFresh || !parsed.speciesById || !parsed.movesById) {
      localStorage.removeItem(SHOWDOWN_DATA_CACHE_KEY);
      return null;
    }

    return {
      speciesById: parsed.speciesById,
      movesById: parsed.movesById,
    } as ShowdownDataSnapshot;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: ShowdownDataSnapshot) {
  try {
    localStorage.setItem(
      SHOWDOWN_DATA_CACHE_KEY,
      JSON.stringify({ ...snapshot, cachedAt: Date.now() }),
    );
  } catch {
    // The in-memory snapshot still prevents duplicate requests for this session.
  }
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { mode: "cors" });

  if (!response.ok) {
    throw new Error(`Showdown data request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

export async function loadShowdownData(): Promise<ShowdownDataSnapshot> {
  if (showdownDataPromise) {
    return showdownDataPromise;
  }

  showdownDataPromise = (async () => {
    const cached = getCachedSnapshot();

    if (cached) {
      return cached;
    }

    const [rawSpecies, rawMoves] = await Promise.all([
      fetchJson<Record<string, RawShowdownSpecies>>(SHOWDOWN_POKEDEX_URL),
      fetchJson<Record<string, RawShowdownMove>>(SHOWDOWN_MOVES_URL),
    ]);
    const snapshot = normalizeSnapshot(rawSpecies, rawMoves);

    saveSnapshot(snapshot);
    return snapshot;
  })();

  try {
    return await showdownDataPromise;
  } catch (error) {
    showdownDataPromise = null;
    throw error;
  }
}

export function findShowdownSpecies(
  snapshot: ShowdownDataSnapshot | null,
  candidates: string[],
) {
  if (!snapshot) {
    return undefined;
  }

  for (const candidate of candidates) {
    const species = snapshot.speciesById[normalizeShowdownId(candidate)];

    if (species) {
      return species;
    }
  }

  return undefined;
}
