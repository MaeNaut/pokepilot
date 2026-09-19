import { useMemo } from "react";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { resolveUsageCalculatorMoves } from "../calculator/calculatorUsageBuild";
import type { PokemonMove, TeamMember } from "../types";
import { usePopularUsageSet } from "./usePopularUsageSet";

export function useCalculatorUsageMoves(member: TeamMember | null, fallbackMoves: readonly PokemonMove[], battleFormat: BattleFormat) {
  const usage = usePopularUsageSet(member?.id ?? null, battleFormat);
  return useMemo(() => member && usage ? resolveUsageCalculatorMoves(member, usage, fallbackMoves) : [], [member, usage, fallbackMoves]);
}
