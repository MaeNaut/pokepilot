import { getLegalMoves, type ShowdownLegalitySnapshot } from "../api/showdownLegality";
import { normalizeShowdownId } from "../api/showdownIds";
import type { PokemonMove } from "../types";

export function getEditorLegalMoveIds(
  legality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
  speciesKey?: string,
  preMegaPokemonId?: string,
) {
  const active = getLegalMoves(legality, pokemonId, speciesKey);
  const original = preMegaPokemonId ? getLegalMoves(legality, preMegaPokemonId, speciesKey) : null;
  if (!active) return original;
  if (!original) return active;
  return new Set([...active, ...original]);
}

export function filterEditorLegalMoves(moves: PokemonMove[], legalIds: ReadonlySet<string> | null) {
  if (!legalIds) return moves;
  return moves.filter((move) => legalIds.has(normalizeShowdownId(move.id)) || legalIds.has(normalizeShowdownId(move.name)));
}
