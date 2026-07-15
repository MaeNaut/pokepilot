import type {
  PokemonCandidateFilters,
  PokemonCandidateFilterValue,
  PokemonType,
} from "../types";

export type PokemonCandidate = {
  types: readonly PokemonType[];
  abilityIds: readonly string[];
  moveIds: readonly string[];
};

export const emptyPokemonCandidateFilters: PokemonCandidateFilters = {
  types: [],
  ability: null,
  moves: [],
};

export function matchesPokemonTypeFilters(
  candidateTypes: readonly PokemonType[],
  selectedTypes: readonly PokemonType[],
) {
  return selectedTypes.every((type) => candidateTypes.includes(type));
}

export function togglePokemonTypeFilter(
  selectedTypes: readonly PokemonType[],
  type: PokemonType,
  maximumTypes = 2,
) {
  if (selectedTypes.includes(type)) {
    return selectedTypes.filter((selectedType) => selectedType !== type);
  }

  if (selectedTypes.length >= maximumTypes) {
    return [...selectedTypes];
  }

  return [...selectedTypes, type];
}

export function hasPokemonCandidateFilters(filters: PokemonCandidateFilters) {
  return Boolean(filters.types.length || filters.ability || filters.moves.length);
}

export function matchesPokemonCandidateFilters(
  candidate: PokemonCandidate,
  filters: PokemonCandidateFilters,
) {
  return (
    matchesPokemonTypeFilters(candidate.types, filters.types) &&
    (!filters.ability || candidate.abilityIds.includes(filters.ability.id)) &&
    filters.moves.every((move) => candidate.moveIds.includes(move.id))
  );
}

export function normalizePokemonCandidateFilters(
  filters?: Partial<PokemonCandidateFilters> | null,
): PokemonCandidateFilters {
  const normalizeValue = (
    value: PokemonCandidateFilterValue | null | undefined,
  ): PokemonCandidateFilterValue | null =>
    value?.id && value.name ? { id: value.id, name: value.name } : null;

  const normalizedMoves = Array.isArray(filters?.moves)
    ? filters.moves
        .map((move) => normalizeValue(move))
        .filter((move): move is PokemonCandidateFilterValue => Boolean(move))
    : [];

  return {
    types: Array.isArray(filters?.types)
      ? [...new Set(filters.types)].slice(0, 2)
      : [],
    ability: normalizeValue(filters?.ability),
    moves: [...new Map(normalizedMoves.map((move) => [move.id, move])).values()].slice(
      0,
      4,
    ),
  };
}
