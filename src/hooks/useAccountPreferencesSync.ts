import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AccountStorageConflictError,
  readAccountPreferences,
  writeAccountPreferences,
} from "../api/accountStorage";
import { createAccountSyncSession, type AccountSyncSession } from "../utils/accountSyncSession";
import { registerAccountCollectionSync, reportAccountCollectionSync } from "../utils/accountCollectionSyncStatus";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { Locale } from "../i18n/gameTranslations";
import type { ThemePreference } from "../theme/theme";
import {
  areAccountPreferencesEqual,
  ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY,
  clearConsumedPendingAccountPreferences,
  clearPendingAccountPreferences,
  createDefaultAccountPreferences,
  getAllPendingAccountPreferences,
  getPendingAccountPreferences,
  getStoredAccountPreferencesOwnerId,
  mergeAccountPreferences,
  reconcileAccountPreferences,
  storeAccountPreferencesOwnerId,
  storePendingAccountPreferences,
  type AccountPreferences,
  type AnalysisPreference,
  type StoredPendingAccountPreferences,
  DEFAULT_ANALYSIS_PREFERENCE,
} from "../utils/accountPreferences";

type UseAccountPreferencesSyncOptions = {
  analysis?: AnalysisPreference;
  setAnalysis?: (analysis: AnalysisPreference) => void;
  accountId: string | null;
  authResolved?: boolean;
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
    authResolved = true,
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
  const sessionRef = useRef<AccountSyncSession<AccountPreferences> | null>(null);
  const serverSnapshot = useRef<{ value: AccountPreferences | null; version: string } | null>(null);
  const readBaselineRef = useRef<AccountPreferences>(currentPreferences);
  const pendingBaselineRef = useRef<AccountPreferences | null | undefined>(undefined);
  const replayedPendingsRef = useRef<StoredPendingAccountPreferences[]>([]);
  const replayTimerRef = useRef<number | null>(null);
  const retryRef = useRef<() => Promise<boolean>>(async () => false);
  const previousAccountId = useRef(accountId);
  const writeVersion = useRef(0);
  const syncIssue = useRef(false);
  const registryToken = useRef(Symbol("account-preferences-sync"));

  latestPreferencesRef.current = currentPreferences;

  const reportSync = useCallback((issue: boolean, pending: boolean) => {
    syncIssue.current = issue;
    reportAccountCollectionSync(registryToken.current, issue, pending);
  }, []);

  const persistPending = useCallback((value: AccountPreferences, baseline: AccountPreferences | null) => {
    if (!accountId) return;
    try {
      storePendingAccountPreferences({ accountId, baseline, value });
      pendingBaselineRef.current = baseline;
    } catch {
      reportSync(true, true);
    }
  }, [accountId, reportSync]);

  const settlePending = useCallback(() => {
    const synced = serverSnapshot.current?.value;
    if (!synced) return true;
    if (!areAccountPreferencesEqual(synced, latestPreferencesRef.current)) {
      persistPending(latestPreferencesRef.current, synced);
      return true;
    }
    try {
      const matching = getAllPendingAccountPreferences().filter((record) =>
        record.accountId === accountId && areAccountPreferencesEqual(record.value, synced));
      clearConsumedPendingAccountPreferences([...replayedPendingsRef.current, ...matching]);
      replayedPendingsRef.current = [];
      pendingBaselineRef.current = undefined;
      return getAllPendingAccountPreferences().some((record) => record.accountId === accountId);
    } catch {
      reportSync(true, true);
      return true;
    }
  }, [accountId, persistPending, reportSync]);

  const scheduleReplay = useCallback((session: AccountSyncSession<AccountPreferences>) => {
    if (replayTimerRef.current !== null) return;
    replayTimerRef.current = window.setTimeout(() => {
      replayTimerRef.current = null;
      if (sessionRef.current === session && !session.signal.aborted) {
        void retryRef.current();
      }
    }, 0);
  }, []);

  const writeLatest = useCallback(async (session: AccountSyncSession<AccountPreferences>) => {
    const version = ++writeVersion.current;
    persistPending(latestPreferencesRef.current,
      pendingBaselineRef.current !== undefined
        ? pendingBaselineRef.current
        : serverSnapshot.current?.value ?? readBaselineRef.current);
    reportSync(syncIssue.current, true);
    const saved = await session.write(latestPreferencesRef.current);
    if (sessionRef.current !== session || session.signal.aborted) return false;
    if (!saved) reportSync(true, true);
    else {
      const outstanding = settlePending();
      if (version === writeVersion.current) {
        reportSync(false, outstanding);
        if (outstanding) scheduleReplay(session);
      }
    }
    return saved;
  }, [persistPending, reportSync, scheduleReplay, settlePending]);

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
    if (!authResolved) return;
    lastSyncedPreferencesRef.current = null;
    serverSnapshot.current = null;
    replayedPendingsRef.current = [];
    const storedPending = getPendingAccountPreferences();
    const discardPending = Boolean(
      (previousAccountId.current && previousAccountId.current !== accountId) ||
      (!accountId && storedPending),
    );
    if (discardPending) {
      try { clearPendingAccountPreferences(previousAccountId.current ?? storedPending?.accountId); }
      catch { reportSync(true, true); }
    }
    previousAccountId.current = accountId;
    const pending = !discardPending && storedPending?.accountId === accountId ? storedPending : null;
    const readBaseline = pending?.baseline ?? {
      ...latestPreferencesRef.current, analysis: DEFAULT_ANALYSIS_PREFERENCE,
    };
    readBaselineRef.current = readBaseline;
    pendingBaselineRef.current = pending?.baseline;
    latestPreferencesRef.current = pending?.value ?? readBaseline;
    if (pending) applyPreferences(pending.value);
    else setAnalysis?.(DEFAULT_ANALYSIS_PREFERENCE);

    if (!accountId) {
      return;
    }

    const session = createAccountSyncSession<AccountPreferences>(async (_queued, signal) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const previous = serverSnapshot.current;
        if (!previous || signal.aborted) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
        const next = latestPreferencesRef.current;
        if (previous.value && areAccountPreferencesEqual(previous.value, next)) return;
        try {
          const version = await writeAccountPreferences(next, previous.version, signal, accountId);
          if (!signal.aborted) serverSnapshot.current = { value: next, version };
          return;
        } catch (error) {
          if (!(error instanceof AccountStorageConflictError)) throw error;
          const fresh = await readAccountPreferences(signal, accountId);
          if (signal.aborted) return;
          const reconciled = reconcileAccountPreferences(
            fresh.value, latestPreferencesRef.current, previous.value,
          );
          serverSnapshot.current = fresh;
          latestPreferencesRef.current = reconciled;
          lastSyncedPreferencesRef.current = reconciled;
          persistPending(reconciled, fresh.value);
          applyPreferences(reconciled);
        }
      }
      throw new Error("ACCOUNT_STORAGE_CONFLICT_RETRY_EXHAUSTED");
    });
    sessionRef.current = session;
    const unregister = registerAccountCollectionSync(registryToken.current, () => retry());
    reportSync(false, true);
    let reading: Promise<boolean> | null = null;
    const read = (): Promise<boolean> => {
      if (reading) return reading;
      const attempt = async () => {
        try {
          const snapshot = await readAccountPreferences(session.signal, accountId);
          if (session.signal.aborted) return false;
          const remotePreferences = snapshot.value;
          serverSnapshot.current = snapshot;

          const ownerId = getStoredAccountPreferencesOwnerId();
          const localPreferences = ownerId === null || ownerId === accountId
            ? readBaseline : createDefaultAccountPreferences();
          const pendings = getAllPendingAccountPreferences().filter((record) =>
            record.accountId === accountId);
          const baseline = lastSyncedPreferencesRef.current ?? readBaseline;
          let nextPreferences = mergeAccountPreferences(remotePreferences, localPreferences);
          for (const entry of pendings) {
            nextPreferences = reconcileAccountPreferences(nextPreferences, entry.value, entry.baseline);
          }
          if (!pendings.some((entry) =>
            areAccountPreferencesEqual(entry.value, latestPreferencesRef.current)) &&
              !areAccountPreferencesEqual(latestPreferencesRef.current, baseline)) {
            nextPreferences = reconcileAccountPreferences(
              nextPreferences, latestPreferencesRef.current, baseline,
            );
          }
          replayedPendingsRef.current = pendings;

          latestPreferencesRef.current = nextPreferences;
          lastSyncedPreferencesRef.current = nextPreferences;
          applyPreferences(nextPreferences);
          storeAccountPreferencesOwnerId(accountId);
          writer.current = session;

          if (remotePreferences === null || !areAccountPreferencesEqual(remotePreferences, nextPreferences)) {
            persistPending(nextPreferences, remotePreferences);
            return writeLatest(session);
          }
          const outstanding = settlePending();
          reportSync(false, outstanding);
          if (outstanding) scheduleReplay(session);
          return true;
        } catch {
          if (!session.signal.aborted) reportSync(true, true);
          return false;
        }
      };
      reading = attempt().finally(() => { reading = null; });
      return reading;
    };
    const retry = () => read();
    retryRef.current = retry;
    const retryOnReconnect = () => { void retry(); };
    const retryOnPendingChange = (event: StorageEvent) => {
      if (event.key === ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY ||
          event.key?.startsWith(`${ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY}:`)) void retry();
    };
    window.addEventListener("online", retryOnReconnect);
    window.addEventListener("focus", retryOnReconnect);
    window.addEventListener("storage", retryOnPendingChange);
    void read();

    return () => {
      window.removeEventListener("online", retryOnReconnect);
      window.removeEventListener("focus", retryOnReconnect);
      window.removeEventListener("storage", retryOnPendingChange);
      unregister();
      session.close();
      if (replayTimerRef.current !== null) window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
      if (sessionRef.current === session) sessionRef.current = null;
      if (writer.current === session) writer.current = null;
    };
  }, [accountId, authResolved, applyPreferences, persistPending, reportSync, scheduleReplay,
    setAnalysis, settlePending, writeLatest]);

  useEffect(() => {
    if (!accountId) return;
    if (!writer.current) {
      if (!areAccountPreferencesEqual(currentPreferences, readBaselineRef.current)) {
        persistPending(currentPreferences,
          pendingBaselineRef.current !== undefined
            ? pendingBaselineRef.current : readBaselineRef.current);
      }
      return;
    }
    if (lastSyncedPreferencesRef.current && areAccountPreferencesEqual(
      lastSyncedPreferencesRef.current,
      currentPreferences,
    )) {
      return;
    }

    lastSyncedPreferencesRef.current = currentPreferences;
    void writeLatest(writer.current);
  }, [accountId, currentPreferences, persistPending, writeLatest]);

  useEffect(() => {
    const previousId = previousAccountId.current;
    if (authResolved || accountId || !previousId) return;
    const stored = getPendingAccountPreferences();
    const pending = stored?.accountId === previousId ? stored : null;
    const baseline = pending?.baseline ?? serverSnapshot.current?.value ?? readBaselineRef.current;
    if (areAccountPreferencesEqual(currentPreferences, pending?.value ?? baseline)) return;
    try {
      storePendingAccountPreferences({ accountId: previousId, baseline, value: currentPreferences });
      pendingBaselineRef.current = baseline;
    } catch {
      reportSync(true, true);
    }
  }, [accountId, authResolved, currentPreferences, reportSync]);
}
