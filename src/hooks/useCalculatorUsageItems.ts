import { useMemo } from "react";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { resolveUsageCalculatorItems } from "../calculator/calculatorUsageBuild";
import type { ItemIndexEntry, TeamMember } from "../types";
import { usePopularUsageSet } from "./usePopularUsageSet";

export function useCalculatorUsageItems(member: TeamMember | null, itemOptions: readonly ItemIndexEntry[], battleFormat: BattleFormat) {
  const usage = usePopularUsageSet(member?.id ?? null, battleFormat);
  return useMemo(() => usage ? resolveUsageCalculatorItems(usage, itemOptions) : [], [usage, itemOptions]);
}
