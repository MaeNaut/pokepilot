import { useEffect, useState } from "react";
import { loadPopularSmogonSet, type SmogonUsageSet } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";

export function usePopularUsageSet(pokemonId: string | null, battleFormat: BattleFormat) {
  const key = pokemonId ? `${battleFormat}:${pokemonId}` : null;
  const [state, setState] = useState<{ key: string; value: SmogonUsageSet | null } | null>(null);

  useEffect(() => {
    if (!pokemonId || !key) return;
    let current = true;
    void loadPopularSmogonSet(pokemonId, battleFormat)
      .then((value) => { if (current) setState({ key, value }); })
      .catch(() => { if (current) setState({ key, value: null }); });
    return () => { current = false; };
  }, [pokemonId, battleFormat, key]);

  return state?.key === key ? state.value : null;
}
