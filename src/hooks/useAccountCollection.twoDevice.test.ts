// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountStorageConflictError } from "../api/accountStorage";
import { deferred, renderHook } from "../test/renderHook";
import {
  mergeAccountTeams,
  mergeAccountTeamsAfterLocalEdits,
  reconcileAccountTeams,
  resolveAccountTeamConflicts,
} from "../utils/accountStorageSync";
import type {
  PendingAccountCollection, StoredPendingAccountCollection,
} from "../utils/accountPendingStorage";
import { normalizeSavedTeams, SAVED_TEAM_SCHEMA_VERSION, type SavedTeamSummary } from "../utils/teamStorage";
import { useAccountCollection } from "./useAccountCollection";

function team(id: string, name = id): SavedTeamSummary {
  return {
    version: SAVED_TEAM_SCHEMA_VERSION,
    id, name, battleFormat: "singles", slots: [], bench: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function createServer(teams: SavedTeamSummary[]) {
  return { teams, revision: 1 };
}

function createDevice(server: ReturnType<typeof createServer>) {
  let local = server.teams;
  let owner: string | null = "account";
  let pending: PendingAccountCollection<SavedTeamSummary> | null = null;
  let offline = false;
  let delayedWrite: ReturnType<typeof deferred<void>> | null = null;
  const storage = {
    readLocal: () => local,
    writeLocal: (value: SavedTeamSummary[]) => { local = value; },
    clearLocal: () => { local = []; owner = null; pending = null; },
    readOwner: () => owner,
    writeOwner: (id: string) => { owner = id; },
    readPending: () => pending,
    writePending: (value: PendingAccountCollection<SavedTeamSummary>) => { pending = value; },
    clearPending: () => { pending = null; },
    readRemote: async () => ({ value: server.teams, version: `"rev-${server.revision}"` }),
    writeRemote: async (value: SavedTeamSummary[], version: string) => {
      if (delayedWrite) await delayedWrite.promise;
      if (offline) throw new Error("offline");
      if (version !== `"rev-${server.revision}"`) throw new AccountStorageConflictError();
      server.teams = value;
      server.revision += 1;
      return `"rev-${server.revision}"`;
    },
    merge: mergeAccountTeams,
    mergeAfterLocalEdits: mergeAccountTeamsAfterLocalEdits,
    reconcile: reconcileAccountTeams,
  };
  return {
    storage,
    get pending() { return pending; },
    setOffline(value: boolean) { offline = value; },
    delayNextWrite() {
      delayedWrite = deferred<void>();
      return () => { delayedWrite?.resolve(); delayedWrite = null; };
    },
  };
}

function createSharedBrowser(server: ReturnType<typeof createServer>) {
  let local = server.teams;
  let owner: string | null = "account";
  let offline = false;
  let delayedWrite: ReturnType<typeof deferred<void>> | null = null;
  const pending = new Map<string, PendingAccountCollection<SavedTeamSummary>>();
  return {
    pending,
    setOffline(value: boolean) { offline = value; },
    delayNextWrite() {
      delayedWrite = deferred<void>();
      return () => { delayedWrite?.resolve(); delayedWrite = null; };
    },
    tab(tabId: string) {
      return {
        pendingKey: "test.shared.pending",
        readLocal: () => local,
        writeLocal: (value: SavedTeamSummary[]) => { local = value; },
        clearLocal: () => { local = []; owner = null; pending.clear(); },
        readOwner: () => owner,
        writeOwner: (id: string) => { owner = id; },
        readPending: () => pending.get(tabId) ?? null,
        readPendings: (): StoredPendingAccountCollection<SavedTeamSummary>[] =>
          [...pending].map(([storageKey, value]) => ({
            ...value, storageKey, serialized: JSON.stringify(value),
          })),
        writePending: (value: PendingAccountCollection<SavedTeamSummary>) => { pending.set(tabId, value); },
        clearPending: () => { pending.clear(); },
        clearPendingEntries: (records: StoredPendingAccountCollection<SavedTeamSummary>[]) => {
          for (const record of records) {
            if (JSON.stringify(pending.get(record.storageKey)) === record.serialized) {
              pending.delete(record.storageKey);
            }
          }
        },
        readRemote: async () => ({ value: normalizeSavedTeams(server.teams), version: `"rev-${server.revision}"` }),
        writeRemote: async (value: SavedTeamSummary[], version: string) => {
          if (delayedWrite) await delayedWrite.promise;
          if (offline) throw new Error("offline");
          if (version !== `"rev-${server.revision}"`) throw new AccountStorageConflictError();
          server.teams = value;
          server.revision += 1;
          return `"rev-${server.revision}"`;
        },
        merge: mergeAccountTeams,
        mergeAfterLocalEdits: mergeAccountTeamsAfterLocalEdits,
        reconcile: reconcileAccountTeams,
      };
    },
  };
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

async function mount(device: ReturnType<typeof createDevice>) {
  const hook = await renderHook(() => useAccountCollection("account", device.storage), undefined);
  cleanups.push(hook.unmount);
  return hook;
}

describe("two-device account synchronization", () => {
  it("keeps independent edits after the second device writes from a stale revision", async () => {
    const original = team("original");
    const server = createServer([original]);
    const desktop = await mount(createDevice(server));
    const mobile = await mount(createDevice(server));

    await act(async () => { desktop.current.commit([original, team("desktop")]); });
    await act(async () => { mobile.current.commit([original, team("mobile")]); });

    expect(server.teams.map(({ id }) => id)).toEqual(["original", "mobile", "desktop"]);
    expect(mobile.current.conflict).toBeNull();
    expect(mobile.current.hasUnsyncedChanges).toBe(false);
  });

  it("asks before overwriting the same team and can keep both versions", async () => {
    const original = team("shared");
    const server = createServer([original]);
    const desktop = await mount(createDevice(server));
    const mobile = await mount(createDevice(server));

    await act(async () => { desktop.current.commit([team("shared", "desktop")]); });
    await act(async () => { mobile.current.commit([team("shared", "mobile")]); });

    const conflict = mobile.current.conflict;
    expect(conflict?.conflicts).toHaveLength(1);
    expect(server.teams[0].name).toBe("desktop");
    const resolution = resolveAccountTeamConflicts(
      conflict!.merged, conflict!.conflicts, { shared: "both" }, "(mobile)",
    );
    await act(async () => { await mobile.current.resolveConflict(resolution!.teams); });
    expect(server.teams.map(({ name }) => name)).toContain("desktop");
    expect(server.teams.map(({ name }) => name)).toContain("mobile (mobile)");
    expect(mobile.current.conflict).toBeNull();
  });

  it("replays an offline edit after reload but pauses when the other device deleted that team", async () => {
    const server = createServer([team("shared")]);
    const desktop = await mount(createDevice(server));
    const mobileDevice = createDevice(server);
    const mobile = await mount(mobileDevice);

    mobileDevice.setOffline(true);
    await act(async () => { mobile.current.commit([team("shared", "offline edit")]); });
    expect(mobileDevice.pending?.items[0].name).toBe("offline edit");
    await mobile.unmount();
    cleanups.splice(cleanups.indexOf(mobile.unmount), 1);

    await act(async () => { desktop.current.commit([]); });
    mobileDevice.setOffline(false);
    const reopened = await mount(mobileDevice);
    expect(reopened.current.conflict?.conflicts).toMatchObject([
      { id: "shared", local: { name: "offline edit" }, remote: null },
    ]);
    expect(server.teams).toEqual([]);
    await act(async () => { await reopened.current.resolveConflict([]); });
    expect(mobileDevice.pending).toBeNull();
    expect(reopened.current.items).toEqual([]);
  });

  it("keeps the latest edit when a second save is queued behind a slow first save", async () => {
    const server = createServer([team("shared")]);
    const mobileDevice = createDevice(server);
    const mobile = await mount(mobileDevice);
    const release = mobileDevice.delayNextWrite();

    await act(async () => {
      mobile.current.commit([team("shared", "first")]);
      mobile.current.commit([team("shared", "second")]);
    });
    expect(mobileDevice.pending?.items[0].name).toBe("second");
    await act(async () => { release(); });
    expect(server.teams[0].name).toBe("second");
    expect(mobileDevice.pending).toBeNull();
  });
});

describe("same-browser tabs", () => {
  it("does not raise a conflict when the server reorders a saved team's fields", async () => {
    const server = createServer([]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const secondStorage = browser.tab("second");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    const second = await renderHook(() => useAccountCollection("account", secondStorage), undefined);
    cleanups.push(first.unmount, second.unmount);
    const original = team("first");
    const reordered = {
      name: original.name, battleFormat: original.battleFormat, slots: original.slots,
      bench: original.bench, version: original.version, id: original.id,
      createdAt: original.createdAt, updatedAt: original.updatedAt,
    } as SavedTeamSummary;

    await act(async () => { first.current.commit([reordered]); });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => { second.current.commit([team("second"), ...second.current.items]); });
    await act(async () => { window.dispatchEvent(new Event("focus")); });

    expect(server.teams.map(({ id }) => id)).toEqual(["second", "first"]);
    expect(first.current.conflict).toBeNull();
    expect(second.current.conflict).toBeNull();
  });

  it("refreshes a stale tab on focus even without a previous sync error", async () => {
    const original = team("original");
    const server = createServer([original]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const secondStorage = browser.tab("second");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    const second = await renderHook(() => useAccountCollection("account", secondStorage), undefined);
    cleanups.push(first.unmount, second.unmount);

    await act(async () => { first.current.commit([original, team("new")]); });
    expect(second.current.items.map(({ id }) => id)).toEqual(["original"]);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(second.current.items.map(({ id }) => id)).toContain("new");
  });

  it("waits for a peer's committed write before refreshing its data", async () => {
    const original = team("original");
    const server = createServer([original]);
    const browser = createSharedBrowser(server);
    const storage = browser.tab("first");
    const first = await renderHook(() => useAccountCollection("account", storage), undefined);
    cleanups.push(first.unmount);
    const secondStorage = browser.tab("second");
    const updated = [original, team("second")];
    secondStorage.writePending({
      accountId: "account", baseline: [original], items: updated,
    });
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "test.shared.pending:second", newValue: "pending",
      }));
    });
    expect(first.current.items.map(({ id }) => id)).toEqual(["original"]);
    expect(server.teams.map(({ id }) => id)).toEqual(["original"]);

    await secondStorage.writeRemote(updated, '"rev-1"');
    browser.pending.delete("second");
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "test.shared.pending:second", oldValue: "pending", newValue: null,
      }));
    });
    expect(first.current.items.map(({ id }) => id)).toContain("second");
    expect(server.teams.map(({ id }) => id)).toContain("second");
  });

  it("leaves a peer's pending edit for recovery while its own write is active", async () => {
    const original = team("original");
    const server = createServer([original]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    cleanups.push(first.unmount);
    const release = browser.delayNextWrite();

    await act(async () => { first.current.commit([original, team("first")]); });
    browser.tab("second").writePending({
      accountId: "account", baseline: [original], items: [original, team("second")],
    });
    await act(async () => {
      release();
      await vi.waitFor(() => expect(server.teams.map(({ id }) => id).sort())
        .toEqual(["first", "original"]));
    });
    expect(browser.pending.size).toBe(1);
    expect(first.current.hasUnsyncedChanges).toBe(false);

    await first.unmount();
    cleanups.splice(cleanups.indexOf(first.unmount), 1);
    const reopenedStorage = browser.tab("reopened");
    const reopened = await renderHook(() => useAccountCollection("account", reopenedStorage), undefined);
    cleanups.push(reopened.unmount);
    expect(server.teams.map(({ id }) => id).sort()).toEqual(["first", "original", "second"]);
    expect(browser.pending.size).toBe(0);
  });

  it("keeps concurrent same-team edits for an explicit decision", async () => {
    const server = createServer([team("shared")]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const secondStorage = browser.tab("second");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    const second = await renderHook(() => useAccountCollection("account", secondStorage), undefined);
    cleanups.push(first.unmount, second.unmount);
    const release = browser.delayNextWrite();

    await act(async () => { first.current.commit([team("shared", "first")]); });
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "test.shared.pending:first", newValue: "pending",
      }));
    });
    await act(async () => { second.current.commit([team("shared", "second")]); });
    await act(async () => { release(); });
    await vi.waitFor(() => expect(second.current.conflict?.conflicts).toMatchObject([{
      id: "shared", local: { name: "second" }, remote: { name: "first" },
    }]));
    expect(server.teams[0].name).toBe("first");
  });

  it("pauses concurrent additions that exceed the account's team limit", async () => {
    const original = Array.from({ length: 29 }, (_, index) => team(`original-${index}`));
    const server = createServer(original);
    const desktop = await mount(createDevice(server));
    const mobile = await mount(createDevice(server));
    await act(async () => { desktop.current.commit([...original, team("desktop")]); });
    await act(async () => { mobile.current.commit([...original, team("mobile")]); });

    expect(server.teams).toHaveLength(30);
    expect(mobile.current.conflict?.conflicts.some(({ reason }) => reason === "capacity")).toBe(true);
    const pending = mobile.current.conflict!;
    const choices = Object.fromEntries(pending.conflicts.map(({ id, remote }) => [
      id, id === "desktop" ? "discard" : remote ? "remote" : "local",
    ])) as Record<string, "discard" | "remote" | "local">;
    const resolution = resolveAccountTeamConflicts(pending.merged, pending.conflicts, choices, "copy");
    await act(async () => { await mobile.current.resolveConflict(resolution!.teams); });
    expect(server.teams).toHaveLength(30);
    expect(server.teams.some(({ id }) => id === "mobile")).toBe(true);
    expect(server.teams.some(({ id }) => id === "desktop")).toBe(false);
  });

  it("replays both offline team edits after both original tabs close", async () => {
    const original = team("original");
    const server = createServer([original]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const secondStorage = browser.tab("second");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    const second = await renderHook(() => useAccountCollection("account", secondStorage), undefined);
    browser.setOffline(true);
    await act(async () => { first.current.commit([original, team("first")]); });
    await act(async () => { second.current.commit([original, team("second")]); });
    expect(browser.pending.size).toBe(2);
    await first.unmount();
    await second.unmount();

    browser.setOffline(false);
    const reopenedStorage = browser.tab("reopened");
    const reopened = await renderHook(() => useAccountCollection("account", reopenedStorage), undefined);
    cleanups.push(reopened.unmount);
    expect(reopened.current.items.map(({ id }) => id).sort()).toEqual(["first", "original", "second"]);
    expect(server.teams.map(({ id }) => id).sort()).toEqual(["first", "original", "second"]);
    expect(browser.pending.size).toBe(0);
  });

  it("asks before resolving concurrent edits to the same saved team", async () => {
    const server = createServer([team("shared")]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const secondStorage = browser.tab("second");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    const second = await renderHook(() => useAccountCollection("account", secondStorage), undefined);
    browser.setOffline(true);
    await act(async () => { first.current.commit([team("shared", "first")]); });
    await act(async () => { second.current.commit([team("shared", "second")]); });
    await first.unmount();
    await second.unmount();

    browser.setOffline(false);
    const reopenedStorage = browser.tab("reopened");
    const reopened = await renderHook(() => useAccountCollection("account", reopenedStorage), undefined);
    cleanups.push(reopened.unmount);
    expect(reopened.current.conflict?.conflicts).toMatchObject([{
      id: "shared", local: { name: "second" }, remote: { name: "first" },
    }]);
    expect(server.teams[0].name).toBe("shared");
    const conflict = reopened.current.conflict!;
    const resolution = resolveAccountTeamConflicts(conflict.merged, conflict.conflicts,
      { shared: "both" }, "(second)");
    await act(async () => { await reopened.current.resolveConflict(resolution!.teams); });
    expect(server.teams.map(({ name }) => name)).toEqual(["first", "second (second)"]);
    expect(browser.pending.size).toBe(0);
  });

  it("keeps a third conflicting tab's edit for a second decision", async () => {
    const server = createServer([team("shared")]);
    const browser = createSharedBrowser(server);
    const firstStorage = browser.tab("first");
    const secondStorage = browser.tab("second");
    const thirdStorage = browser.tab("third");
    const first = await renderHook(() => useAccountCollection("account", firstStorage), undefined);
    const second = await renderHook(() => useAccountCollection("account", secondStorage), undefined);
    const third = await renderHook(() => useAccountCollection("account", thirdStorage), undefined);
    const tabs = [first, second, third];
    browser.setOffline(true);
    for (let index = 0; index < tabs.length; index += 1) {
      await act(async () => { tabs[index].current.commit([team("shared", ["first", "second", "third"][index])]); });
    }
    for (const tab of tabs) await tab.unmount();

    browser.setOffline(false);
    const storage = browser.tab("reopened");
    const reopened = await renderHook(() => useAccountCollection("account", storage), undefined);
    cleanups.push(reopened.unmount);
    expect(reopened.current.conflict?.conflicts[0].local?.name).toBe("second");
    const firstConflict = reopened.current.conflict!;
    const firstResolution = resolveAccountTeamConflicts(firstConflict.merged, firstConflict.conflicts,
      { shared: "local" }, "(copy)");
    await act(async () => { await reopened.current.resolveConflict(firstResolution!.teams); });
    expect(reopened.current.conflict?.conflicts[0].local?.name).toBe("third");
    expect(browser.pending.size).toBeGreaterThan(0);
  });
});
