// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import { SAVED_TEAM_SCHEMA_VERSION, storeLastActiveTeamId, type SavedTeamSummary } from "../utils/teamStorage";
import { useTeamWorkspaceRestore } from "./useTeamWorkspaceRestore";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  localStorage.clear();
});
const team: SavedTeamSummary = { version: SAVED_TEAM_SCHEMA_VERSION, id: "a", name: "A", battleFormat: "singles",
  slots: [], bench: [], createdAt: "2026-09-24", updatedAt: "2026-09-24" };
function defaults() {
  return { scope: "local", ready: true, teams: [team], restore: vi.fn<(team: SavedTeamSummary, signal: AbortSignal) => Promise<boolean>>().mockResolvedValue(true) };
}
async function mount(props = defaults(), strict = false) {
  const hook = await renderHook(useTeamWorkspaceRestore, props, strict);
  cleanups.push(hook.unmount);
  return hook;
}

describe("workspace restoration", () => {
  it("waits for the account library before loading an empty-workspace example", async () => {
    const restoreEmpty = vi.fn().mockResolvedValue(true);
    const props = { ...defaults(), ready: false, teams: [], restoreEmpty };
    const hook = await mount(props);
    expect(restoreEmpty).not.toHaveBeenCalled();
    await hook.rerender({ ...props, ready: true });
    expect(restoreEmpty).toHaveBeenCalledTimes(1);
    expect(props.restore).not.toHaveBeenCalled();
  });
  it("always prefers account teams to the public empty-workspace example", async () => {
    const restoreEmpty = vi.fn().mockResolvedValue(true);
    const props = { ...defaults(), restoreEmpty };
    await mount(props);
    expect(props.restore).toHaveBeenCalledTimes(1);
    expect(restoreEmpty).not.toHaveBeenCalled();
  });
  it("cancels StrictMode example hydration and retries only the live attempt", async () => {
    const props = { ...defaults(), teams: [], restoreEmpty: vi.fn(async(signal: AbortSignal) => {
      await Promise.resolve(); return !signal.aborted;
    }) };
    await mount(props, true);
    expect(props.restoreEmpty).toHaveBeenCalledTimes(2);
    expect(props.restoreEmpty.mock.calls[0][0].aborted).toBe(true);
    expect(props.restoreEmpty.mock.calls[1][0].aborted).toBe(false);
  });
  it("retries StrictMode-cancelled hydration and completes only the live request", async () => {
    const props = defaults();
    const applied: string[] = [];
    props.restore.mockImplementation(async (saved, signal) => {
      await Promise.resolve();
      if (signal.aborted) return false;
      applied.push(saved.id);
      return true;
    });
    const hook = await mount(props, true);
    expect(props.restore).toHaveBeenCalledTimes(2);
    expect(props.restore.mock.calls[0][1].aborted).toBe(true);
    expect(applied).toEqual(["a"]);
    await hook.rerender({ ...props, teams: [...props.teams] });
    expect(props.restore).toHaveBeenCalledTimes(2);
  });
  it("waits for hydration and prefers the last active saved team", async () => {
    const props = { ...defaults(), ready: false, teams: [team, { ...team, id: "b" }] };
    storeLastActiveTeamId("b");
    const hook = await mount(props);
    expect(props.restore).not.toHaveBeenCalled();
    await hook.rerender({ ...props, ready: true });
    expect(props.restore.mock.calls[0][0].id).toBe("b");
  });
  it("does not let a cancelled attempt suppress a refreshed library", async () => {
    const pending = deferred<boolean>();
    const props = defaults();
    props.restore.mockReturnValueOnce(pending.promise);
    const hook = await mount(props);
    await hook.rerender({ ...props, teams: [...props.teams] });
    await act(async () => { pending.resolve(true); });
    expect(props.restore).toHaveBeenCalledTimes(2);
    expect(props.restore.mock.calls[0][1].aborted).toBe(true);
  });
  it("restores again after leaving and returning to an account", async () => {
    const props = { ...defaults(), scope: "user-a" };
    const hook = await mount(props);
    await hook.rerender({ ...props, scope: "user-b", ready: false });
    await hook.rerender(props);
    expect(props.restore).toHaveBeenCalledTimes(2);
  });
  it("can retry rejected hydration without an unhandled rejection", async () => {
    const props = defaults();
    props.restore.mockRejectedValueOnce(new Error("unavailable"));
    const hook = await mount(props);
    await hook.rerender({ ...props, teams: [...props.teams] });
    expect(props.restore).toHaveBeenCalledTimes(2);
  });
  it("does not retry over a manual action that superseded restoration", async () => {
    const props = defaults();
    props.restore.mockResolvedValue(false);
    const hook = await mount(props);
    await hook.rerender({ ...props, teams: [...props.teams] });
    expect(props.restore).toHaveBeenCalledTimes(1);
  });
});
