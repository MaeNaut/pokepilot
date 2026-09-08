import { useEffect, useMemo, useState } from "react";
import { loadPopularSmogonSet } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { resolveUsageCalculatorItems } from "../calculator/calculatorUsageBuild";
import type { ItemIndexEntry, PokemonItem, TeamMember } from "../types";

type UsageItemState = {
  key: string | null;
  items: PokemonItem[];
};

export function useCalculatorUsageItems(
  member: TeamMember | null,
  itemOptions: readonly ItemIndexEntry[],
  battleFormat: BattleFormat,
) {
  const itemOptionKey = useMemo(
    () => itemOptions.map((item) => item.showdownId).join("|"),
    [itemOptions],
  );
  const requestKey = member
    ? `${battleFormat}:${member.id}:${itemOptionKey}`
    : null;
  const [state, setState] = useState<UsageItemState>({ key: null, items: [] });

  useEffect(() => {
    let cancelled = false;

    if (!member || !requestKey) {
      return () => {
        cancelled = true;
      };
    }

    void loadPopularSmogonSet(member.id, battleFormat)
      .then((usageSet) => {
        if (cancelled) return;
        setState({
          key: requestKey,
          items: usageSet
            ? resolveUsageCalculatorItems(usageSet, itemOptions)
            : [],
        });
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, items: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [battleFormat, itemOptions, member, requestKey]);

  return state.key === requestKey ? state.items : [];
}
