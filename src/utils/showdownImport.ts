import { fetchPokemon } from "../api/pokeApi";
import { fetchItem } from "../api/showdownCatalog";
import { normalizeShowdownId } from "../api/showdownIds";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  defaultEvs,
} from "../data/natures";
import { ACTIVE_TEAM_SIZE } from "../data/teamLimits";
import type {
  PokemonIndexEntry,
  PokemonItem,
  TeamMember,
  TeamSlot,
} from "../types";
import { getPreferredPokeApiId } from "./pokemonAliases";
import { parseShowdownTeam } from "./showdownText";
import {
  createEmptyBuildState,
  type TeamBuildState,
} from "./teamBuildState";

export type ImportedShowdownSnapshot = {
  members: TeamSlot[];
  buildState: TeamBuildState;
};

export type ShowdownImportServices = {
  fetchPokemon: (pokemonId: string) => Promise<TeamMember>;
  fetchItem: (itemId: string) => Promise<PokemonItem>;
};

type BuildImportedShowdownSnapshotOptions = {
  pokemonIndex: PokemonIndexEntry[];
  emptyTeamMessage?: string;
  teamSize?: number;
  services?: ShowdownImportServices;
};

const defaultImportServices: ShowdownImportServices = {
  fetchPokemon,
  fetchItem,
};

export function normalizeImportedEvs(
  evs: Partial<TeamBuildState["evsBySlot"][number]>,
) {
  const stats = [
    "hp",
    "attack",
    "defense",
    "specialAttack",
    "specialDefense",
    "speed",
  ] as const;
  let remaining = CHAMPIONS_MAX_EV_TOTAL;

  return stats.reduce(
    (normalized, stat) => {
      const value = Math.max(
        0,
        Math.min(CHAMPIONS_MAX_EV_PER_STAT, evs[stat] ?? 0, remaining),
      );

      remaining -= value;

      return {
        ...normalized,
        [stat]: value,
      };
    },
    defaultEvs,
  );
}

export function resolveImportedPokemonId(
  name: string,
  pokemonIndex: PokemonIndexEntry[],
  gender?: "M" | "F",
) {
  const preferredPokeApiId = getPreferredPokeApiId(name);

  if (preferredPokeApiId) {
    return preferredPokeApiId;
  }

  const normalized = normalizeShowdownId(name);
  const genderLabel = gender === "F" ? "female" : gender === "M" ? "male" : null;
  const genderMatchedEntry = genderLabel
    ? pokemonIndex.find(
        (entry) =>
          normalizeShowdownId(entry.speciesKey) === normalized &&
          entry.formKind === "gender" &&
          entry.formLabel?.toLowerCase() === genderLabel,
      )
    : undefined;

  if (genderMatchedEntry) {
    return genderMatchedEntry.name;
  }

  const matchedEntry = pokemonIndex.find((entry) => {
    const entryNames = [
      entry.name,
      entry.showdownId,
      entry.displayName,
      entry.displayName.replace(/\s+/g, "-"),
    ].map(normalizeShowdownId);

    return entryNames.includes(normalized);
  });

  return matchedEntry?.name ?? normalized;
}

export async function buildImportedShowdownSnapshot(
  text: string,
  {
    pokemonIndex,
    emptyTeamMessage = "Paste at least one Pokemon set.",
    teamSize = ACTIVE_TEAM_SIZE,
    services = defaultImportServices,
  }: BuildImportedShowdownSnapshotOptions,
): Promise<ImportedShowdownSnapshot> {
  const parsedTeam = parseShowdownTeam(text);

  if (parsedTeam.length === 0) {
    throw new Error(emptyTeamMessage);
  }

  const importedMembers: TeamSlot[] = [];
  const importedBuildState = createEmptyBuildState();

  for (const [slotIndex, parsedPokemon] of parsedTeam.entries()) {
    if (!parsedPokemon.pokemonName) {
      importedMembers.push(null);
      continue;
    }

    const pokemonId = resolveImportedPokemonId(
      parsedPokemon.pokemonName,
      pokemonIndex,
      parsedPokemon.gender,
    );
    const member = await services.fetchPokemon(pokemonId);

    importedMembers.push(member);

    if (parsedPokemon.itemName) {
      try {
        importedBuildState.itemBySlot[slotIndex] = await services.fetchItem(
          normalizeShowdownId(parsedPokemon.itemName),
        );
      } catch {
        importedBuildState.itemBySlot[slotIndex] = null;
      }
    }

    if (parsedPokemon.ability) {
      importedBuildState.abilityBySlot[slotIndex] = parsedPokemon.ability;
    }

    if (parsedPokemon.nature) {
      importedBuildState.natureBySlot[slotIndex] = parsedPokemon.nature;
    }

    if (parsedPokemon.evs) {
      importedBuildState.evsBySlot[slotIndex] = normalizeImportedEvs(
        parsedPokemon.evs,
      );
    }

    const moveIds = parsedPokemon.moves.map(normalizeShowdownId);
    importedBuildState.moveIdsBySlot[slotIndex] = [0, 1, 2, 3].map(
      (moveIndex) => moveIds[moveIndex] ?? "",
    );
  }

  while (importedMembers.length < teamSize) {
    importedMembers.push(null);
  }

  return {
    members: importedMembers.slice(0, teamSize),
    buildState: importedBuildState,
  };
}
