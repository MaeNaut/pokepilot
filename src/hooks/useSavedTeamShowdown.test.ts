// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import type { TeamSlot } from "../types";
import { hydrateSavedTeamMembers } from "../utils/savedTeamLibrary";
import { buildImportedShowdownSnapshot, type ImportedShowdownSnapshot } from "../utils/showdownImport";
import { createEmptyBuildState, SAVED_TEAM_SCHEMA_VERSION, type SavedTeamSummary } from "../utils/teamStorage";
import { useSavedTeamShowdown } from "./useSavedTeamShowdown";

vi.mock("../utils/savedTeamLibrary", () => ({ hydrateSavedTeamMembers: vi.fn() }));
vi.mock("../utils/showdownImport", () => ({ buildImportedShowdownSnapshot: vi.fn() }));
vi.mock("../utils/showdownText", () => ({ formatShowdownTeam: () => "Charizard" }));
const cleanups: Array<() => Promise<void>> = [];
const snapshot: ImportedShowdownSnapshot = { members: [], buildState: createEmptyBuildState() };
const team: SavedTeamSummary = {
  id: "a", version: SAVED_TEAM_SCHEMA_VERSION, name: "Team A", battleFormat: "singles", slots: [], bench: [],
  createdAt: "2026-09-24T00:00:00Z", updatedAt: "2026-09-24T00:00:00Z",
};
function options(): Parameters<typeof useSavedTeamShowdown>[0] {
  return { accountId: "user-a", pool: [], pokemonIndex: [], library: { update: vi.fn() }, t: (key) => key,
    onMessage: vi.fn(), getWorkspaceRevision: () => 7, onImported: vi.fn() };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(hydrateSavedTeamMembers).mockResolvedValue([]);
  vi.mocked(buildImportedShowdownSnapshot).mockResolvedValue(snapshot);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(props = options()) {
  const hook = await renderHook(useSavedTeamShowdown, props, true);
  cleanups.push(hook.unmount);
  return hook;
}

describe("saved team Showdown ownership", () => {
  it("opens, edits, imports once and preserves other saved fields", async () => {
    const props = options();
    const hook = await mount(props);
    await act(async () => { await hook.current.toggleSavedTeamShowdown(team); });
    expect(hook.current.teamShowdownDraft).toBe("Charizard");
    await act(async () => { hook.current.setTeamShowdownDraft("Garchomp"); });
    await act(async () => { await hook.current.commitImportSavedTeam(team); });
    expect(buildImportedShowdownSnapshot).toHaveBeenCalledWith("Garchomp", expect.objectContaining({ pokemonIndex: [] }));
    expect(props.onImported).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), snapshot, 7);
    const update = vi.mocked(props.library.update).mock.calls[0][1];
    expect(update({ ...team, name: "Renamed" })).toMatchObject({ name: "Renamed", bench: [], slots: [] });
    expect(hook.current.showdownTeamId).toBeNull();
    expect(hook.current.isImportingSavedTeam).toBe(false);
  });
  it("does not reopen after closing while hydration is pending", async () => {
    const pending = deferred<TeamSlot[]>();
    vi.mocked(hydrateSavedTeamMembers).mockReturnValue(pending.promise);
    const hook = await mount();
    await act(async () => { void hook.current.toggleSavedTeamShowdown(team); });
    await act(async () => { hook.current.closeSavedTeamShowdown(); pending.resolve([]); });
    expect(hook.current.showdownTeamId).toBeNull();
  });
  it("keeps the newest requested team when reads finish out of order", async () => {
    const stale = deferred<TeamSlot[]>();
    vi.mocked(hydrateSavedTeamMembers).mockReturnValueOnce(stale.promise).mockResolvedValue([]);
    const hook = await mount();
    await act(async () => { void hook.current.toggleSavedTeamShowdown(team); });
    await act(async () => { await hook.current.toggleSavedTeamShowdown({ ...team, id: "b" }); });
    await act(async () => { stale.resolve([]); });
    expect(hook.current.showdownTeamId).toBe("b");
  });
  it.each(["close", "account"])("discards pending imports on %s", async (transition) => {
    const pending = deferred<ImportedShowdownSnapshot>();
    vi.mocked(buildImportedShowdownSnapshot).mockReturnValue(pending.promise);
    const props = options();
    const hook = await mount(props);
    await act(async () => { await hook.current.toggleSavedTeamShowdown(team); });
    await act(async () => { void hook.current.commitImportSavedTeam(team); void hook.current.commitImportSavedTeam(team); });
    expect(buildImportedShowdownSnapshot).toHaveBeenCalledTimes(1);
    if (transition === "account") await hook.rerender({ ...props, accountId: "user-b" });
    else await act(async () => { hook.current.closeSavedTeamShowdown(); });
    await act(async () => { pending.resolve(snapshot); });
    expect(props.library.update).not.toHaveBeenCalled();
    expect(props.onImported).not.toHaveBeenCalled();
    expect(hook.current.isImportingSavedTeam).toBe(false);
  });
  it("keeps failed imports editable and allows retry", async () => {
    vi.mocked(buildImportedShowdownSnapshot).mockRejectedValueOnce(new Error("bad set"));
    const props = options();
    const hook = await mount(props);
    await act(async () => { await hook.current.toggleSavedTeamShowdown(team); });
    await act(async () => { await hook.current.commitImportSavedTeam(team); });
    expect(props.onMessage).toHaveBeenCalledWith("bad set");
    expect(hook.current.showdownTeamId).toBe("a");
    expect(hook.current.isImportingSavedTeam).toBe(false);
    await act(async () => { await hook.current.commitImportSavedTeam(team); });
    expect(props.library.update).toHaveBeenCalledTimes(1);
  });
  it("does not apply imports after unmount", async () => {
    const pending = deferred<ImportedShowdownSnapshot>();
    vi.mocked(buildImportedShowdownSnapshot).mockReturnValue(pending.promise);
    const props = options();
    const hook = await renderHook(useSavedTeamShowdown, props);
    await act(async () => { await hook.current.toggleSavedTeamShowdown(team); });
    let result!: Promise<void>;
    await act(async () => { result = hook.current.commitImportSavedTeam(team); });
    await hook.unmount();
    pending.resolve(snapshot);
    await result;
    expect(props.library.update).not.toHaveBeenCalled();
  });
});
