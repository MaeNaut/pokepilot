// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import { useAccountCollection } from "./useAccountCollection";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

function adapter(local = [1], owner: string | null = null) {
  return {
    readLocal: () => local,
    writeLocal: vi.fn((next: number[]) => { local = next; }),
    clearLocal: vi.fn(() => { local = []; owner = null; }),
    readOwner: () => owner,
    writeOwner: vi.fn((next: string) => { owner = next; }),
    readRemote: vi.fn<(_: AbortSignal | undefined) => Promise<number[] | null>>().mockResolvedValue([2]),
    writeRemote: vi.fn<(_: number[], signal?: AbortSignal) => Promise<void>>().mockResolvedValue(undefined),
    merge: (remote: number[], browser: number[]) => [...new Set([...remote, ...browser])],
  };
}

async function mount(storage: ReturnType<typeof adapter>, id: string | null = "a", strict = false) {
  const hook = await renderHook((accountId: string | null) => useAccountCollection(accountId, storage), id, strict);
  cleanups.push(hook.unmount);
  return hook;
}

describe("account collection lifecycle", () => {
  it("keeps guest mutations local", async () => {
    const storage = adapter();
    const hook = await mount(storage, null);
    await act(async () => { hook.current.commit([3]); });
    expect(hook.current.items).toEqual([3]);
    expect(hook.current.isHydrated).toBe(true);
    expect(storage.readRemote).not.toHaveBeenCalled();
    expect(storage.writeRemote).not.toHaveBeenCalled();
  });

  it("merges first-login data and serializes later changes", async () => {
    const storage = adapter();
    const hook = await mount(storage);
    expect(hook.current.items).toEqual([2, 1]);
    expect(storage.writeOwner).toHaveBeenCalledWith("a");
    await act(async () => { hook.current.commit([4]); hook.current.commit([5]); });
    expect(storage.writeRemote.mock.calls.map(([value]) => value)).toEqual([[2, 1], [4], [5]]);
  });

  it("retains edits made while the initial read is pending", async () => {
    const storage = adapter();
    const read = deferred<number[]>();
    storage.readRemote.mockReturnValue(read.promise);
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([3]); });
    expect(storage.writeRemote).not.toHaveBeenCalled();
    await act(async () => { read.resolve([2]); });
    expect(hook.current.items).toEqual([2, 3]);
  });

  it("does not write unchanged remote data", async () => {
    const storage = adapter([2], "a");
    await mount(storage);
    expect(storage.writeRemote).not.toHaveBeenCalled();
  });

  it("does not overwrite remote data after a failed read", async () => {
    const storage = adapter();
    storage.readRemote.mockRejectedValue(new Error("offline"));
    const hook = await mount(storage);
    expect(hook.current.isHydrated).toBe(true);
    await act(async () => { hook.current.commit([3]); });
    expect(hook.current.items).toEqual([3]);
    expect(storage.writeRemote).not.toHaveBeenCalled();
  });

  it("clears private local data on logout and ignores a late read", async () => {
    const storage = adapter([1], "a");
    const read = deferred<number[]>();
    storage.readRemote.mockReturnValue(read.promise);
    const hook = await mount(storage);
    await hook.rerender(null);
    await act(async () => { read.resolve([9]); });
    expect(hook.current.items).toEqual([]);
    expect(storage.clearLocal).toHaveBeenCalledTimes(1);
    expect(storage.writeOwner).not.toHaveBeenCalled();
    expect(storage.writeRemote).not.toHaveBeenCalled();
    expect(storage.readRemote.mock.calls[0][0]?.aborted).toBe(true);
  });

  it("never imports another account's browser library", async () => {
    const storage = adapter([1], "a");
    const hook = await mount(storage, "b");
    expect(hook.current.items).toEqual([2]);
    expect(storage.writeRemote).not.toHaveBeenCalled();
  });

  it("ignores the abandoned hydration under StrictMode", async () => {
    const storage = adapter();
    const stale = deferred<number[]>();
    storage.readRemote.mockReturnValueOnce(stale.promise);
    const hook = await mount(storage, "a", true);
    await act(async () => { stale.resolve([9]); });
    expect(hook.current.items).toEqual([2, 1]);
    expect(storage.writeRemote).toHaveBeenCalledTimes(1);
  });

  it("invalidates stale writes even when returning to the same account", async () => {
    const storage = adapter();
    const pending = deferred<void>();
    storage.writeRemote.mockReturnValueOnce(pending.promise);
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([3]); });
    await hook.rerender(null);
    await hook.rerender("a");
    await act(async () => { pending.resolve(); });
    expect(storage.writeRemote.mock.calls.map(([value]) => value)).not.toContainEqual([3]);
    expect(hook.current.items).toEqual([2]);
  });
});
