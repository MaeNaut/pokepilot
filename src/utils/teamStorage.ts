import type { PokemonItem, TeamMember, TeamSlot } from "../types";
import {
  resolveBattleFormat,
  type BattleFormat,
} from "../battleFormat/battleFormat";
import type { BenchPokemon, PokemonBuildSnapshot } from "./benchPokemon";
import {
  normalizeBuildState,
  type TeamBuildState,
} from "./teamBuildState";
import {
  clearConsumedPendingCollections, clearPendingCollection, readPendingCollection,
  readPendingCollections, writePendingCollection, pendingTeamsStorageKey, type PendingAccountCollection,
  type StoredPendingAccountCollection,
} from "./accountPendingStorage";
export { createEmptyBuildState } from "./teamBuildState";

const savedTeamsStorageKey = "pokepilot.savedTeams.v1";
const lastActiveTeamStorageKey = "pokepilot.lastActiveTeam.v1";
const savedTeamsAccountStorageKey = "pokepilot.savedTeams.account.v1";
const managedTeamsStorageKey = "pokepilot.savedTeams.managed.v1";

export const SAVED_TEAM_SCHEMA_VERSION = 1;

export type SavedPokemon = {
  pokemonId: string;
  name: string;
  showdownId?: string;
  showdownName?: string;
  showdownGender?: "M" | "F";
  spriteUrl?: string;
  iconSpriteUrl?: string;
  iconFallbackSpriteUrls?: string[];
};

export type SavedTeamSlot = SavedPokemon | null;

export type SavedBenchPokemon = {
  id: string;
  pokemon: SavedPokemon;
  build: PokemonBuildSnapshot;
};

export type SavedTeamSummary = {
  version: typeof SAVED_TEAM_SCHEMA_VERSION;
  id: string;
  name: string;
  battleFormat: BattleFormat;
  slots: SavedTeamSlot[];
  bench: SavedBenchPokemon[];
  buildState?: TeamBuildState;
  createdAt: string;
  updatedAt: string;
};

export type TeamSnapshot = {
  name: string;
  battleFormat: BattleFormat;
  slots: SavedTeamSlot[];
  bench: SavedBenchPokemon[];
  buildState: TeamBuildState;
};

export function createSavedTeamId() {
  return globalThis.crypto?.randomUUID?.() ?? `team-${Date.now()}`;
}

export function normalizeSavedTeam(
  team: Partial<SavedTeamSummary>,
): SavedTeamSummary | null {
  if (!team.id || !team.name || !Array.isArray(team.slots)) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    version: SAVED_TEAM_SCHEMA_VERSION,
    id: team.id,
    name: team.name,
    battleFormat: resolveBattleFormat(team.battleFormat),
    slots: team.slots,
    bench: Array.isArray(team.bench) ? team.bench : [],
    buildState: team.buildState,
    createdAt: team.createdAt ?? now,
    updatedAt: team.updatedAt ?? team.createdAt ?? now,
  };
}

export function normalizeSavedTeams(value: unknown): SavedTeamSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((team) => normalizeSavedTeam(team as Partial<SavedTeamSummary>))
    .filter((team): team is SavedTeamSummary => Boolean(team));
}

export function getStoredTeams(): SavedTeamSummary[] {
  try {
    const rawTeams = localStorage.getItem(savedTeamsStorageKey);
    return normalizeSavedTeams(rawTeams ? JSON.parse(rawTeams) : []);
  } catch {
    return [];
  }
}

export function storeTeams(teams: SavedTeamSummary[]) {
  localStorage.setItem(savedTeamsStorageKey, JSON.stringify(teams));
}

export function getPendingTeams() {
  return readPendingCollection(pendingTeamsStorageKey, normalizeSavedTeams);
}

export function getAllPendingTeams() {
  return readPendingCollections(pendingTeamsStorageKey, normalizeSavedTeams);
}

export function storePendingTeams(pending: PendingAccountCollection<SavedTeamSummary>) {
  writePendingCollection(pendingTeamsStorageKey, pending);
}

export function clearPendingTeams(accountId?: string) {
  clearPendingCollection(pendingTeamsStorageKey, accountId);
}

export function clearConsumedPendingTeams(records: StoredPendingAccountCollection<SavedTeamSummary>[]) {
  clearConsumedPendingCollections(records);
}

