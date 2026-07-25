import { normalizeShowdownId } from "../api/showdownIds";
import type { PokemonMove } from "../types";

export function findMoveByLookup(
  moves: readonly PokemonMove[],
  value: string,
) {
  const lookup = normalizeShowdownId(value);

  if (!lookup) {
    return undefined;
  }

  return moves.find(
    (move) =>
      normalizeShowdownId(move.id) === lookup ||
      normalizeShowdownId(move.name) === lookup,
  );
}

export function reconcileMoveIds(
  moves: readonly PokemonMove[],
  currentMoveIds: string[],
  slotCount = 4,
) {
  const defaultMoveIds = moves
    .slice(0, slotCount)
    .map((move) => move.id);

  if (defaultMoveIds.length === 0) {
    return currentMoveIds;
  }

  const nextMoveIds = Array.from({ length: slotCount }, (_, index) => {
    const currentMoveId = currentMoveIds[index];

    if (currentMoveId === "") {
      return "";
    }

    if (currentMoveId) {
      return (
        findMoveByLookup(moves, currentMoveId)?.id ??
        defaultMoveIds[index] ??
        ""
      );
    }

    return defaultMoveIds[index] ?? "";
  });
  const isUnchanged =
    currentMoveIds.length === nextMoveIds.length &&
    currentMoveIds.every((moveId, index) => moveId === nextMoveIds[index]);

  return isUnchanged ? currentMoveIds : nextMoveIds;
}
