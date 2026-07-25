import { useCallback, useState } from "react";
import {
  BATTLE_FORMAT_STORAGE_KEY,
  resolveBattleFormat,
  type BattleFormat,
} from "./battleFormat";

function getInitialBattleFormat() {
  try {
    return resolveBattleFormat(localStorage.getItem(BATTLE_FORMAT_STORAGE_KEY));
  } catch {
    return resolveBattleFormat(null);
  }
}

export function useBattleFormat() {
  const [battleFormat, setBattleFormatState] =
    useState<BattleFormat>(getInitialBattleFormat);

  const setBattleFormat = useCallback((nextFormat: BattleFormat) => {
    setBattleFormatState(nextFormat);

    try {
      localStorage.setItem(BATTLE_FORMAT_STORAGE_KEY, nextFormat);
    } catch {
      // The in-memory setting still works when browser storage is unavailable.
    }
  }, []);

  return { battleFormat, setBattleFormat };
}
