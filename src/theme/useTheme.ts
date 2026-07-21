import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  resolveTheme,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from "./theme";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

function getInitialThemePreference(): ThemePreference {
  let storedPreference: string | null = null;

  try {
    storedPreference = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // The system preference remains the in-memory default.
  }

  return resolveThemePreference(storedPreference);
}

function getSystemTheme(): Theme {
  return window.matchMedia?.(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
}

export function useTheme() {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(getInitialThemePreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const theme = useMemo(
    () => resolveTheme(themePreference, systemTheme === "dark"),
    [systemTheme, themePreference],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(SYSTEM_DARK_QUERY);

    if (!mediaQuery) {
      return undefined;
    }

    function handleSystemThemeChange(event: MediaQueryListEvent) {
      setSystemTheme(event.matches ? "dark" : "light");
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The in-memory preference still works for this session.
    }
  }, []);

  return { theme, themePreference, setThemePreference };
}
