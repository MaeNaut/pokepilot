import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import type {
  PokemonCandidateFilters,
  PokemonCandidateFilterValue,
  PokemonMove,
  PokemonType,
} from "../types";
import { matchesPokemonCandidateFilters } from "./pokemonCandidateFilters";

export type CandidateFilterPicker = "ability" | "move";

export type CandidateFilterOption = PokemonCandidateFilterValue & {
  type?: PokemonType;
  power?: number | null;
};

export type CandidateFilterPokemonOption = {
  types: readonly PokemonType[];
  abilityOptions: readonly PokemonCandidateFilterValue[];
  moveIds: readonly string[];
};

export function indexCandidateMoves(moves: readonly PokemonMove[]) {
  return new Map(
    moves.map((move) => [normalizeShowdownId(move.id), move]),
  );
}

export function getCandidateAbilityOptions(
  pokemonOptions: readonly CandidateFilterPokemonOption[],
  filters: PokemonCandidateFilters,
) {
  const optionsById = new Map<string, PokemonCandidateFilterValue>();
  const filtersWithoutAbility = { ...filters, ability: null };

  for (const option of pokemonOptions) {
    if (
      !matchesPokemonCandidateFilters(
        {
          types: option.types,
          abilityIds: option.abilityOptions.map((ability) => ability.id),
          moveIds: option.moveIds,
        },
        filtersWithoutAbility,
      )
    ) {
      continue;
    }

    for (const ability of option.abilityOptions) {
      optionsById.set(ability.id, ability);
    }
  }

  return [...optionsById.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

export function getSelectedCandidateMoveOptions(
  filters: PokemonCandidateFilters,
  moveById: ReadonlyMap<string, PokemonMove>,
): CandidateFilterOption[] {
  return filters.moves.map((filter) => {
    const move = moveById.get(normalizeShowdownId(filter.id));

    return {
      ...filter,
      type: move?.type,
      power: move?.power,
    };
  });
}

export function getCandidateMoveOptions(
  pokemonOptions: readonly CandidateFilterPokemonOption[],
  filters: PokemonCandidateFilters,
  moveFilterSlot: number | null,
  moveById: ReadonlyMap<string, PokemonMove>,
  getMoveName: (moveId: string, fallback: string) => string,
): CandidateFilterOption[] {
  const editedMoveIndex = Math.min(
    moveFilterSlot ?? filters.moves.length,
    filters.moves.length,
  );
  const retainedMoves = filters.moves.filter(
    (_, moveIndex) => moveIndex !== editedMoveIndex,
  );
  const filtersWithoutEditedMove = {
    ...filters,
    moves: retainedMoves,
  };
  const selectedMoveIds = new Set(
    retainedMoves.map((move) => normalizeShowdownId(move.id)),
  );
  const moveIds = new Set<string>();

  for (const option of pokemonOptions) {
    if (
      !matchesPokemonCandidateFilters(
        {
          types: option.types,
          abilityIds: option.abilityOptions.map((ability) => ability.id),
          moveIds: option.moveIds,
        },
        filtersWithoutEditedMove,
      )
    ) {
      continue;
    }

    for (const moveId of option.moveIds) {
      const normalizedMoveId = normalizeShowdownId(moveId);
      if (!selectedMoveIds.has(normalizedMoveId)) {
        moveIds.add(normalizedMoveId);
      }
    }
  }

  return [...moveIds]
    .map((moveId) => {
      const move = moveById.get(moveId);
      return {
        id: moveId,
        name: getMoveName(moveId, move?.name ?? formatIdLabel(moveId)),
        type: move?.type,
        power: move?.power,
      };
    })
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function filterCandidateOptionsByQuery(
  options: readonly CandidateFilterOption[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [...options];
  }

  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(normalizedQuery) ||
      option.id.includes(normalizedQuery),
  );
}