export function hasManagedTeams(accountId: string) {
  try {
    return localStorage.getItem(managedTeamsStorageKey) === accountId;
  } catch {
    return false;
  }
}

export function markManagedTeams(accountId: string) {
  localStorage.setItem(managedTeamsStorageKey, accountId);
}

export function getLastActiveTeamId() {
  try {
    return localStorage.getItem(lastActiveTeamStorageKey);
  } catch {
    return null;
  }
}

export function storeLastActiveTeamId(teamId: string) {
  try {
    localStorage.setItem(lastActiveTeamStorageKey, teamId);
  } catch {
    // Last-opened team is only a navigation hint; account sync still continues.
  }
}

export function clearLastActiveTeamId() {
  try {
    localStorage.removeItem(lastActiveTeamStorageKey);
  } catch {
    // The account data is cleared separately by the collection owner.
  }
}

export function clearStoredTeams() {
  const ownerId = getStoredTeamsAccountId();
  if (ownerId) clearPendingTeams(ownerId);
  localStorage.removeItem(managedTeamsStorageKey);
  localStorage.removeItem(savedTeamsStorageKey);
  localStorage.removeItem(savedTeamsAccountStorageKey);
  clearLastActiveTeamId();
}

export function getStoredTeamsAccountId() {
  return localStorage.getItem(savedTeamsAccountStorageKey);
}

export function storeSavedTeamsAccountId(accountId: string) {
  localStorage.setItem(savedTeamsAccountStorageKey, accountId);
}

export function getCopiedTeamName(name: string, teams: SavedTeamSummary[]) {
  const baseName = `${name} Copy`;
  const usedNames = new Set(teams.map((team) => team.name.toLowerCase()));

  if (!usedNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let copyNumber = 2;

  while (usedNames.has(`${baseName} ${copyNumber}`.toLowerCase())) {
    copyNumber += 1;
  }

  return `${baseName} ${copyNumber}`;
}

function createSavedPokemon(member: TeamMember): SavedPokemon {
  return {
    pokemonId: member.id,
    name: member.name,
    showdownId: member.showdownId,
    showdownName: member.showdownName,
    showdownGender: member.showdownGender,
    spriteUrl: member.spriteUrl,
    iconSpriteUrl: member.iconSpriteUrl,
    iconFallbackSpriteUrls: member.iconFallbackSpriteUrls,
  };
}

export function createSavedSlot(member: TeamSlot): SavedTeamSlot {
  return member ? createSavedPokemon(member) : null;
}

export function createSavedBenchPokemon(entry: BenchPokemon): SavedBenchPokemon {
  return {
    id: entry.id,
    pokemon: createSavedPokemon(entry.member),
    build: entry.build,
  };
}

export function serializeTeamSnapshot(snapshot: TeamSnapshot) {
  const itemIdentity = (item: PokemonItem | null) =>
    item
      ? {
          id: item.id,
          showdownId: item.showdownId,
        }
      : null;
  const pokemonIdentity = (pokemon: SavedPokemon) => ({
    pokemonId: pokemon.pokemonId,
    showdownGender: pokemon.showdownGender,
  });
  const buildState = normalizeBuildState(snapshot.buildState);

  return JSON.stringify({
    name: snapshot.name,
    battleFormat: snapshot.battleFormat,
    slots: snapshot.slots.map((slot) =>
      slot ? pokemonIdentity(slot) : null,
    ),
    bench: snapshot.bench.map((entry) => ({
      id: entry.id,
      pokemon: pokemonIdentity(entry.pokemon),
      build: {
        ...entry.build,
        item: itemIdentity(entry.build.item),
      },
    })),
    buildState: {
      ...buildState,
      itemBySlot: Object.fromEntries(
        Object.entries(buildState.itemBySlot).map(([slotIndex, item]) => [
          slotIndex,
          itemIdentity(item),
        ]),
      ),
    },
  });
}

export function createFallbackMember(slot: SavedPokemon): TeamMember {
  return {
    id: slot.pokemonId,
    name: slot.name,
    showdownId: slot.showdownId,
    showdownName: slot.showdownName,
    showdownGender: slot.showdownGender,
    types: [],
    roles: [],
    spriteUrl: slot.spriteUrl,
    iconSpriteUrl: slot.iconSpriteUrl,
    iconFallbackSpriteUrls: slot.iconFallbackSpriteUrls,
    source: "local",
  };
}
