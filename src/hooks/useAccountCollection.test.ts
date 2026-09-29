// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import { useAccountCollection } from "./useAccountCollection";
import { AccountStorageConflictError } from "../api/accountStorage";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

function adapter(local = [1], owner: string | null = null) {
  let pending: { accountId: string; baseline: number[]; items: number[] } | null = null;
  return {
    readLocal: () => local,
    writeLocal: vi.fn((next: number[]) => { local = next; }),
    clearLocal: vi.fn(() => { local = []; owner = null; pending = null; }),
    readOwner: () => owner,
    writeOwner: vi.fn((next: string) => { owner = next; }),
    readPending: () => pending,
    writePending: vi.fn((next: { accountId: string; baseline: number[]; items: number[] }) => { pending = next; }),
    clearPending: vi.fn(() => { pending = null; }),
    readRemote: vi.fn<(_: AbortSignal | undefined) => Promise<{ value: number[] | null; version: string }>>()
      .mockResolvedValue({ value: [2], version: '"v1"' }),
    writeRemote: vi.fn<(_: number[], version: string, signal?: AbortSignal) => Promise<string>>()
      .mockResolvedValue('"v2"'),
    merge: (remote: number[], browser: number[]) => [...new Set([...remote, ...browser])],
    mergeAfterLocalEdits: (remote: number[], browser: number[], baseline: number[]) => {
      const deleted = new Set(baseline.filter((item) => !browser.includes(item)));
      return [...new Set([...browser, ...remote.filter((item) => !deleted.has(item))])];
    },
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
    expect(storage.writeRemote.mock.calls.map(([value]) => value)).toEqual([[2, 1], [5]]);
  });

  it("retains edits made while the initial read is pending", async () => {
    const storage = adapter();
    const read = deferred<{ value: number[] | null; version: string }>();
    storage.readRemote.mockReturnValue(read.promise);
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([3]); });
    expect(storage.writeRemote).not.toHaveBeenCalled();
    await act(async () => { read.resolve({ value: [2], version: '"v1"' }); });
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

  it("hides an account cache until auth resolves and clears it for a confirmed guest", async () => {
    const storage = adapter([1], "a");
    const rendered: number[][] = [];
    const hook = await renderHook(
      ({ id, resolved }: { id: string | null; resolved: boolean }) => {
        const result = useAccountCollection(id, storage, resolved);
        rendered.push(result.items);
        return result;
      },
      { id: null as string | null, resolved: false },
    );
    cleanups.push(hook.unmount);
    expect(hook.current.items).toEqual([]);
    expect(storage.clearLocal).not.toHaveBeenCalled();
    await act(async () => { hook.current.commit([3]); });
    expect(storage.writeLocal).not.toHaveBeenCalled();
    await hook.rerender({ id: null, resolved: true });
    expect(hook.current.items).toEqual([]);
    expect(storage.clearLocal).toHaveBeenCalledTimes(1);
    expect(rendered).toEqual(rendered.map(() => []));
  });

  it("retains an account cache while auth is loading, then reconciles after sign-in", async () => {
    const storage = adapter([1], "a");
    const hook = await renderHook(
      ({ id, resolved }: { id: string | null; resolved: boolean }) =>
        useAccountCollection(id, storage, resolved),
      { id: null as string | null, resolved: false },
    );
    cleanups.push(hook.unmount);
    expect(hook.current.items).toEqual([]);
    await hook.rerender({ id: "a", resolved: true });
    expect(storage.clearLocal).not.toHaveBeenCalled();
    expect(hook.current.items).toEqual([2]);
  });

  it("keeps a guest-owned local library after auth confirms no account", async () => {
    const storage = adapter([1]);
    const hook = await renderHook(
      ({ resolved }: { resolved: boolean }) => useAccountCollection(null, storage, resolved),
      { resolved: false },
    );
    cleanups.push(hook.unmount);
    expect(hook.current.items).toEqual([]);
    await hook.rerender({ resolved: true });
    expect(hook.current.items).toEqual([1]);
    expect(storage.clearLocal).not.toHaveBeenCalled();
  });

  it("does not erase an account cache during a transient auth error", async () => {
    const storage = adapter([1], "a");
    const hook = await renderHook(
      ({ id, resolved }: { id: string | null; resolved: boolean }) =>
        useAccountCollection(id, storage, resolved),
      { id: "a" as string | null, resolved: true },
    );
    cleanups.push(hook.unmount);
    await hook.rerender({ id: null, resolved: false });
    expect(hook.current.items).toEqual([]);
    expect(storage.clearLocal).not.toHaveBeenCalled();
    await hook.rerender({ id: "a", resolved: true });
    expect(hook.current.items).toEqual([2]);
    expect(storage.clearLocal).not.toHaveBeenCalled();
  });

  it("pauses an unclaimed first-login collection when the adapter detects a capacity conflict", async () => {
    const base = adapter([1]);
    const reconcileUnclaimed = vi.fn(() => ({ merged: [2], conflicts: ["capacity"] }));
    const storage = { ...base, reconcileUnclaimed };
    const hook = await renderHook((id: string | null) => useAccountCollection(id, storage), "a" as string | null);
    cleanups.push(hook.unmount);
    expect(reconcileUnclaimed).toHaveBeenCalledWith([2], [1]);
    expect(hook.current.conflict?.conflicts).toEqual(["capacity"]);
    expect(base.writeRemote).not.toHaveBeenCalled();
  });

  it("does not resurrect a team removed on another device when the local cache is stale", async () => {
    const storage = adapter([1], "a");
    storage.readRemote.mockResolvedValue({ value: [], version: '"v2"' });
    const hook = await mount(storage);
    expect(hook.current.items).toEqual([]);
    expect(storage.writeRemote).not.toHaveBeenCalled();
  });

  it("pauses a legacy cache migration until the user chooses between divergent versions", async () => {
    const base = adapter([1], "a");
    base.readRemote.mockResolvedValue({ value: [], version: '"v2"' });
    const storage = {
      ...base,
      isManaged: () => false,
      markManaged: vi.fn(),
      reconcileLegacy: () => ({ merged: [], conflicts: ["deleted-elsewhere"] }),
    };
    const hook = await renderHook((id: string | null) => useAccountCollection(id, storage), "a" as string | null);
    cleanups.push(hook.unmount);
    expect(hook.current.conflict?.conflicts).toEqual(["deleted-elsewhere"]);
    expect(base.writeRemote).not.toHaveBeenCalled();
    await act(async () => { await hook.current.resolveConflict([]); });
    expect(storage.markManaged).toHaveBeenCalledWith("a");
    expect(hook.current.items).toEqual([]);
  });

  it("replays a persisted unsynced deletion against the latest server copy", async () => {
    const storage = adapter([2], "a");
    storage.writePending({ accountId: "a", baseline: [1, 2], items: [2] });
    storage.readRemote.mockResolvedValue({ value: [1, 2, 3], version: '"v2"' });
    const hook = await mount(storage);
    expect(hook.current.items).toEqual([2, 3]);
    expect(storage.writeRemote).toHaveBeenCalledWith([2, 3], '"v2"', expect.any(AbortSignal), "a");
    expect(storage.clearPending).toHaveBeenCalled();
  });

  it("rebases a second pending edit while the first server write is in flight", async () => {
    const storage = adapter([2], "a");
    const first = deferred<string>();
    const second = deferred<string>();
    storage.writeRemote.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const hook = await mount(storage);
    const initialClearCount = storage.clearPending.mock.calls.length;
    await act(async () => { hook.current.commit([2, 3]); });
    await act(async () => { hook.current.commit([2, 3, 4]); });
    await act(async () => { first.resolve('"v2"'); });
    expect(storage.readPending()).toEqual({ accountId: "a", baseline: [2, 3], items: [2, 3, 4] });
    expect(storage.clearPending).toHaveBeenCalledTimes(initialClearCount);
    await act(async () => { second.resolve('"v3"'); });
    expect(storage.readPending()).toBeNull();
    expect(hook.current.hasUnsyncedChanges).toBe(false);
  });

  it("reports unsynced edits after a failed read and safely retries", async () => {
    const storage = adapter();
    storage.readRemote.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ value: [2], version: '"v1"' });
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([3]); });
    expect(hook.current.hasUnsyncedChanges).toBe(true);
    expect(storage.writeRemote).not.toHaveBeenCalled();
    await act(async () => { await hook.current.retrySync(); });
    expect(storage.readRemote).toHaveBeenCalledTimes(2);
    expect(storage.writeRemote).toHaveBeenCalledWith([2, 3], '"v1"', expect.any(AbortSignal), "a");
    expect(hook.current.hasUnsyncedChanges).toBe(false);
  });

  it("reports a failed remote write and retries the latest local collection", async () => {
    const storage = adapter([2], "a");
    storage.writeRemote.mockRejectedValueOnce(new Error("offline"));
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([2, 3]); });
    expect(hook.current.hasUnsyncedChanges).toBe(true);
    await act(async () => { await hook.current.retrySync(); });
    expect(storage.writeRemote).toHaveBeenLastCalledWith([2, 3], '"v1"', expect.any(AbortSignal), "a");
    expect(hook.current.hasUnsyncedChanges).toBe(false);
  });

  it("retries an unsynced write when the browser comes back online", async () => {
    const storage = adapter([2], "a");
    storage.writeRemote.mockRejectedValueOnce(new Error("offline"));
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([2, 3]); });
    expect(hook.current.hasUnsyncedChanges).toBe(true);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(storage.writeRemote).toHaveBeenCalledTimes(2);
    expect(hook.current.hasUnsyncedChanges).toBe(false);
  });

  it("re-reads a conflicting remote revision and saves the merged collection", async () => {
    const storage = adapter([2], "a");
    storage.writeRemote.mockRejectedValueOnce(new AccountStorageConflictError())
      .mockResolvedValue('"v3"');
    storage.readRemote.mockResolvedValueOnce({ value: [2], version: '"v1"' })
      .mockResolvedValueOnce({ value: [2, 4], version: '"v2"' });
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([2, 3]); });
    expect(hook.current.items).toEqual([2, 3, 4]);
    expect(storage.writeRemote.mock.calls.map(([value, version]) => ({ value, version })))
      .toEqual([
        { value: [2, 3], version: '"v1"' },
        { value: [2, 3, 4], version: '"v2"' },
      ]);
    expect(hook.current.hasUnsyncedChanges).toBe(false);
  });

  it("waits for a decision when the same item changed on both devices", async () => {
    const base = adapter([2], "a");
    base.writeRemote.mockRejectedValueOnce(new AccountStorageConflictError())
      .mockResolvedValue('"v3"');
    base.readRemote.mockResolvedValueOnce({ value: [2], version: '"v1"' })
      .mockResolvedValueOnce({ value: [4], version: '"v2"' });
    const storage = {
      ...base,
      reconcile: () => ({ merged: [4], conflicts: ["same-item"] }),
    };
    const hook = await renderHook((id: string | null) => useAccountCollection(id, storage), "a" as string | null);
    cleanups.push(hook.unmount);
    await act(async () => { hook.current.commit([3]); });
    expect(hook.current.conflict?.conflicts).toEqual(["same-item"]);
    expect(base.writeRemote).toHaveBeenCalledTimes(1);
    await act(async () => { await hook.current.resolveConflict([3, 4]); });
    expect(hook.current.conflict).toBeNull();
    expect(base.writeRemote).toHaveBeenLastCalledWith([3, 4], '"v2"', expect.any(AbortSignal), "a");
  });

  it("keeps saving remotely if browser storage is full", async () => {
    const storage = adapter([2], "a");
    const hook = await mount(storage);
    storage.writeLocal.mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await act(async () => { hook.current.commit([2, 3]); });
    expect(hook.current.items).toEqual([2, 3]);
    expect(hook.current.hasLocalStorageError).toBe(true);
    expect(storage.writeRemote).toHaveBeenCalledWith([2, 3], '"v1"', expect.any(AbortSignal), "a");
  });

  it("retains guest edits in memory and warns when browser storage is unavailable", async () => {
    const storage = adapter();
    storage.writeLocal.mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const hook = await mount(storage, null);
    await act(async () => { hook.current.commit([3]); });
    expect(hook.current.items).toEqual([3]);
    expect(hook.current.hasLocalStorageError).toBe(true);
  });

  it("does not restore a locally deleted entry when retrying a failed initial read", async () => {
    const storage = adapter([1, 2], "a");
    storage.readRemote.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ value: [1, 2, 3], version: '"v1"' });
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([2]); });
    await act(async () => { await hook.current.retrySync(); });
    expect(hook.current.items).toEqual([2, 3]);
    expect(storage.writeRemote).toHaveBeenCalledWith([2, 3], '"v1"', expect.any(AbortSignal), "a");
  });

  it("preserves deletions made while the initial remote read is still pending", async () => {
    const storage = adapter([1, 2], "a");
    const pending = deferred<{ value: number[] | null; version: string }>();
    storage.readRemote.mockReturnValue(pending.promise);
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([2]); });
    await act(async () => { pending.resolve({ value: [1, 2, 3], version: '"v1"' }); });
    expect(hook.current.items).toEqual([2, 3]);
    expect(storage.writeRemote).toHaveBeenCalledWith([2, 3], '"v1"', expect.any(AbortSignal), "a");
  });

  it("clears private local data on logout and ignores a late read", async () => {
    const storage = adapter([1], "a");
    const read = deferred<{ value: number[] | null; version: string }>();
    storage.readRemote.mockReturnValue(read.promise);
    const hook = await mount(storage);
    await hook.rerender(null);
    await act(async () => { read.resolve({ value: [9], version: '"v1"' }); });
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
    const stale = deferred<{ value: number[] | null; version: string }>();
    storage.readRemote.mockReturnValueOnce(stale.promise);
    const hook = await mount(storage, "a", true);
    await act(async () => { stale.resolve({ value: [9], version: '"v1"' }); });
    expect(hook.current.items).toEqual([2, 1]);
    expect(storage.writeRemote).toHaveBeenCalledTimes(1);
  });

  it("invalidates stale writes even when returning to the same account", async () => {
    const storage = adapter();
    const pending = deferred<string>();
    storage.writeRemote.mockReturnValueOnce(pending.promise);
    const hook = await mount(storage);
    await act(async () => { hook.current.commit([3]); });
    await hook.rerender(null);
    await hook.rerender("a");
    await act(async () => { pending.resolve('"v2"'); });
    expect(storage.writeRemote.mock.calls.map(([value]) => value)).not.toContainEqual([3]);
    expect(hook.current.items).toEqual([2]);
  });
});
