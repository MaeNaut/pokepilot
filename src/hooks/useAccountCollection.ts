import { useCallback, useEffect, useRef, useState } from "react";
import { AccountStorageConflictError, type VersionedAccountStorage } from "../api/accountStorage";
import { createAccountSyncSession, type AccountSyncSession } from "../utils/accountSyncSession";
import type {
  PendingAccountCollection, StoredPendingAccountCollection,
} from "../utils/accountPendingStorage";
import {
  registerAccountCollectionSync,
  reportAccountCollectionSync,
} from "../utils/accountCollectionSyncStatus";
import { jsonValueEqual } from "../utils/jsonValueEqual";

type AccountCollectionStorage<T, C> = {
  pendingKey?: string;
  readLocal: () => T[];
  writeLocal: (value: T[]) => void;
  clearLocal: () => void;
  readOwner: () => string | null;
  writeOwner: (id: string) => void;
  readRemote: (signal?: AbortSignal, accountId?: string) => Promise<VersionedAccountStorage<T[]>>;
  writeRemote: (value: T[], version: string, signal?: AbortSignal, accountId?: string) => Promise<string>;
  readPending: () => PendingAccountCollection<T> | null;
  readPendings?: () => StoredPendingAccountCollection<T>[];
  writePending: (pending: PendingAccountCollection<T>) => void;
  clearPending: () => void;
  clearPendingEntries?: (records: StoredPendingAccountCollection<T>[]) => void;
  isManaged?: (accountId: string) => boolean;
  markManaged?: (accountId: string) => void;
  merge: (remote: T[], local: T[]) => T[];
  mergeAfterLocalEdits: (remote: T[], local: T[], baseline: T[]) => T[];
  reconcile?: (remote: T[], local: T[], baseline: T[]) => { merged: T[]; conflicts: C[] };
  reconcileLegacy?: (remote: T[], local: T[]) => { merged: T[]; conflicts: C[] };
  reconcileUnclaimed?: (remote: T[], local: T[]) => { merged: T[]; conflicts: C[] };
};

