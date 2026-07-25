import type {
  PokemonCandidateFilterValue,
  PokemonIndexEntry,
} from "../types";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { cleanLegacyDataCaches } from "./legacyDataCache";
import { normalizeShowdownId } from "./showdownIds";

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

export type ShowdownLegalityPayload = {
  schemaVersion: number;
  formatId: string;
  dataMod: string;
  generatedAt: number;
  pokemonIds: string[];
  knownPokemonIds: string[];
  itemIds: string[];
  abilityByPokemon: Array<[string, string[]]>;
  moveByPokemon: Array<[string, string[]]>;
};

const SHOWDOWN_DEFAULT_FORMAT_ID = "gen9-regulation-mb";
const REGULATION_MB_SNAPSHOT_URL = "/data/showdown-regulation-mb.json";
let regulationMbSnapshotPromise: Promise<ShowdownLegalitySnapshot> | null = null;

function isRegulationMbFormat(formatId: string) {
  const normalized = normalizeShowdownId(formatId);

  return (
    normalized === "gen9regulationmb" ||
    normalized === "gen9championsbssregmb" ||
    normalized === "gen9championsvgc2026regmb" ||
    normalized.includes("championsregmb") ||
    normalized.includes("regulationmb")
  );
}

export function getShowdownLookupKeys(value: string) {
  return [
    ...new Set(
      getPokemonLookupAliases(value).map(normalizeShowdownId).filter(Boolean),
    ),
  ];
}

function collectCandidateLookupKeys(pokemonId: string, speciesKey?: string) {
  return new Set([
    ...getShowdownLookupKeys(pokemonId),
    ...(speciesKey ? getShowdownLookupKeys(speciesKey) : []),
  ]);
}

function findSetByPokemonKey(
  source: Map<string, Set<string>>,
  pokemonId: string,
  speciesKey?: string,
) {
  const candidates = collectCandidateLookupKeys(pokemonId, speciesKey);
  const result = new Set<string>();

  for (const key of candidates) {
    const entry = source.get(key);

    if (!entry) {
      continue;
    }

    for (const value of entry) {
      result.add(value);
    }
  }

  return result.size > 0 ? result : null;
}

function restoreSetList(entries: Array<[string, string[]]>) {
  return new Map(
    entries.map(([key, values]) => [
      normalizeShowdownId(key),
      new Set(values.map(normalizeShowdownId).filter(Boolean)),
    ]),
  );
}

function hasSnapshotArrays(
  payload: Partial<ShowdownLegalityPayload>,
): payload is ShowdownLegalityPayload {
  return (
    payload.schemaVersion === 1 &&
    typeof payload.formatId === "string" &&
    typeof payload.dataMod === "string" &&
    typeof payload.generatedAt === "number" &&
    Array.isArray(payload.pokemonIds) &&
    Array.isArray(payload.knownPokemonIds) &&
    Array.isArray(payload.itemIds) &&
    Array.isArray(payload.abilityByPokemon) &&
    Array.isArray(payload.moveByPokemon)
  );
}

export function hydrateShowdownLegalitySnapshot(
  payload: Partial<ShowdownLegalityPayload>,
  loadedFormatId: string = SHOWDOWN_DEFAULT_FORMAT_ID,
): ShowdownLegalitySnapshot {
  if (!hasSnapshotArrays(payload)) {
    throw new Error("Unsupported Regulation M-B legality snapshot.");
  }

  return {
    pokemonIds: new Set(
      payload.pokemonIds.map(normalizeShowdownId).filter(Boolean),
    ),
    knownPokemonIds: new Set(
      payload.knownPokemonIds.map(normalizeShowdownId).filter(Boolean),
    ),
    itemIds: new Set(payload.itemIds.map(normalizeShowdownId).filter(Boolean)),
    abilityByPokemon: restoreSetList(payload.abilityByPokemon),
    moveByPokemon: restoreSetList(payload.moveByPokemon),
    loadedFormatId,
    dataMod: payload.dataMod,
    generatedAt: payload.generatedAt,
    source: "showdown",
  };
}

async function fetchSnapshotPayload() {
  const response = await fetch(REGULATION_MB_SNAPSHOT_URL);

  if (!response.ok) {
    throw new Error(
      `Regulation M-B snapshot request failed (${response.status}).`,
    );
  }

  return response.json() as Promise<ShowdownLegalityPayload>;
}

