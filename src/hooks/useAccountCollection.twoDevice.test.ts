// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import { AccountStorageConflictError } from "../api/accountStorage";
import { deferred, renderHook } from "../test/renderHook";
import { createCopilotHistoryEntry, type CopilotHistoryEntry } from "../utils/copilotHistory";
import { mergeAccountCopilotHistory, mergeAccountCopilotHistoryAfterLocalEdits, reconcileAccountCopilotHistory } from "../utils/accountStorageSync";
import type { PendingAccountCollection } from "../utils/accountPendingStorage";
import { useAccountCollection } from "./useAccountCollection";

function entry(id: string) {
  return createCopilotHistoryEntry({
    id, teamKey: "saved:team", locale: "en", scope: "team", battleFormat: "singles",
    requestFingerprint: id, createdAt: "2026-09-29T00:00:00.000Z", usedFallback: false,
    response: { version: 2, source: "hosted", scope: "team", title: id, paragraphs: [id], recommendations: [] },
  });
}
function server(items = [entry("original")]) { return { items, revision: 1 }; }
function device(remote: ReturnType<typeof server>) {
  let local = remote.items;
  let pending: PendingAccountCollection<CopilotHistoryEntry> | null = null;
  let paused: ReturnType<typeof deferred<void>> | null = null;
  const storage = {
    pendingKey: "qa.history.pending",
    readLocal: () => local,
    writeLocal: (items: CopilotHistoryEntry[]) => { local = items; },
    clearLocal: () => { local = []; pending = null; },
    readOwner: () => "account", writeOwner: () => {},
    readPending: () => pending,
    writePending: (value: PendingAccountCollection<CopilotHistoryEntry>) => { pending = value; },
    clearPending: () => { pending = null; },
    readRemote: async () => ({ value: remote.items, version: String(remote.revision) }),
    writeRemote: async (items: CopilotHistoryEntry[], version: string) => {
      if (paused) await paused.promise;
      if (version !== String(remote.revision)) throw new AccountStorageConflictError();
      remote.items = items;
      return String(++remote.revision);
    },
    merge: mergeAccountCopilotHistory,
    mergeAfterLocalEdits: mergeAccountCopilotHistoryAfterLocalEdits,
    reconcile: reconcileAccountCopilotHistory,
  };
  return { storage, pause() { paused = deferred<void>(); return () => { paused?.resolve(); paused = null; }; } };
}
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(value: ReturnType<typeof device>) {
  const hook = await renderHook(() => useAccountCollection("account", value.storage), undefined);
  cleanups.push(hook.unmount);
  return hook;
}

it("merges independent history additions after a stale device write", async () => {
  const remote = server();
  const desktop = await mount(device(remote));
  const mobile = await mount(device(remote));
  await act(async () => { desktop.current.commit([...desktop.current.items, entry("desktop")]); });
  await act(async () => { mobile.current.commit([...mobile.current.items, entry("mobile")]); });
  expect(remote.items.map(item => item.id).sort()).toEqual(["desktop", "mobile", "original"]);
});

it("does not resurrect remotely deleted history when a stale device adds an entry", async () => {
  const remote = server();
  const desktop = await mount(device(remote));
  const mobile = await mount(device(remote));
  await act(async () => { desktop.current.commit([]); });
  await act(async () => { mobile.current.commit([...mobile.current.items, entry("new")]); });
  expect(remote.items.map(item => item.id)).toEqual(["new"]);
});

it("refreshes an otherwise healthy history tab on focus", async () => {
  const remote = server();
  const desktop = await mount(device(remote));
  const mobile = await mount(device(remote));
  await act(async () => { desktop.current.commit([entry("new")]); });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(mobile.current.items.map(item => item.id)).toEqual(["new"]);
});

it("retains the latest history mutation queued behind a slow save", async () => {
  const remote = server();
  const desktop = device(remote);
  const hook = await mount(desktop);
  const resume = desktop.pause();
  await act(async () => { hook.current.commit([entry("first")]); });
  await act(async () => { hook.current.commit([entry("second")]); });
  await act(async () => { resume(); });
  expect(remote.items.map(item => item.id)).toEqual(["second"]);
});

it("waits for a peer journal to be committed before refreshing history", async () => {
  const remote = server();
  const desktop = await mount(device(remote));
  const mobile = await mount(device(remote));
  const key = "qa.history.pending:peer";
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: "uncommitted" }));
  });
  expect(mobile.current.items.map(item => item.id)).toEqual(["original"]);
  await act(async () => { desktop.current.commit([entry("committed")]); });
  expect(mobile.current.items.map(item => item.id)).toEqual(["original"]);
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key, oldValue: "uncommitted", newValue: null }));
  });
  expect(mobile.current.items.map(item => item.id)).toEqual(["committed"]);
});
