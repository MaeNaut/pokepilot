const workspaceTutorialStorageKey = "pokepilot.tutorial.introduction.v2";

export function getWorkspaceTutorialCompleted() {
  try {
    return localStorage.getItem(workspaceTutorialStorageKey) === "done";
  } catch {
    return false;
  }
}

export function storeWorkspaceTutorialCompleted() {
  try {
    localStorage.setItem(workspaceTutorialStorageKey, "done");
  } catch {
    // The tutorial can still be dismissed for the current session.
  }
}