function createUnavailableSnapshot(formatId: string, error: unknown) {
  return {
    pokemonIds: new Set<string>(),
    knownPokemonIds: new Set<string>(),
    itemIds: new Set<string>(),
    abilityByPokemon: new Map<string, Set<string>>(),
    moveByPokemon: new Map<string, Set<string>>(),
    loadedFormatId: formatId,
    dataMod: "champions",
    generatedAt: Date.now(),
    source: "showdown" as const,
    error: error instanceof Error ? error.message : "Unknown legality load error.",
  };
}

export async function loadShowdownLegality(
  formatId: string = SHOWDOWN_DEFAULT_FORMAT_ID,
): Promise<ShowdownLegalitySnapshot> {
  cleanLegacyDataCaches();

  if (!isRegulationMbFormat(formatId)) {
    return createUnavailableSnapshot(
      formatId,
      new Error(`Unsupported Showdown format "${formatId}".`),
    );
  }

  if (!regulationMbSnapshotPromise) {
    regulationMbSnapshotPromise = fetchSnapshotPayload()
      .then((payload) => hydrateShowdownLegalitySnapshot(payload))
      .catch((error) => {
        regulationMbSnapshotPromise = null;
        return createUnavailableSnapshot(formatId, error);
      });
  }

  const snapshot = await regulationMbSnapshotPromise;

  return snapshot.loadedFormatId === formatId
    ? snapshot
    : { ...snapshot, loadedFormatId: formatId };
}

export function isPokemonLegal(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
) {
  if (!showdownLegality || showdownLegality.pokemonIds.size === 0) {
    return true;
  }

  const exactKeys = getShowdownLookupKeys(pokemonId);

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

export function isExactPokemonFormLegal(
  showdownLegality: ShowdownLegalitySnapshot | null | undefined,
  pokemonId: string,
) {
  if (!showdownLegality || showdownLegality.pokemonIds.size === 0) {
    return true;
  }

  return getShowdownLookupKeys(pokemonId).some((lookup) =>
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

  return showdownLegality.itemIds.has(normalizeShowdownId(itemId));
}

export function getLegalAbilities(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
) {
  if (!showdownLegality || showdownLegality.abilityByPokemon.size === 0) {
    return null;
  }

  return findSetByPokemonKey(
    showdownLegality.abilityByPokemon,
    pokemonId,
    speciesKey,
  );
}

export function getLegalMoves(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
) {
  if (!showdownLegality || showdownLegality.moveByPokemon.size === 0) {
    return null;
  }

  return findSetByPokemonKey(
    showdownLegality.moveByPokemon,
    pokemonId,
    speciesKey,
  );
}

function addCandidateAbilities(
  abilitiesById: Map<string, PokemonCandidateFilterValue>,
  showdownLegality: ShowdownLegalitySnapshot | null,
  entry: PokemonIndexEntry,
) {
  const namesById = new Map(
    entry.abilities.map((ability) => [normalizeShowdownId(ability), ability]),
  );
  const legalAbilityIds =
    getLegalAbilities(showdownLegality, entry.showdownId) ??
    new Set(namesById.keys());

  for (const abilityId of legalAbilityIds) {
    const id = normalizeShowdownId(abilityId);

    if (!id) {
      continue;
    }

    abilitiesById.set(id, {
      id,
      name: namesById.get(id) ?? abilityId,
    });
  }
}

export function getPokemonCandidateAbilities(
  showdownLegality: ShowdownLegalitySnapshot | null,
  entry: PokemonIndexEntry,
  pokemonIndex: readonly PokemonIndexEntry[],
) {
  const abilitiesById = new Map<string, PokemonCandidateFilterValue>();
  addCandidateAbilities(abilitiesById, showdownLegality, entry);

  if (entry.formKind === "regional") {
    return [...abilitiesById.values()];
  }

  for (const form of pokemonIndex) {
    if (
      form.speciesKey !== entry.speciesKey ||
      form.formKind !== "mega" ||
      !isExactPokemonFormLegal(showdownLegality, form.showdownId)
    ) {
      continue;
    }

    addCandidateAbilities(abilitiesById, showdownLegality, form);
  }

  return [...abilitiesById.values()];
}
