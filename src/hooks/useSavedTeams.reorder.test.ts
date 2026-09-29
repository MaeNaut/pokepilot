// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { renderHook } from "../test/renderHook";
import { SAVED_TEAM_SCHEMA_VERSION, type SavedTeamSummary } from "../utils/teamStorage";
import { useAccountCollection } from "./useAccountCollection";
import { useSavedTeams } from "./useSavedTeams";

vi.mock("./useAccountCollection", () => ({ useAccountCollection: vi.fn() }));

function team(id: string): SavedTeamSummary {
  return {
    version: SAVED_TEAM_SCHEMA_VERSION, id, name: id, battleFormat: "singles",
    slots: [], bench: [], createdAt: "2026-09-01", updatedAt: "2026-09-01",
  };
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.resetAllMocks();
});

it("swaps the intended teams by ID after another tab inserts a team", async () => {
  const current = { current: [team("a"), team("b"), team("c")] };
  const commit = vi.fn();
  vi.mocked(useAccountCollection).mockReturnValue({
    items: current.current, current, commit, isHydrated: true, conflict: null,
    resolveConflict: vi.fn(), hasLocalStorageError: false,
  } as never);
  const hook = await renderHook(() => useSavedTeams("account"), undefined);
  cleanups.push(hook.unmount);

  current.current = [team("new"), ...current.current];
  expect(hook.current.reorderByIds("a", "c")).toBe(true);
  expect(commit.mock.calls[0][0].map(({ id }: SavedTeamSummary) => id))
    .toEqual(["new", "c", "b", "a"]);
});

it("does not create an undefined team if a drop target disappeared", async () => {
  const current = { current: [team("a"), team("b")] };
  const commit = vi.fn();
  vi.mocked(useAccountCollection).mockReturnValue({
    items: current.current, current, commit, isHydrated: true, conflict: null,
    resolveConflict: vi.fn(), hasLocalStorageError: false,
  } as never);
  const hook = await renderHook(() => useSavedTeams("account"), undefined);
  cleanups.push(hook.unmount);

  current.current = [team("b")];
  expect(hook.current.reorderByIds("a", "b")).toBe(false);
  expect(commit).not.toHaveBeenCalled();
});
