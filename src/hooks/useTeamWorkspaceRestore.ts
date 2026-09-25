import { useEffect, useRef } from "react";
import { getLastActiveTeamId, type SavedTeamSummary } from "../utils/teamStorage";

type Options = {
  scope: string;
  ready: boolean;
  teams: SavedTeamSummary[];
  restore: (team: SavedTeamSummary, signal: AbortSignal) => Promise<boolean>;
};

export function useTeamWorkspaceRestore({ scope, ready, teams, restore }: Options) {
  const completedScope = useRef<string | null>(null);
  const restoreRef = useRef(restore);
  useEffect(() => { restoreRef.current = restore; }, [restore]);
  useEffect(() => { completedScope.current = null; }, [scope]);

  useEffect(() => {
    if (!ready || completedScope.current === scope) return;
    const team = teams.find((entry) => entry.id === getLastActiveTeamId()) ?? teams[0];
    if (!team) {
      completedScope.current = scope;
      return;
    }
    const controller = new AbortController();
    // StrictMode cleanup or a refreshed library may cancel the first attempt.
    // A false result means an explicit workspace action superseded restoration.
    // Do not retry over that action; only aborted or failed attempts may retry.
    void restoreRef.current(team, controller.signal).then(() => {
      if (!controller.signal.aborted) completedScope.current = scope;
    }).catch(() => {
      // A later library refresh can retry; restoration must not reject globally.
    });
    return () => { controller.abort(); };
  }, [scope, ready, teams]);
}
