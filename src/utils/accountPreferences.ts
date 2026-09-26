import {
  isBattleFormat,
  type BattleFormat,
} from "../battleFormat/battleFormat";
import type { Locale } from "../i18n/gameTranslations";
import type { CopilotAnalysisScope } from "./copilotContracts";

export type AnalysisPreference = {
  scope: CopilotAnalysisScope;
  modelId: "gpt-6-luna" | "gpt-6-sol";
  reasoningEffort: "low" | "medium";
};

export const DEFAULT_ANALYSIS_PREFERENCE: AnalysisPreference = {
  scope: "pokemon", modelId: "gpt-6-luna", reasoningEffort: "low",
};

export function isAnalysisPreference(value: unknown): value is AnalysisPreference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return Object.keys(p).every((key) => ["scope", "modelId", "reasoningEffort"].includes(key)) &&
    ["pokemon", "team", "recommendation", "optimization"].includes(p.scope as string) &&
    (p.modelId === "gpt-6-luna" || p.modelId === "gpt-6-sol") &&
    (p.reasoningEffort === "low" || (p.reasoningEffort === "medium" && p.modelId === "gpt-6-luna"));
}
import {
  isThemePreference,
  type ThemePreference,
} from "../theme/theme";

export type AccountPreferences = {
  analysis?: AnalysisPreference;
  locale: Locale;
  themePreference: ThemePreference;
  battleFormat: BattleFormat;
  tutorialCompleted: boolean;
};

export const ACCOUNT_PREFERENCES_OWNER_STORAGE_KEY =
  "pokepilot.account-preferences.owner.v1";

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ko";
}

export function createDefaultAccountPreferences(): AccountPreferences {
  const locale = typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("ko")
    ? "ko"
    : "en";

  return {
    locale,
    themePreference: "system",
    battleFormat: "singles",
    tutorialCompleted: false,
  };
}

export function normalizeAccountPreferences(
  value: unknown,
): AccountPreferences | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const preferences = value as Record<string, unknown>;
  if (
    !isLocale(preferences.locale) ||
    typeof preferences.themePreference !== "string" ||
    !isThemePreference(preferences.themePreference) ||
    typeof preferences.battleFormat !== "string" ||
    !isBattleFormat(preferences.battleFormat) ||
    (preferences.analysis !== undefined && !isAnalysisPreference(preferences.analysis)) ||
    typeof preferences.tutorialCompleted !== "boolean"
  ) {
    return null;
  }

  return {
    locale: preferences.locale,
    themePreference: preferences.themePreference,
    battleFormat: preferences.battleFormat,
    tutorialCompleted: preferences.tutorialCompleted,
    ...(isAnalysisPreference(preferences.analysis) ? { analysis: preferences.analysis } : {}),
  };
}

export function mergeAccountPreferences(
  remotePreferences: AccountPreferences | null,
  localPreferences: AccountPreferences,
) {
  if (!remotePreferences) return localPreferences;

  return {
    ...remotePreferences,
    // Once a signed-in visitor has completed the introduction, do not make it
    // reappear because another device has not uploaded that completion yet.
    tutorialCompleted:
      remotePreferences.tutorialCompleted || localPreferences.tutorialCompleted,
  };
}

export function areAccountPreferencesEqual(
  left: AccountPreferences,
  right: AccountPreferences,
) {
  return left.locale === right.locale &&
    left.analysis?.scope === right.analysis?.scope &&
    left.analysis?.modelId === right.analysis?.modelId &&
    left.analysis?.reasoningEffort === right.analysis?.reasoningEffort &&
    left.themePreference === right.themePreference &&
    left.battleFormat === right.battleFormat &&
    left.tutorialCompleted === right.tutorialCompleted;
}

export function getStoredAccountPreferencesOwnerId() {
  try {
    return localStorage.getItem(ACCOUNT_PREFERENCES_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAccountPreferencesOwnerId(accountId: string) {
  try {
    localStorage.setItem(ACCOUNT_PREFERENCES_OWNER_STORAGE_KEY, accountId);
  } catch {
    // Settings still remain available for this browser session.
  }
}
