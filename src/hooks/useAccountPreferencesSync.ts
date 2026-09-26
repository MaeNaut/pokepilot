import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  readAccountPreferences,
  writeAccountPreferences,
} from "../api/accountStorage";
import { createAccountSyncSession, type AccountSyncSession } from "../utils/accountSyncSession";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { Locale } from "../i18n/gameTranslations";
import type { ThemePreference } from "../theme/theme";
import {
  areAccountPreferencesEqual,
  createDefaultAccountPreferences,
  getStoredAccountPreferencesOwnerId,
  mergeAccountPreferences,
  storeAccountPreferencesOwnerId,
  type AccountPreferences,
  type AnalysisPreference,
  DEFAULT_ANALYSIS_PREFERENCE,
} from "../utils/accountPreferences";

type UseAccountPreferencesSyncOptions = {
  analysis?: AnalysisPreference;
  setAnalysis?: (analysis: AnalysisPreference) => void;
  accountId: string | null;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  battleFormat: BattleFormat;
  setBattleFormat: (battleFormat: BattleFormat) => void;
  tutorialCompleted: boolean;
  setTutorialCompleted: (completed: boolean) => void;
};

export function useAccountPreferencesSync(
  options: UseAccountPreferencesSyncOptions,
) {
  const {
    analysis,
    setAnalysis,
    accountId,
    battleFormat,
    locale,
    setBattleFormat,
    setLocale,
    setThemePreference,
    setTutorialCompleted,
    themePreference,
    tutorialCompleted,
  } = options;
  const currentPreferences = useMemo(() => ({
    ...(analysis ? { analysis } : {}),
    locale,
    themePreference,
    battleFormat,
    tutorialCompleted,
  }), [
    analysis,
    battleFormat,
    locale,
    themePreference,
    tutorialCompleted,
  ]);
  const latestPreferencesRef = useRef(currentPreferences);
  const lastSyncedPreferencesRef = useRef<AccountPreferences | null>(null);
  const writer = useRef<AccountSyncSession<AccountPreferences> | null>(null);

  latestPreferencesRef.current = currentPreferences;

  const applyPreferences = useCallback((preferences: AccountPreferences) => {
    setAnalysis?.(preferences.analysis ?? DEFAULT_ANALYSIS_PREFERENCE);
    setLocale(preferences.locale);
    setThemePreference(preferences.themePreference);
    setBattleFormat(preferences.battleFormat);
    setTutorialCompleted(preferences.tutorialCompleted);
  }, [
    setAnalysis,
    setBattleFormat,
    setLocale,
    setThemePreference,
    setTutorialCompleted,
  ]);

  useEffect(() => {
    lastSyncedPreferencesRef.current = null;
    setAnalysis?.(DEFAULT_ANALYSIS_PREFERENCE);

    if (!accountId) {
      return;
    }

    const session = createAccountSyncSession(writeAccountPreferences);
    void (async () => {
      try {
        const remotePreferences = await readAccountPreferences(session.signal);
        if (session.signal.aborted) return;

        const ownerId = getStoredAccountPreferencesOwnerId();
        const localPreferences = ownerId === null || ownerId === accountId
          ? latestPreferencesRef.current
          : createDefaultAccountPreferences();
        const nextPreferences = mergeAccountPreferences(
          remotePreferences,
          localPreferences,
        );

        latestPreferencesRef.current = nextPreferences;
        lastSyncedPreferencesRef.current = nextPreferences;
        applyPreferences(nextPreferences);
        storeAccountPreferencesOwnerId(accountId);
        writer.current = session;

        if (
          remotePreferences === null ||
          !areAccountPreferencesEqual(remotePreferences, nextPreferences)
        ) {
          void session.write(nextPreferences);
        }
      } catch {
        // Browser settings remain usable when account storage is unavailable.
      }
    })();

    return () => {
      session.close();
      if (writer.current === session) writer.current = null;
    };
  }, [accountId, applyPreferences, setAnalysis]);

  useEffect(() => {
    if (!accountId || !writer.current) return;
    if (lastSyncedPreferencesRef.current && areAccountPreferencesEqual(
      lastSyncedPreferencesRef.current,
      currentPreferences,
    )) {
      return;
    }

    lastSyncedPreferencesRef.current = currentPreferences;
    void writer.current.write(currentPreferences);
  }, [accountId, currentPreferences]);
}
