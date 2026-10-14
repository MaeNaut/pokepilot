import { getLastActiveTeamId, getStoredTeams, getStoredTeamsAccountId } from "./teamStorage";
import { getWorkspaceTutorialCompleted } from "./tutorialStorage";

const visitKey = "pokepilot.workspace-visited.v1";
const selectionKey = "pokepilot.active-team-preset.v1";

export function selectTeamPreset(id: string) {
  try {
    localStorage.setItem(visitKey, "seen");
    localStorage.setItem(selectionKey, id);
  } catch { /* Public navigation hints are optional. */ }
}

export function clearTeamPresetSelection() {
  try {
    localStorage.setItem(visitKey, "seen");
    localStorage.removeItem(selectionKey);
  } catch { /* Do not block workspace changes when storage is unavailable. */ }
}

export function getInitialTeamPresetId(defaultId: string): string | null {
  try {
    const selected = localStorage.getItem(selectionKey);
    const visited = localStorage.getItem(visitKey);
    const existingWorkspace = Boolean(getStoredTeamsAccountId() || getLastActiveTeamId() ||
      getStoredTeams().length || getWorkspaceTutorialCompleted());
    localStorage.setItem(visitKey, "seen");
    if (selected === defaultId) return selected;
    if (visited || existingWorkspace) return null;
    // Persist intent before hydration so StrictMode and reloads can resume it.
    selectTeamPreset(defaultId);
    return defaultId;
  } catch {
    return null;
  }
}
