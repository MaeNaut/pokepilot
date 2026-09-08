import { normalizeShowdownId } from "../../api/showdownIds";
import {
  MAX_ALTERNATE_ITEM_LOADOUTS,
  MAX_ALTERNATE_MOVE_LOADOUTS,
  MAX_ALTERNATE_USAGE_MOVES,
  MAX_REPLACEMENT_SLOTS_PER_MOVE,
} from "./constants";
import type {
  CalculatorAnalysisContext,
  CandidateLoadout,
  OptimizationMove,
} from "./types";

function getItemId(item: CandidateLoadout["item"]) {
  return normalizeShowdownId(item?.showdownId ?? item?.id ?? item?.name ?? "");
}

function getCurrentMoveIds(context: CalculatorAnalysisContext) {
  return [0, 1, 2, 3].map(
    (index) =>
      context.player.moves[index]?.id ?? context.player.build.moveIds[index] ?? "",
  );
}

function getSelectedMoves(context: CalculatorAnalysisContext) {
  return context.player.moves.flatMap((move, slotIndex) => {
    if (
      !move?.power ||
      move.power <= 0 ||
      (move.category !== "Physical" && move.category !== "Special")
    ) {
      return [];
    }
    return [{ move, source: "selected" as const, slotIndex }];
  });
}

function createItemLoadouts(
  context: CalculatorAnalysisContext,
  selectedMoves: ReturnType<typeof getSelectedMoves>,
) {
  if (context.player.build.item?.category === "Mega Stones") return [];

  const currentItemId = getItemId(context.player.build.item);
  return (context.player.usageItems ?? [])
    .filter(
      (item) =>
        item.category !== "Mega Stones" &&
        getItemId(item) !== currentItemId,
    )
    .slice(0, MAX_ALTERNATE_ITEM_LOADOUTS)
    .map<CandidateLoadout>((item) => ({
      item,
      moveIds: getCurrentMoveIds(context),
      moves: selectedMoves.map(({ move, source }) => ({ move, source })),
      moveChanges: [],
    }));
}

function createMoveLoadouts(
  context: CalculatorAnalysisContext,
  playerMoves: OptimizationMove[],
  selectedMoves: ReturnType<typeof getSelectedMoves>,
) {
  if (selectedMoves.length === 0) return [];

  return playerMoves
    .filter(({ source }) => source === "usage")
    .slice(0, MAX_ALTERNATE_USAGE_MOVES)
    .flatMap(({ move }) => {
      const replacements = selectedMoves.slice(
        0,
        MAX_REPLACEMENT_SLOTS_PER_MOVE,
      );

      return replacements.map<CandidateLoadout>((replacement) => {
        const moveIds = getCurrentMoveIds(context);
        moveIds[replacement.slotIndex] = move.id;
        const moves = selectedMoves.map(({ move: selectedMove, source }) =>
          selectedMove.id === replacement.move.id
            ? { move, source: "usage" as const }
            : { move: selectedMove, source },
        );

        return {
          item: context.player.build.item,
          moveIds,
          moves,
          moveChanges: [{
            slotIndex: replacement.slotIndex,
            currentMoveId: replacement.move.id,
            currentMoveName: replacement.move.name,
            optimizedMoveId: move.id,
            optimizedMoveName: move.name,
            sameTypeAndCategory:
              replacement.move.type === move.type &&
              replacement.move.category === move.category,
          }],
        };
      });
    })
    .slice(0, MAX_ALTERNATE_MOVE_LOADOUTS);
}

export function createAlternativeLoadouts(
  context: CalculatorAnalysisContext,
  playerMoves: OptimizationMove[],
) {
  const selectedMoves = getSelectedMoves(context);
  return [
    ...createMoveLoadouts(context, playerMoves, selectedMoves),
    ...createItemLoadouts(context, selectedMoves),
  ];
}
