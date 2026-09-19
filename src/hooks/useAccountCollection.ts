import { useCallback, useEffect, useRef, useState } from "react";
import { createAccountSyncSession, type AccountSyncSession } from "../utils/accountSyncSession";

type AccountCollectionStorage<T> = {
  readLocal: () => T[];
  writeLocal: (value: T[]) => void;
  clearLocal: () => void;
  readOwner: () => string | null;
  writeOwner: (id: string) => void;
  readRemote: (signal?: AbortSignal) => Promise<T[] | null>;
  writeRemote: (value: T[], signal?: AbortSignal) => Promise<void>;
  merge: (remote: T[], local: T[]) => T[];
};

// Storage adapters are module-level constants so UI renders cannot restart hydration.
export function useAccountCollection<T>(accountId: string | null, storage: AccountCollectionStorage<T>) {
  const [items, setItems] = useState(storage.readLocal);
  const current = useRef(items);
  const [hydratedAccountId, setHydratedAccountId] = useState<string | null>(null);
  const previousAccountId = useRef(accountId);
  const writer = useRef<AccountSyncSession<T[]> | null>(null);

  const commitLocal = useCallback((next: T[]) => {
    storage.writeLocal(next);
    current.current = next;
    setItems(next);
  }, [storage]);

  const commit = useCallback((next: T[]) => {
    commitLocal(next);
    void writer.current?.write(next);
  }, [commitLocal]);

  useEffect(() => {
    const owner = storage.readOwner();
    if ((previousAccountId.current && previousAccountId.current !== accountId) ||
        (accountId && owner && owner !== accountId)) {
      storage.clearLocal();
      current.current = [];
      setItems([]);
    }
    previousAccountId.current = accountId;
    setHydratedAccountId(null);
    if (!accountId) return;

    const session = createAccountSyncSession(storage.writeRemote);
    void (async () => {
      try {
        const remote = await storage.readRemote(session.signal);
        if (session.signal.aborted) return;
        const ownerId = storage.readOwner();
        const local = ownerId === null || ownerId === accountId ? current.current : [];
        const next = storage.merge(remote ?? [], local);
        commitLocal(next);
        storage.writeOwner(accountId);
        writer.current = session;
        if (remote === null || JSON.stringify(remote) !== JSON.stringify(next)) {
          void session.write(next);
        }
      } catch {
        // A failed read must not upload local data over an unknown remote library.
      } finally {
        if (!session.signal.aborted) setHydratedAccountId(accountId);
      }
    })();

    return () => {
      session.close();
      if (writer.current === session) writer.current = null;
    };
  }, [accountId, commitLocal, storage]);

  return { items, current, commit, isHydrated: accountId === hydratedAccountId };
}
