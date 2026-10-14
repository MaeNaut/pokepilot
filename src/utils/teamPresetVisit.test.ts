// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTeamPresetSelection, getInitialTeamPresetId, selectTeamPreset } from "./teamPresetVisit";
import { storeLastActiveTeamId, storeSavedTeamsAccountId } from "./teamStorage";
import { storeWorkspaceTutorialCompleted } from "./tutorialStorage";

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("public example visit hints", () => {
  it("starts a fresh browser with the example and resumes it across StrictMode/reloads", () => {
    expect(getInitialTeamPresetId("kabamanda")).toBe("kabamanda");
    expect(getInitialTeamPresetId("kabamanda")).toBe("kabamanda");
    expect(localStorage.getItem("pokepilot.savedTeams.v1")).toBeNull();
    expect(localStorage.getItem("pokepilot.lastActiveTeam.v1")).toBeNull();
  });
  it.each(["new team", "logout", "saved team"])("does not reopen the example after %s", () => {
    selectTeamPreset("kabamanda");
    clearTeamPresetSelection();
    expect(getInitialTeamPresetId("kabamanda")).toBeNull();
    selectTeamPreset("kabamanda");
    expect(getInitialTeamPresetId("kabamanda")).toBe("kabamanda");
  });
  it.each(["account", "saved identity", "tutorial"])("does not treat existing %s data as a first visit", (kind) => {
    if (kind === "account") storeSavedTeamsAccountId("a");
    if (kind === "saved identity") storeLastActiveTeamId("saved");
    if (kind === "tutorial") storeWorkspaceTutorialCompleted();
    expect(getInitialTeamPresetId("kabamanda")).toBeNull();
    localStorage.removeItem("pokepilot.savedTeams.account.v1");
    localStorage.removeItem("pokepilot.lastActiveTeam.v1");
    expect(getInitialTeamPresetId("kabamanda")).toBeNull();
  });
  it("does not load unknown example IDs", () => {
    selectTeamPreset("unknown");
    expect(getInitialTeamPresetId("kabamanda")).toBeNull();
  });
  it("does not reset a visitor when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getInitialTeamPresetId("kabamanda")).toBeNull();
    expect(() => selectTeamPreset("kabamanda")).not.toThrow();
    expect(() => clearTeamPresetSelection()).not.toThrow();
  });
});
