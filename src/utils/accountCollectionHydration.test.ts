import { describe, expect, it, vi } from "vitest";
import { reconcileCollectionHydration, type CollectionMergePolicy } from "./accountCollectionHydration";

const base = {
  remote: [1], local: [2], baseline: [0], ownership: "account" as const,
  hasInSessionEdits: false, unsynced: false, legacy: false, pendings: [],
};
const policy: CollectionMergePolicy<number, string> = {
  merge: (remote, local) => [...remote, ...local],
  mergeAfterLocalEdits: (remote, local) => [...remote, ...local],
};
const pending = (items: number[]) => ({ accountId: "a", baseline: [0], items });

describe("collection hydration decisions", () => {
  it("does not restore an owned stale cache without edits or journals", () => {
    expect(reconcileCollectionHydration(base, policy)).toEqual({ merged: [1], conflicts: [], replayedCount: 0 });
  });

  it("merges guest data but does not import another account's cache", () => {
    expect(reconcileCollectionHydration({ ...base, ownership: "unclaimed" }, policy).merged).toEqual([1, 2]);
    expect(reconcileCollectionHydration({ ...base, ownership: "other" }, policy).merged).toEqual([1]);
  });

  it("stops at the first conflict and leaves later journals for recovery", () => {
    const reconcile = vi.fn((remote: number[], local: number[]) => ({ merged: [...remote, ...local], conflicts: ["team"] }));
    const result = reconcileCollectionHydration({
      ...base, hasInSessionEdits: true, unsynced: true, pendings: [pending([3]), pending([4])],
    }, { ...policy, reconcile });
    expect(result).toEqual({ merged: [1, 3], conflicts: ["team"], replayedCount: 1 });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("replays journals then applies newer in-session edits exactly once", () => {
    const options = { ...base, hasInSessionEdits: true, unsynced: true, pendings: [pending([3])] };
    expect(reconcileCollectionHydration(options, policy).merged).toEqual([1, 3, 2]);
    expect(reconcileCollectionHydration({ ...options, local: [3] }, policy).merged).toEqual([1, 3]);
    expect(reconcileCollectionHydration({ ...options, unsynced: false }, policy).merged).toEqual([1, 3]);
  });

  it("preserves adapter-specific legacy and guest reconciliation", () => {
    const reconcileLegacy = vi.fn(() => ({ merged: [7], conflicts: ["legacy"] }));
    const reconcileUnclaimed = vi.fn(() => ({ merged: [8], conflicts: [] }));
    const custom = { ...policy, reconcileLegacy, reconcileUnclaimed };
    expect(reconcileCollectionHydration({ ...base, legacy: true }, custom).merged).toEqual([7]);
    expect(reconcileCollectionHydration({ ...base, ownership: "unclaimed" }, custom).merged).toEqual([8]);
  });
});
