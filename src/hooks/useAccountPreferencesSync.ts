import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  readAccountPreferences,
  writeAccountPreferences,
} from "../api/accountStorage";
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
  const accountIdRef = useRef(accountId);
  const latestPreferencesRef = useRef(currentPreferences);
  const syncReadyRef = useRef(false);
  const lastSyncedPreferencesRef = useRef<AccountPreferences | null>(null);
  const writeQueueRef = useRef(Promise.resolve());

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

  const queueAccountWrite = useCallback((
    preferences: AccountPreferences,
    targetAccountId = accountIdRef.current,
  ) => {
    if (
      !targetAccountId ||
      !syncReadyRef.current ||
      accountIdRef.current !== targetAccountId
    ) {
      return;
    }

    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (accountIdRef.current !== targetAccountId) return;
        await writeAccountPreferences(preferences);
      });
  }, []);

  useEffect(() => {
    accountIdRef.current = accountId;
    syncReadyRef.current = false;
    lastSyncedPreferencesRef.current = null;

    if (!accountId) return;

    let active = true;
    void (async () => {
      try {
        const remotePreferences = await readAccountPreferences();
        if (!active || accountIdRef.current !== accountId) return;

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
        syncReadyRef.current = true;

        if (
          remotePreferences === null ||
          !areAccountPreferencesEqual(remotePreferences, nextPreferences)
        ) {
          queueAccountWrite(nextPreferences, accountId);
        }
      } catch {
        // Browser settings remain usable when account storage is unavailable.
      }
    })();

    return () => {
      active = false;
    };
  }, [accountId, applyPreferences, queueAccountWrite]);

  useEffect(() => {
    if (!accountId || !syncReadyRef.current) return;
    if (lastSyncedPreferencesRef.current && areAccountPreferencesEqual(
      lastSyncedPreferencesRef.current,
      currentPreferences,
    )) {
      return;
    }

    lastSyncedPreferencesRef.current = currentPreferences;
    queueAccountWrite(currentPreferences, accountId);
  }, [accountId, currentPreferences, queueAccountWrite]);
}
