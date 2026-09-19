import { useCallback, useEffect, useRef, useState } from "react";
import { readAccountTeams, writeAccountTeams } from "../api/accountStorage";
import { canAddSavedTeam } from "../data/teamLimits";
import { swapArrayItems } from "../utils/reorder";
import { copySavedTeam, createSavedTeam, renameSavedTeam } from "../utils/savedTeamLibrary";
import {
  clearStoredTeams,
  getStoredTeamsAccountId,
  getStoredTeams,
  storeSavedTeamsAccountId,
  storeTeams,
  type SavedTeamSummary,
  type TeamSnapshot,
} from "../utils/teamStorage";
import { mergeAccountTeams } from "../utils/accountStorageSync";

export function useSavedTeams(accountId: string | null) {
  const [teams, setTeams] = useState(getStoredTeams);
  const [hydratedAccountId, setHydratedAccountId] = useState<string | null>(null);
  const currentTeams = useRef(teams);
  const accountIdRef = useRef(accountId);
  const previousAccountIdRef = useRef(accountId);
  const syncReadyRef = useRef(false);
  const writeQueueRef = useRef(Promise.resolve());

  const commitLocal = useCallback((next: SavedTeamSummary[]) => {
    // Persist once, outside React's replayable state updater.
    storeTeams(next);
    currentTeams.current = next;
    setTeams(next);
  }, []);

  const queueAccountWrite = useCallback((
    next: SavedTeamSummary[],
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
          await writeAccountTeams(next);
        });
    }, []);

  const commit = useCallback((next: SavedTeamSummary[]) => {
    commitLocal(next);
    queueAccountWrite(next);
  }, [commitLocal, queueAccountWrite]);

  const clearLocalTeams = useCallback(() => {
    clearStoredTeams();
    currentTeams.current = [];
    setTeams([]);
  }, []);

  useEffect(() => {
    const previousAccountId = previousAccountIdRef.current;
    previousAccountIdRef.current = accountId;
    accountIdRef.current = accountId;
    syncReadyRef.current = false;

    if (previousAccountId && previousAccountId !== accountId) {
      clearLocalTeams();
    }

    if (!accountId) {
      setHydratedAccountId(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const remoteTeams = await readAccountTeams();
        if (!active || accountIdRef.current !== accountId) return;

        const storedAccountId = getStoredTeamsAccountId();
        const localTeams = storedAccountId === null || storedAccountId === accountId
          ? currentTeams.current
          : [];
        const nextTeams = mergeAccountTeams(remoteTeams ?? [], localTeams);

        commitLocal(nextTeams);
        storeSavedTeamsAccountId(accountId);
        syncReadyRef.current = true;
        setHydratedAccountId(accountId);

        if (
          remoteTeams === null ||
          JSON.stringify(remoteTeams) !== JSON.stringify(nextTeams)
        ) {
          queueAccountWrite(nextTeams, accountId);
        }
      } catch {
        if (active && accountIdRef.current === accountId) {
          setHydratedAccountId(accountId);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [accountId, clearLocalTeams, commitLocal, queueAccountWrite]);

  function update(id: string, change: (team: SavedTeamSummary) => SavedTeamSummary) {
    commit(currentTeams.current.map((team) => team.id === id ? change(team) : team));
  }

  return {
    teams,
    isHydrated: accountId === hydratedAccountId,
    save(snapshot: TeamSnapshot, id: string | null) {
      const existing = currentTeams.current.find((team) => team.id === id);
      if (!existing && !canAddSavedTeam(currentTeams.current.length)) return null;
      const saved = createSavedTeam(snapshot, existing);
      commit(existing
        ? currentTeams.current.map((team) => team.id === saved.id ? saved : team)
        : [saved, ...currentTeams.current]);
      return saved;
    },
    rename(id: string, name: string) {
      update(id, (team) => renameSavedTeam(team, name));
    },
    duplicate(team: SavedTeamSummary) {
      if (!canAddSavedTeam(currentTeams.current.length)) return false;
      commit([copySavedTeam(team, currentTeams.current), ...currentTeams.current]);
      return true;
    },
    remove(id: string) {
      commit(currentTeams.current.filter((team) => team.id !== id));
    },
    reorder(source: number, target: number) {
      if (source !== target) commit(swapArrayItems(currentTeams.current, source, target));
    },
    update,
  };
}
