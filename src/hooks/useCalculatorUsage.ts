import { useMemo } from "react";
import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  resolveUsageCalculatorItems,
  resolveUsageCalculatorMoves,
} from "../calculator/calculatorUsageBuild";
import type { ItemIndexEntry, PokemonMove, TeamMember } from "../types";
import { usePopularUsageSet } from "./usePopularUsageSet";

export function useCalculatorUsage({
  member,
  fallbackMoves,
  battleFormat,
  itemOptions,
}: {
  member: TeamMember | null;
  fallbackMoves: readonly PokemonMove[];
  battleFormat: BattleFormat;
  itemOptions?: readonly ItemIndexEntry[];
}) {
  const usage = usePopularUsageSet(member?.id ?? null, battleFormat);
  const moves = useMemo(
    () => member && usage ? resolveUsageCalculatorMoves(member, usage, fallbackMoves) : [],
    [member, usage, fallbackMoves],
  );
  const items = useMemo(
    () => usage && itemOptions ? resolveUsageCalculatorItems(usage, itemOptions) : [],
    [usage, itemOptions],
  );

  return { moves, items };
}
