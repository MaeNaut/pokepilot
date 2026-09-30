import { useCallback, useEffect, useRef, useState } from "react";
import { readTeamLibrary, saveLibraryTeam, deleteLibraryTeam, orderLibraryTeams, TeamLibraryChanged } from "../api/teamLibrary";
import { registerAccountCollectionSync, reportAccountCollectionSync } from "../utils/accountCollectionSyncStatus";
import { canAddSavedTeam } from "../data/teamLimits";
import { swapArrayItems } from "../utils/reorder";
import { copySavedTeam, createSavedTeam, renameSavedTeam } from "../utils/savedTeamLibrary";
import { jsonValueEqual } from "../utils/jsonValueEqual";
import { clearStoredTeams, getStoredTeamsAccountId, getStoredTeams, storeSavedTeamsAccountId,
  storeTeams, normalizeSavedTeams, type SavedTeamSummary, type TeamSnapshot } from "../utils/teamStorage";

const notificationKey = "pokepilot.team-library.commit.v2";
const guestBackupKey = "pokepilot.guest-teams.v2";
type Session = { accountId: string; controller: AbortController; ready: boolean };
export type TeamRefreshMode = "refresh" | "save-draft" | "discard-draft";

export function teamRefreshMode(current: SavedTeamSummary[], remote: SavedTeamSummary[], activeId: string | null, dirty: boolean): TeamRefreshMode {
  if (!dirty) return "refresh";
  const before = current.find(t => t.id === activeId);
  const after = remote.find(t => t.id === activeId);
  return activeId && (!after || before?.revision !== after.revision) ? "discard-draft" : "save-draft";
}

