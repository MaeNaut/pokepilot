import { useCallback, useState } from "react";
import {
  APP_MODE_STORAGE_KEY,
  resolveAppMode,
  type AppMode,
} from "./appMode";

function getInitialAppMode() {
  try {
    return resolveAppMode(localStorage.getItem(APP_MODE_STORAGE_KEY));
  } catch {
    return resolveAppMode(null);
  }
}

export function useAppMode() {
  const [appMode, setAppModeState] = useState<AppMode>(getInitialAppMode);

  const setAppMode = useCallback((nextMode: AppMode) => {
    setAppModeState(nextMode);

    try {
      localStorage.setItem(APP_MODE_STORAGE_KEY, nextMode);
    } catch {
      // The in-memory mode still works when browser storage is unavailable.
    }
  }, []);

  return { appMode, setAppMode };
}
