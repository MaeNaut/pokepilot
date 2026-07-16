import type { TeamMember, TeamSlot } from "../types";
import type { BenchPokemon, PokemonBuildSnapshot } from "./benchPokemon";
import type { TeamBuildState } from "./teamBuildState";
export { createEmptyBuildState } from "./teamBuildState";

const savedTeamsStorageKey = "pokepilot.savedTeams.v1";
const lastActiveTeamStorageKey = "pokepilot.lastActiveTeam.v1";

export const SAVED_TEAM_SCHEMA_VERSION = 1;

export type SavedPokemon = {
  pokemonId: string;
  name: string;
  showdownId?: string;
  showdownName?: string;
  showdownGender?: "M" | "F";
  spriteUrl?: string;
  iconSpriteUrl?: string;
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
  slots: SavedTeamSlot[];
  bench: SavedBenchPokemon[];
  buildState?: TeamBuildState;
  createdAt: string;
  updatedAt: string;
};

export type TeamSnapshot = {
  name: string;
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
    slots: team.slots,
    bench: Array.isArray(team.bench) ? team.bench : [],
    buildState: team.buildState,
    createdAt: team.createdAt ?? now,
    updatedAt: team.updatedAt ?? team.createdAt ?? now,
  };
}

export function getStoredTeams(): SavedTeamSummary[] {
  try {
    const rawTeams = localStorage.getItem(savedTeamsStorageKey);
    const parsedTeams = rawTeams ? JSON.parse(rawTeams) : [];

    if (!Array.isArray(parsedTeams)) {
      return [];
    }

    return parsedTeams
      .map((team) => normalizeSavedTeam(team as Partial<SavedTeamSummary>))
      .filter((team): team is SavedTeamSummary => Boolean(team));
  } catch {
    return [];
  }
}

export function storeTeams(teams: SavedTeamSummary[]) {
  localStorage.setItem(savedTeamsStorageKey, JSON.stringify(teams));
}

export function getLastActiveTeamId() {
  return localStorage.getItem(lastActiveTeamStorageKey);
}

export function storeLastActiveTeamId(teamId: string) {
  localStorage.setItem(lastActiveTeamStorageKey, teamId);
}

export function clearLastActiveTeamId() {
  localStorage.removeItem(lastActiveTeamStorageKey);
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

export function createSavedPokemon(member: TeamMember): SavedPokemon {
  return {
    pokemonId: member.id,
    name: member.name,
    showdownId: member.showdownId,
    showdownName: member.showdownName,
    showdownGender: member.showdownGender,
    spriteUrl: member.spriteUrl,
    iconSpriteUrl: member.iconSpriteUrl,
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
  return JSON.stringify(snapshot);
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
    source: "local",
  };
}
