// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import { useSavedTeams, teamRefreshMode } from "./useSavedTeams";
import * as api from "../api/teamLibrary";
import { createEmptyBuildState, storeTeams, type SavedTeamSummary, type TeamSnapshot } from "../utils/teamStorage";

vi.mock("../api/teamLibrary", () => ({
  readTeamLibrary: vi.fn(), saveLibraryTeam: vi.fn(), deleteLibraryTeam: vi.fn(), orderLibraryTeams: vi.fn(),
  TeamLibraryChanged: class extends Error {},
}));
const cleanups: Array<() => Promise<void>> = [];
const team = (id: string, revision = "1"): SavedTeamSummary => ({ id, revision, name: id, version: 1,
  slots: Array(6).fill(null), bench: [], battleFormat: "singles", createdAt: "2026-09-29", updatedAt: "2026-09-29" });
const draft = (name = "draft"): TeamSnapshot => ({ name, slots: Array(6).fill(null), bench: [], battleFormat: "singles", buildState: createEmptyBuildState() });
let server: SavedTeamSummary[];
beforeEach(() => {
  server = [team("a"), team("b")];
  vi.mocked(api.readTeamLibrary).mockImplementation(async () => structuredClone(server));
  vi.mocked(api.saveLibraryTeam).mockImplementation(async (_id, _signal, next, revision) => {
    const existing = server.find(t => t.id === next.id);
    if ((existing?.revision ?? null) !== revision) throw new api.TeamLibraryChanged();
    const saved = { ...next, revision: String(Number(revision ?? 0) + 1) };
    server = existing ? server.map(t => t.id === saved.id ? saved : t) : [saved, ...server];
    return saved;
  });
  vi.mocked(api.orderLibraryTeams).mockResolvedValue(undefined);
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  localStorage.clear();
  vi.resetAllMocks();
});
async function setup() {
  const hook = await renderHook((id: string | null) => useSavedTeams(id), "account" as string | null);
  cleanups.push(hook.unmount);
  return hook;
}

describe("server-first team synchronization", () => {
  it("preserves guest teams separately when signing in and restores them on logout", async () => {
    storeTeams([team("guest")]);
    const hook = await setup();
    expect(hook.current.teams.map(t => t.id)).toEqual(["a", "b"]);
    await hook.rerender(null);
    expect(hook.current.teams.map(t => t.id)).toEqual(["guest"]);
    expect(api.saveLibraryTeam).not.toHaveBeenCalled();
  });
  it("notifies before replacing data, and saves an independent draft before acknowledgement", async () => {
    const hook = await setup();
    server[0] = team("a", "2");
    await act(async () => { await hook.current.refresh(); });
    expect(hook.current.teams[0].revision).toBe("1");
    expect(hook.current.pendingUpdate?.[0].revision).toBe("2");
    expect(teamRefreshMode(hook.current.teams, server, "b", true)).toBe("save-draft");
    const apply = vi.fn(async () => true);
    await act(async () => { await hook.current.confirmUpdate(draft("B edited"), "b", true, "save-draft", apply); });
    expect(server.find(t => t.id === "b")?.name).toBe("B edited");
    expect(apply).toHaveBeenCalledOnce();
    expect(hook.current.pendingUpdate).toBeNull();
    expect(hook.current.teams[0].revision).toBe("2");
  });

  it("requires a new confirmation if the active team changes while the notice is open", async () => {
    const hook = await setup();
    server[0] = team("a", "2");
    await act(async () => { await hook.current.refresh(); });
    server[1] = team("b", "2");
    const apply = vi.fn(async () => true);
    await act(async () => {
      expect(await hook.current.confirmUpdate(draft(), "b", true, "save-draft", apply)).toBeNull();
    });
    expect(api.saveLibraryTeam).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(teamRefreshMode(hook.current.teams, hook.current.pendingUpdate!, "b", true)).toBe("discard-draft");
    await act(async () => { await hook.current.confirmUpdate(draft(), "b", true, "discard-draft", apply); });
    expect(apply).toHaveBeenCalledOnce();
    expect(hook.current.teams[1].revision).toBe("2");
  });

  it("keeps the notification and editor intact when saving or applying fails", async () => {
    const hook = await setup();
    server[0] = team("a", "2");
    await act(async () => { await hook.current.refresh(); });
    vi.mocked(api.saveLibraryTeam).mockRejectedValueOnce(new Error("offline"));
    const apply = vi.fn(async () => true);
    await act(async () => { expect(await hook.current.confirmUpdate(draft(), "b", true, "save-draft", apply)).toBeNull(); });
    expect(apply).not.toHaveBeenCalled();
    expect(hook.current.teams[0].revision).toBe("1");
    await act(async () => { expect(await hook.current.confirmUpdate(draft(), "a", false, "refresh", async () => false)).toBeNull(); });
    expect(hook.current.pendingUpdate).not.toBeNull();
  });

  it("rejects a stale save without reporting success or changing the visible library", async () => {
    const hook = await setup();
    server[0] = team("a", "2");
    await act(async () => { expect(await hook.current.save(draft(), "a")).toBeNull(); });
    expect(hook.current.teams[0].revision).toBe("1");
    expect(hook.current.pendingUpdate?.[0].revision).toBe("2");
  });

  it("ignores late writes after logout and clears account data", async () => {
    const hook = await setup();
    const writing = deferred<SavedTeamSummary>();
    vi.mocked(api.saveLibraryTeam).mockReturnValueOnce(writing.promise);
    let promise!: Promise<SavedTeamSummary | null>;
    await act(async () => { promise = hook.current.save(draft(), "a"); });
    await hook.rerender(null);
    await act(async () => { writing.resolve(team("a", "2")); expect(await promise).toBeNull(); });
    expect(hook.current.teams).toEqual([]);
  });

  it("reorders by IDs and rejects missing drop targets", async () => {
    const hook = await setup();
    await act(async () => { expect(await hook.current.reorderByIds("a", "b")).toBe(true); });
    expect(hook.current.teams.map(t => t.id)).toEqual(["b", "a"]);
    expect(api.orderLibraryTeams).toHaveBeenCalledWith("account", expect.any(AbortSignal), ["b", "a"]);
    await act(async () => { expect(await hook.current.reorderByIds("missing", "b")).toBe(false); });
  });

  it("handles cross-tab notices without changing the visible data", async () => {
    const hook = await setup();
    server[0] = team("a", "2");
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", {
      key: "pokepilot.team-library.commit.v2", newValue: JSON.stringify({ accountId: "account" }),
    })); });
    expect(hook.current.pendingUpdate).not.toBeNull();
    expect(hook.current.teams[0].revision).toBe("1");
  });
});
