import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalizationContextValue } from "../i18n/LocalizationContext";
import type { PokemonIndexEntry, TeamMember } from "../types";
import { hydrateSavedTeamMembers } from "../utils/savedTeamLibrary";
import { buildImportedShowdownSnapshot, type ImportedShowdownSnapshot } from "../utils/showdownImport";
import { formatShowdownTeam } from "../utils/showdownText";
import { createEmptyBuildState, createSavedSlot, type SavedTeamSummary } from "../utils/teamStorage";
import type { useSavedTeams } from "./useSavedTeams";

type Options = {
  accountId: string | null;
  pool: TeamMember[];
  pokemonIndex: PokemonIndexEntry[];
  library: Pick<ReturnType<typeof useSavedTeams>, "update">;
  t: LocalizationContextValue["t"];
  onMessage: (message: string | null) => void;
  getWorkspaceRevision: () => number;
  onImported: (team: SavedTeamSummary, snapshot: ImportedShowdownSnapshot, revision: number) => void;
};

export function useSavedTeamShowdown({ accountId, pool, pokemonIndex, library, t, onMessage, getWorkspaceRevision, onImported }: Options) {
  const [showdownTeamId, setShowdownTeamId] = useState<string | null>(null);
  const [teamShowdownDraft, setTeamShowdownDraft] = useState("");
  const [isImportingSavedTeam, setIsImportingSavedTeam] = useState(false);
  const generation = useRef(0);
  const importPending = useRef(false);
  const requestedTeamId = useRef<string | null>(null);

  const closeSavedTeamShowdown = useCallback(() => {
    generation.current += 1;
    importPending.current = false;
    requestedTeamId.current = null;
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setIsImportingSavedTeam(false);
  }, []);

  useEffect(() => {
    closeSavedTeamShowdown();
    return () => { generation.current += 1; };
  }, [accountId, closeSavedTeamShowdown]);

  async function toggleSavedTeamShowdown(savedTeam: SavedTeamSummary) {
    if (requestedTeamId.current === savedTeam.id) {
      closeSavedTeamShowdown();
      return;
    }
    closeSavedTeamShowdown();
    requestedTeamId.current = savedTeam.id;
    const request = generation.current;
    try {
      const members = await hydrateSavedTeamMembers(savedTeam, pool);
      if (generation.current !== request) return;
      setTeamShowdownDraft(formatShowdownTeam(members, savedTeam.buildState ?? createEmptyBuildState()));
      setShowdownTeamId(savedTeam.id);
    } catch (error) {
      if (generation.current !== request) return;
      closeSavedTeamShowdown();
      onMessage(error instanceof Error ? error.message : t("team.exportCopyFailed"));
    }
  }

  async function handleExportSavedTeam() {
    const request = generation.current;
    try {
      await navigator.clipboard.writeText(teamShowdownDraft);
      if (generation.current === request) onMessage(t("team.copiedShowdown"));
    } catch {
      if (generation.current === request) onMessage(t("team.exportCopyFailed"));
    }
  }

  async function commitImportSavedTeam(savedTeam: SavedTeamSummary) {
    if (importPending.current || showdownTeamId !== savedTeam.id) return;
    importPending.current = true;
    setIsImportingSavedTeam(true);
    const request = ++generation.current;
    const revision = getWorkspaceRevision();
    try {
      const snapshot = await buildImportedShowdownSnapshot(teamShowdownDraft, {
        pokemonIndex, emptyTeamMessage: t("team.pasteAtLeastOne"),
      });
      if (generation.current !== request) return;
      const updatedAt = new Date().toISOString();
      const slots = snapshot.members.map(createSavedSlot);
      library.update(savedTeam.id, (current) => ({ ...current, slots, buildState: snapshot.buildState, updatedAt }));
      onImported({ ...savedTeam, slots, buildState: snapshot.buildState, updatedAt }, snapshot, revision);
      onMessage(t("team.importedInto", { name: savedTeam.name }));
      closeSavedTeamShowdown();
    } catch (error) {
      if (generation.current === request) onMessage(error instanceof Error ? error.message : t("toolbar.importFailed"));
    } finally {
      if (generation.current === request) {
        importPending.current = false;
        setIsImportingSavedTeam(false);
      }
    }
  }

  return { showdownTeamId, teamShowdownDraft, setTeamShowdownDraft, isImportingSavedTeam,
    closeSavedTeamShowdown, toggleSavedTeamShowdown, handleExportSavedTeam, commitImportSavedTeam };
}
