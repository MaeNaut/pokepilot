export type AppMode = "builder" | "calculator";

export const DEFAULT_APP_MODE: AppMode = "builder";
export const APP_MODE_STORAGE_KEY = "pokepilot:app-mode";

export function isAppMode(value: string | null): value is AppMode {
  return value === "builder" || value === "calculator";
}

export function resolveAppMode(value: string | null | undefined): AppMode {
  const normalizedValue = value ?? null;

  return isAppMode(normalizedValue)
    ? normalizedValue
    : DEFAULT_APP_MODE;
}
