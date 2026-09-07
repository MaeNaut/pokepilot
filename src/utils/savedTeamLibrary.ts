import { fetchPokemon } from "../api/pokeApi";
import type { TeamMember } from "../types";
import { isFullShowdownSpriteUrl } from "./pokemonSprites";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  createFallbackMember,
  createSavedTeamId,
  getCopiedTeamName,
  type SavedPokemon,
  type SavedTeamSummary,
  type TeamSnapshot,
} from "./teamStorage";

export function createSavedTeam(
  snapshot: TeamSnapshot,
  existing?: SavedTeamSummary,
): SavedTeamSummary {
  const now = new Date().toISOString();
  return {
    ...snapshot,
    version: SAVED_TEAM_SCHEMA_VERSION,
    id: existing?.id ?? createSavedTeamId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function renameSavedTeam(team: SavedTeamSummary, name: string): SavedTeamSummary {
  return { ...team, name, updatedAt: new Date().toISOString() };
}

export function copySavedTeam(
  team: SavedTeamSummary,
  teams: SavedTeamSummary[],
): SavedTeamSummary {
  const now = new Date().toISOString();
  return {
    ...team,
    version: SAVED_TEAM_SCHEMA_VERSION,
    id: createSavedTeamId(),
    name: getCopiedTeamName(team.name, teams),
    createdAt: now,
    updatedAt: now,
  };
}

async function hydrateSavedPokemon(slot: SavedPokemon, pool: TeamMember[]) {
  const member = pool.find((candidate) => candidate.id === slot.pokemonId);
  if (member && !isFullShowdownSpriteUrl(member.iconSpriteUrl)) return member;
  try {
    return await fetchPokemon(slot.pokemonId);
  } catch {
    return createFallbackMember(slot);
  }
}

export function hydrateSavedTeamMembers(team: SavedTeamSummary, pool: TeamMember[]) {
  return Promise.all(team.slots.map((slot) => slot ? hydrateSavedPokemon(slot, pool) : null));
}

export function hydrateSavedBench(team: SavedTeamSummary, pool: TeamMember[]) {
  return Promise.all(team.bench.map(async (entry) => ({
    id: entry.id,
    member: await hydrateSavedPokemon(entry.pokemon, pool),
    build: entry.build,
  })));
}
