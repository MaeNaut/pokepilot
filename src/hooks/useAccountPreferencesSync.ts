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
} from "../utils/accountPreferences";

type UseAccountPreferencesSyncOptions = {
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
    locale,
    themePreference,
    battleFormat,
    tutorialCompleted,
  }), [
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
    setLocale(preferences.locale);
    setThemePreference(preferences.themePreference);
    setBattleFormat(preferences.battleFormat);
    setTutorialCompleted(preferences.tutorialCompleted);
  }, [
    setBattleFormat,
    setLocale,
    setThemePreference,
    setTutorialCompleted,
  ]);

  useEffect(() => {
    lastSyncedPreferencesRef.current = null;

    if (!accountId) return;

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
  }, [accountId, applyPreferences]);

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
