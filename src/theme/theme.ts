export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export const THEME_STORAGE_KEY = "pokepilot:theme";
const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function isThemePreference(
  value: string | null,
): value is ThemePreference {
  return value === "system" || isTheme(value);
}

export function resolveThemePreference(
  storedPreference: string | null,
): ThemePreference {
  return isThemePreference(storedPreference)
    ? storedPreference
    : DEFAULT_THEME_PREFERENCE;
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): Theme {
  if (isTheme(preference)) {
    return preference;
  }

  return prefersDark ? "dark" : "light";
}