// Storage adapters are module-level constants so UI renders cannot restart hydration.
export function useAccountCollection<T, C = never>(
  accountId: string | null, storage: AccountCollectionStorage<T, C>, authResolved = true,
) {
  const [items, setItems] = useState(storage.readLocal);
  const current = useRef(items);
  const [hydratedAccountId, setHydratedAccountId] = useState<string | null>(null);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const previousAccountId = useRef(accountId);
  const writer = useRef<AccountSyncSession<T[]> | null>(null);
  const sessionRef = useRef<AccountSyncSession<T[]> | null>(null);
  const syncIssue = useRef(false);
  const unsynced = useRef(false);
  const writeVersion = useRef(0);
  const localEditVersion = useRef(0);
  const readBaseline = useRef<T[]>([]);
  const retryPromise = useRef<Promise<boolean> | null>(null);
  const retryRef = useRef<() => Promise<boolean>>(async () => false);
  const registryToken = useRef(Symbol("account-collection-sync"));
  const serverSnapshot = useRef<{ items: T[]; version: string } | null>(null);
  const pendingBaseline = useRef<T[] | null>(null);
  const replayedPendings = useRef<StoredPendingAccountCollection<T>[]>([]);
  const replayTimer = useRef<number | null>(null);
  const conflictPending = useRef(false);
  const [conflict, setConflict] = useState<{ merged: T[]; conflicts: C[] } | null>(null);
  const [hasLocalStorageError, setHasLocalStorageError] = useState(false);

  const reportSync = useCallback((issue: boolean, pending: boolean) => {
    syncIssue.current = issue;
    unsynced.current = pending;
    setHasUnsyncedChanges(pending);
    reportAccountCollectionSync(registryToken.current, issue, pending);
  }, []);

  const commitLocal = useCallback((next: T[]) => {
    try {
      storage.writeLocal(next);
      setHasLocalStorageError(false);
    } catch {
      setHasLocalStorageError(true);
    }
    current.current = next;
    setItems(next);
  }, [storage]);

  const readOwnerSafely = useCallback(() => {
    try { return storage.readOwner(); }
    catch { setHasLocalStorageError(true); return null; }
  }, [storage]);

  const writeOwnerSafely = useCallback((id: string) => {
    try { storage.writeOwner(id); }
    catch { setHasLocalStorageError(true); }
  }, [storage]);

  const persistPending = useCallback((next: T[], baseline: T[]) => {
    if (!accountId) return;
    try {
      storage.writePending({ accountId, items: next, baseline });
      pendingBaseline.current = baseline;
    } catch {
      setHasLocalStorageError(true);
    }
  }, [accountId, storage]);

  const settlePending = useCallback(() => {
    const synced = serverSnapshot.current?.items;
    if (!synced) return true;
    if (!jsonValueEqual(synced, current.current)) {
      persistPending(current.current, synced);
      return true;
    }
    try {
      if (accountId) storage.markManaged?.(accountId);
      if (storage.readPendings && storage.clearPendingEntries) {
        const matching = storage.readPendings().filter((pending) =>
          pending.accountId === accountId && jsonValueEqual(pending.items, synced));
        storage.clearPendingEntries([...replayedPendings.current, ...matching]);
        replayedPendings.current = [];
        pendingBaseline.current = null;
        return storage.readPending()?.accountId === accountId;
      } else {
        storage.clearPending();
      }
      pendingBaseline.current = null;
    } catch {
      setHasLocalStorageError(true);
      return true;
    }
    return false;
  }, [accountId, persistPending, storage]);

  const scheduleReplay = useCallback((session: AccountSyncSession<T[]>) => {
    if (replayTimer.current !== null) return;
    replayTimer.current = window.setTimeout(() => {
      replayTimer.current = null;
      if (sessionRef.current === session && !session.signal.aborted && !conflictPending.current) {
        void retryRef.current();
      }
    }, 0);
  }, []);

  const writeSnapshot = useCallback(async (session: AccountSyncSession<T[]>, next: T[]) => {
    const version = ++writeVersion.current;
    reportSync(syncIssue.current, true);
    const saved = await session.write(next);
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
  }, [reportSync, scheduleReplay, settlePending]);

  const commit = useCallback((next: T[]) => {
    if (!authResolved) return;
    commitLocal(next);
    if (!accountId) return;
    localEditVersion.current += 1;
    persistPending(next, pendingBaseline.current ?? serverSnapshot.current?.items ?? readBaseline.current);
    const session = writer.current;
    if (session) void writeSnapshot(session, next);
    else {
      writeVersion.current += 1;
      reportSync(syncIssue.current, true);
    }
  }, [accountId, authResolved, commitLocal, persistPending, reportSync, writeSnapshot]);

  const hydrateSnapshot = useCallback(async (
    session: AccountSyncSession<T[]>, snapshot: VersionedAccountStorage<T[]>,
    replayAllPendings = false,
  ) => {
    const remote = snapshot.value ?? [];
    // Other tabs' pending journals are recovery data, not live server state.
    const recovering = serverSnapshot.current === null || replayAllPendings;
    serverSnapshot.current = { items: remote, version: snapshot.version };
    const ownerId = readOwnerSafely();
    const pending = ownerId === accountId ? storage.readPending() : null;
    const storedPendings = recovering && ownerId === accountId
      ? storage.readPendings?.().filter((entry) => entry.accountId === accountId) ?? [] : [];
    replayedPendings.current = [];
    const pendings = storedPendings.length > 0 ? storedPendings : pending ? [pending] : [];
    const local = ownerId === null || ownerId === accountId ? current.current : [];
    const hasInSessionEdits = localEditVersion.current > 0 && ownerId === accountId;
    const legacy = ownerId === accountId && !hasInSessionEdits && pendings.length === 0 &&
      storage.isManaged && !storage.isManaged(accountId!) &&
      !jsonValueEqual(local, remote);
    const reconcileEdit = (there: T[], here: T[], before: T[]) =>
      storage.reconcile?.(there, here, before) ?? {
        merged: storage.mergeAfterLocalEdits(there, here, before), conflicts: [] as C[],
      };
    const reconcilePendings = () => {
      let merged = remote;
      const conflicts: C[] = [];
      for (let index = 0; index < pendings.length; index += 1) {
        const entry = pendings[index];
        const result = reconcileEdit(merged, entry.items, entry.baseline);
        merged = result.merged;
        conflicts.push(...result.conflicts);
        if (storedPendings[index]) replayedPendings.current.push(storedPendings[index]);
        if (result.conflicts.length > 0) break;
      }
      if (conflicts.length === 0 && hasInSessionEdits && unsynced.current &&
          !pendings.some((entry) => jsonValueEqual(entry.items, local))) {
        const result = reconcileEdit(merged, local, readBaseline.current);
        merged = result.merged;
        conflicts.push(...result.conflicts);
      }
      return { merged, conflicts };
    };
    const reconciled = ownerId === accountId && (hasInSessionEdits || pendings.length > 0)
      ? reconcilePendings()
      : legacy && storage.reconcileLegacy
        ? storage.reconcileLegacy(remote, local)
        : ownerId === null && storage.reconcileUnclaimed
          ? storage.reconcileUnclaimed(remote, local)
          : { merged: ownerId === null ? storage.merge(remote, local) : remote, conflicts: [] as C[] };
    writer.current = session;
    writeOwnerSafely(accountId!);
    if (reconciled.conflicts.length > 0) {
      conflictPending.current = true;
      setConflict(reconciled);
      reportSync(true, true);
      return false;
    }
    commitLocal(reconciled.merged);
    if (snapshot.value !== null && jsonValueEqual(remote, reconciled.merged)) {
      const outstanding = settlePending();
      reportSync(false, outstanding);
      if (outstanding) scheduleReplay(session);
      return true;
    }
    persistPending(reconciled.merged, remote);
    return writeSnapshot(session, reconciled.merged);
  }, [accountId, commitLocal, persistPending, readOwnerSafely, reportSync, scheduleReplay,
    settlePending, storage, writeOwnerSafely, writeSnapshot]);

  const resolveConflict = useCallback(async (next: T[]) => {
    if (!accountId || !conflictPending.current) return false;
    commitLocal(next);
    persistPending(next, serverSnapshot.current?.items ?? []);
    conflictPending.current = false;
    setConflict(null);
    const session = writer.current;
    if (!session) return false;
    const saved = await writeSnapshot(session, next);
    if (!saved || !storage.readPendings?.().some((entry) => entry.accountId === accountId)) return saved;
    try {
      const snapshot = await storage.readRemote(session.signal, accountId);
      if (!session.signal.aborted) await hydrateSnapshot(session, snapshot, true);
    } catch {
      if (!session.signal.aborted) reportSync(true, true);
    }
    return saved;
  }, [accountId, commitLocal, hydrateSnapshot, persistPending, reportSync, storage, writeSnapshot]);

  const retrySync = useCallback((): Promise<boolean> => {
    if (retryPromise.current) return retryPromise.current;
    const attempt = async () => {
      const session = sessionRef.current;
      if (!accountId || !session || session.signal.aborted) return false;
      if (conflictPending.current) return false;

      try {
        const snapshot = await storage.readRemote(session.signal, accountId);
        if (session.signal.aborted) return false;
        return hydrateSnapshot(session, snapshot);
      } catch {
        if (!session.signal.aborted) reportSync(true, unsynced.current);
        return false;
      }
    };
    const pending = attempt().finally(() => {
      if (retryPromise.current === pending) retryPromise.current = null;
    });
    retryPromise.current = pending;
    return pending;
  }, [accountId, hydrateSnapshot, reportSync, storage]);
  retryRef.current = retrySync;

  useEffect(() => {
    if (!authResolved) return;
    const owner = readOwnerSafely();
    if ((previousAccountId.current && previousAccountId.current !== accountId) ||
        (accountId && owner && owner !== accountId) ||
        (!accountId && owner)) {
      try { storage.clearLocal(); } catch { setHasLocalStorageError(true); }
      current.current = [];
      setItems([]);
    }
    previousAccountId.current = accountId;
    readBaseline.current = current.current;
    localEditVersion.current = 0;
    try {
      const pending = storage.readPending();
      pendingBaseline.current = pending?.accountId === accountId ? pending.baseline : null;
    } catch {
      pendingBaseline.current = null;
      setHasLocalStorageError(true);
    }
    serverSnapshot.current = null;
    replayedPendings.current = [];
    conflictPending.current = false;
    setConflict(null);
    setHydratedAccountId(null);
    reportSync(false, false);
    if (!accountId) return;

    const session = createAccountSyncSession<T[]>(async (_queued, signal) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (conflictPending.current || signal.aborted) throw new Error("ACCOUNT_STORAGE_PENDING");
        const previous = serverSnapshot.current;
        if (!previous) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
        const next = current.current;
        if (jsonValueEqual(previous.items, next)) return;
        try {
          const version = await storage.writeRemote(next, previous.version, signal, accountId);
          if (!signal.aborted) serverSnapshot.current = { items: next, version };
          return;
        } catch (error) {
          if (!(error instanceof AccountStorageConflictError)) throw error;
          const fresh = await storage.readRemote(signal, accountId);
          if (signal.aborted) return;
          const remote = fresh.value ?? [];
          const local = current.current;
          const reconciled = storage.reconcile?.(remote, local, previous.items) ?? {
            merged: storage.mergeAfterLocalEdits(remote, local, previous.items),
            conflicts: [] as C[],
          };
          serverSnapshot.current = { items: remote, version: fresh.version };
          if (reconciled.conflicts.length > 0) {
            conflictPending.current = true;
            setConflict(reconciled);
            throw error;
          }
          commitLocal(reconciled.merged);
          persistPending(reconciled.merged, remote);
        }
      }
      throw new Error("ACCOUNT_STORAGE_CONFLICT_RETRY_EXHAUSTED");
    });
    sessionRef.current = session;
    const unregister = registerAccountCollectionSync(registryToken.current, () => retryRef.current());
    reportSync(false, current.current.length > 0);
    const retryOnReconnect = () => { void retryRef.current(); };
    const retryOnPendingChange = (event: StorageEvent) => {
      if (event.newValue === null && storage.pendingKey && (event.key === storage.pendingKey ||
          event.key?.startsWith(`${storage.pendingKey}:`))) void retryRef.current();
    };
    window.addEventListener("online", retryOnReconnect);
    window.addEventListener("focus", retryOnReconnect);
    window.addEventListener("storage", retryOnPendingChange);
    void retryRef.current().finally(() => {
      if (!session.signal.aborted) setHydratedAccountId(accountId);
    });

    return () => {
      window.removeEventListener("online", retryOnReconnect);
      window.removeEventListener("focus", retryOnReconnect);
      window.removeEventListener("storage", retryOnPendingChange);
      unregister();
      session.close();
      if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
      replayTimer.current = null;
      retryPromise.current = null;
      if (sessionRef.current === session) sessionRef.current = null;
      if (writer.current === session) writer.current = null;
    };
  }, [accountId, authResolved, commitLocal, persistPending, readOwnerSafely, reportSync, storage]);

  let showItems = authResolved;
  if (showItems) {
    try {
      const owner = storage.readOwner();
      if (owner && owner !== accountId) showItems = false;
    } catch {
      showItems = false;
    }
  }
  return { items: showItems ? items : [], current, commit, retrySync, resolveConflict, conflict, hasUnsyncedChanges,
    hasLocalStorageError,
    isHydrated: showItems && accountId === hydratedAccountId };
}