export function useSavedTeams(accountId: string | null, authResolved = true) {
  const [teams, setTeams] = useState(getStoredTeams);
  const current = useRef(teams);
  const [pendingUpdate, setPendingUpdate] = useState<SavedTeamSummary[] | null>(null);
  const pending = useRef<SavedTeamSummary[] | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [hasLocalStorageError, setLocalError] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const scope = useRef({ accountId, authResolved });
  scope.current = { accountId, authResolved };
  const busy = useRef(false);
  const confirming = useRef(false);
  const refreshPending = useRef(false);
  const generation = useRef(0);
  const refreshingVersion = useRef<number | null>(null);
  const token = useRef(Symbol("team-library"));
  const refreshRef = useRef<() => Promise<boolean>>(async () => false);

  const accept = useCallback((next: SavedTeamSummary[]) => {
    current.current = next;
    setTeams(next);
    try { storeTeams(next); setLocalError(false); } catch { setLocalError(true); }
  }, []);
  const notify = useCallback((next: SavedTeamSummary[] | null) => {
    pending.current = next;
    setPendingUpdate(next);
  }, []);
  const active = (session: Session) => sessionRef.current === session && !session.controller.signal.aborted &&
    scope.current.authResolved && scope.current.accountId === session.accountId;
  const report = (failed: boolean) => reportAccountCollectionSync(token.current, failed, failed);
  const broadcast = (id: string) => {
    try { localStorage.setItem(notificationKey, JSON.stringify({ accountId: id, nonce: crypto.randomUUID() })); }
    catch { setLocalError(true); }
  };

  const refresh = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return false;
    if (busy.current || confirming.current) { refreshPending.current = true; return false; }
    const version = ++generation.current;
    refreshingVersion.current = version;
    try {
      const remote = await readTeamLibrary(session.accountId, session.controller.signal);
      if (!active(session) || busy.current || generation.current !== version) return false;
      if (!session.ready) {
        accept(remote);
        storeSavedTeamsAccountId(session.accountId);
        session.ready = true;
        setHydrated(true);
      } else if (!jsonValueEqual(remote, current.current)) notify(remote);
      report(false);
      return true;
    } catch {
      if (active(session) && generation.current === version) report(true);
      return false;
    } finally {
      if (refreshingVersion.current === version) refreshingVersion.current = null;
    }
  }, [accept, notify]);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!authResolved) return;
    let owner: string | null = null;
    try { owner = getStoredTeamsAccountId(); } catch { setLocalError(true); }
    // Account hydration must not erase teams created before signing in.
    if (!owner && accountId && current.current.length) {
      try { localStorage.setItem(guestBackupKey, JSON.stringify(current.current)); }
      catch { setLocalError(true); return; }
    }
    if (owner && owner !== accountId) {
      try { clearStoredTeams(); } catch { setLocalError(true); }
      accept([]);
    }
    if (!accountId && owner) {
      try { accept(normalizeSavedTeams(JSON.parse(localStorage.getItem(guestBackupKey) ?? "[]"))); }
      catch { setLocalError(true); }
    }
    notify(null);
    setHydrated(!accountId);
    busy.current = false;
    confirming.current = false;
    refreshPending.current = false;
    refreshingVersion.current = null;
    setSaving(false);
    if (!accountId) return;
    const session: Session = { accountId, controller: new AbortController(), ready: false };
    sessionRef.current = session;
    const unregister = registerAccountCollectionSync(token.current, () => refreshRef.current());
    const focus = () => { void refreshRef.current(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== notificationKey || !event.newValue) return;
      try { if (JSON.parse(event.newValue).accountId === accountId) focus(); } catch { /* Ignore invalid notices. */ }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    window.addEventListener("storage", storage);
    void refreshRef.current();
    return () => {
      session.controller.abort();
      if (sessionRef.current === session) sessionRef.current = null;
      unregister();
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      window.removeEventListener("storage", storage);
    };
  }, [accountId, authResolved, accept, notify]);

  async function mutate(action: (session: Session | null) => Promise<SavedTeamSummary[]>, allowPending = false) {
    if (!authResolved || !isHydrated || busy.current || ((pending.current || confirming.current) && !allowPending)) return false;
    const session = sessionRef.current;
    busy.current = true;
    setSaving(true);
    // Preserve the refresh displaced by this write, without accepting its stale response.
    if (refreshingVersion.current === generation.current) refreshPending.current = true;
    refreshingVersion.current = null;
    generation.current += 1;
    try {
      const next = await action(session);
      if (session ? !active(session) : scope.current.accountId !== null || !scope.current.authResolved) return false;
      accept(next);
      if (session) broadcast(session.accountId);
      report(false);
      return true;
    } catch (error) {
      if (session && !active(session)) return false;
      if (error instanceof TeamLibraryChanged && session) {
        const remote = await readTeamLibrary(session.accountId, session.controller.signal).catch(() => null);
        if (remote && active(session)) notify(remote);
      }
      report(true);
      return false;
    } finally {
      if (!session || active(session)) {
        busy.current = false;
        setSaving(false);
        if (!confirming.current && refreshPending.current) {
          refreshPending.current = false;
          void refreshRef.current();
        }
      }
    }
  }

  async function save(snapshot: TeamSnapshot, id: string | null, allowPending = false) {
    const existing = current.current.find(t => t.id === id);
    if (!existing && !canAddSavedTeam(current.current.length)) return null;
    let saved = createSavedTeam(snapshot, existing);
    const success = await mutate(async session => {
      if (session) saved = await saveLibraryTeam(session.accountId, session.controller.signal, saved, existing?.revision ?? null);
      return existing ? current.current.map(t => t.id === saved.id ? saved : t) : [saved, ...current.current];
    }, allowPending);
    return success ? saved : null;
  }

  async function update(id: string, change: (team: SavedTeamSummary) => SavedTeamSummary) {
    const existing = current.current.find(t => t.id === id);
    if (!existing) return false;
    return mutate(async session => {
      const changed = change(existing);
      const saved = session ? await saveLibraryTeam(session.accountId, session.controller.signal, changed, existing.revision ?? null) : changed;
      return current.current.map(t => t.id === id ? saved : t);
    });
  }

  async function confirmUpdate(snapshot: TeamSnapshot, activeId: string | null, dirty: boolean, shownMode: TeamRefreshMode,
    apply: (result: { teams: SavedTeamSummary[]; saved: SavedTeamSummary | null; mode: TeamRefreshMode }) => Promise<boolean> = async () => true) {
    const session = sessionRef.current;
    if (!session || busy.current || confirming.current) return null;
    confirming.current = true;
    refreshingVersion.current = null;
    generation.current += 1;
    try {
      let remote = await readTeamLibrary(session.accountId, session.controller.signal);
      if (!active(session)) return null;
      notify(remote);
      const mode = teamRefreshMode(current.current, remote, activeId, dirty);
      if (mode !== shownMode) return null;
      let saved: SavedTeamSummary | null = null;
      if (mode === "save-draft") {
        saved = await save(snapshot, activeId, true);
        if (!saved || !active(session)) return null;
        remote = await readTeamLibrary(session.accountId, session.controller.signal);
        if (!active(session)) return null;
        if (remote.find(t => t.id === saved!.id)?.revision !== saved.revision) { notify(remote); return null; }
      }
      const result = { teams: remote, saved, mode };
      if (!await apply(result) || !active(session)) return null;
      accept(remote);
      notify(null);
      report(false);
      return result;
    } catch { if (active(session)) report(true); return null; }
    finally {
      if (active(session)) {
        confirming.current = false;
        generation.current += 1;
        if (refreshPending.current) {
          refreshPending.current = false;
          void refreshRef.current();
        }
      }
    }
  }

  return {
    teams: authResolved && (accountId ? sessionRef.current?.accountId === accountId && isHydrated : !sessionRef.current) ? teams : [],
    isHydrated, isSaving, pendingUpdate: authResolved && sessionRef.current?.accountId === accountId ? pendingUpdate : null, hasLocalStorageError,
    save, update, confirmUpdate, refresh,
    rename: (id: string, name: string) => update(id, team => renameSavedTeam(team, name)),
    duplicate: (team: SavedTeamSummary) => {
      if (!canAddSavedTeam(current.current.length)) return Promise.resolve(false);
      const copy = copySavedTeam(team, current.current);
      return mutate(async session => {
        const saved = session ? await saveLibraryTeam(session.accountId, session.controller.signal, copy, null) : copy;
        return [saved, ...current.current];
      });
    },
    remove: (id: string) => mutate(async session => {
      const existing = current.current.find(t => t.id === id);
      if (session && existing) await deleteLibraryTeam(session.accountId, session.controller.signal, existing);
      return current.current.filter(t => t.id !== id);
    }),
    reorderByIds: async (sourceId: string, targetId: string) => {
      const source = current.current.findIndex(t => t.id === sourceId);
      const target = current.current.findIndex(t => t.id === targetId);
      if (source < 0 || target < 0 || source === target) return false;
      return mutate(async session => {
        const next = swapArrayItems(current.current, source, target);
        if (session) await orderLibraryTeams(session.accountId, session.controller.signal, next.map(t => t.id));
        return next;
      });
    },
  };
}
