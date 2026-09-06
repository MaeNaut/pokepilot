import { useEffect, useMemo, useState } from "react";
import { loadPopularSmogonSet } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { resolveUsageCalculatorMoves } from "../calculator/calculatorUsageBuild";
import type { PokemonMove, TeamMember } from "../types";

type UsageMoveState = {
  key: string | null;
  moves: PokemonMove[];
};

export function useCalculatorUsageMoves(
  member: TeamMember | null,
  fallbackMoves: readonly PokemonMove[],
  battleFormat: BattleFormat,
) {
  const availableMoveKey = useMemo(
    () =>
      [...(member?.moves ?? []), ...fallbackMoves]
        .map((move) => move.id)
        .join("|"),
    [fallbackMoves, member?.moves],
  );
  const requestKey = member
    ? `${battleFormat}:${member.id}:${availableMoveKey}`
    : null;
  const [state, setState] = useState<UsageMoveState>({
    key: null,
    moves: [],
  });

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
          moves: usageSet
            ? resolveUsageCalculatorMoves(member, usageSet, fallbackMoves)
            : [],
        });
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, moves: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [battleFormat, fallbackMoves, member, requestKey]);

  return state.key === requestKey ? state.moves : [];
}
