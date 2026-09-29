import {
  isBattleFormat,
  type BattleFormat,
} from "../battleFormat/battleFormat";
import type { Locale } from "../i18n/gameTranslations";
import type { CopilotAnalysisScope } from "./copilotContracts";
import { jsonValueEqual } from "./jsonValueEqual";

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
export const ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY = "pokepilot.account-preferences.pending.v1";
let ownPendingKey: string | null = null;

function getOwnPendingKey() {
  ownPendingKey ??= `${ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY}:${
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
  return ownPendingKey;
}

export type PendingAccountPreferences = {
  accountId: string;
  baseline: AccountPreferences | null;
  value: AccountPreferences;
};

export type StoredPendingAccountPreferences = PendingAccountPreferences & {
  storageKey: string;
  serialized: string;
  updatedAt: number;
};

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
    ...(isAnalysisPreference(preferences.analysis) ? { analysis: {
      ...preferences.analysis,
      // Retired model selections must not discard the user's other preferences.
      modelId: "gpt-6-luna" as const,
    } } : {}),
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

export function reconcileAccountPreferences(
  remote: AccountPreferences | null,
  local: AccountPreferences,
  baseline: AccountPreferences | null,
): AccountPreferences {
  const before = baseline ?? createDefaultAccountPreferences();
  const there = remote ?? createDefaultAccountPreferences();
  const choose = <K extends keyof AccountPreferences>(key: K): AccountPreferences[K] =>
    jsonValueEqual(local[key], before[key]) ? there[key] : local[key];
  return {
    locale: choose("locale"),
    themePreference: choose("themePreference"),
    battleFormat: choose("battleFormat"),
    analysis: choose("analysis"),
    tutorialCompleted: local.tutorialCompleted || there.tutorialCompleted,
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

function parsePendingAccountPreferences(
  storageKey: string, raw: string,
): StoredPendingAccountPreferences | null {
  const pending: unknown = JSON.parse(raw);
  if (!pending || typeof pending !== "object") return null;
  const record = pending as Record<string, unknown>;
  const value = normalizeAccountPreferences(record.value);
  const baseline = record.baseline === null ? null : normalizeAccountPreferences(record.baseline);
  if (typeof record.accountId !== "string" || !value ||
      (record.baseline !== null && !baseline)) return null;
  return {
    accountId: record.accountId, baseline, value, storageKey, serialized: raw,
    updatedAt: typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
      ? record.updatedAt : 0,
  };
}

export function getAllPendingAccountPreferences(): StoredPendingAccountPreferences[] {
  const records: StoredPendingAccountPreferences[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (storageKey !== ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY &&
          !storageKey?.startsWith(`${ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY}:`)) continue;
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const record = parsePendingAccountPreferences(storageKey, raw);
        if (record) records.push(record);
      } catch {
        // One damaged tab record must not conceal edits from another tab.
      }
    }
  } catch {
    return records;
  }
  return records.sort((left, right) =>
    left.updatedAt - right.updatedAt || left.storageKey.localeCompare(right.storageKey));
}

export function getPendingAccountPreferences(): PendingAccountPreferences | null {
  const records = getAllPendingAccountPreferences();
  const record = records.find(({ storageKey }) => storageKey === getOwnPendingKey()) ??
    records.find(({ storageKey }) =>
      storageKey === ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY);
  return record ? { accountId: record.accountId, baseline: record.baseline, value: record.value } : null;
}

export function storePendingAccountPreferences(pending: PendingAccountPreferences) {
  localStorage.setItem(getOwnPendingKey(), JSON.stringify({ ...pending, updatedAt: Date.now() }));
}

export function clearConsumedPendingAccountPreferences(records: StoredPendingAccountPreferences[]) {
  for (const { storageKey, serialized } of records) {
    if (localStorage.getItem(storageKey) === serialized) localStorage.removeItem(storageKey);
  }
}

export function clearPendingAccountPreferences(accountId?: string) {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (storageKey === ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY ||
        storageKey?.startsWith(`${ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY}:`)) keys.push(storageKey);
  }
  for (const storageKey of keys) {
    const serialized = localStorage.getItem(storageKey);
    if (!serialized) continue;
    if (accountId) {
      try {
        const record = parsePendingAccountPreferences(storageKey, serialized);
        if (record && record.accountId !== accountId) continue;
      } catch {
        // A malformed record has no reliable owner, so clear it on logout.
      }
    }
    if (localStorage.getItem(storageKey) === serialized) localStorage.removeItem(storageKey);
  }
}
