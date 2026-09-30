import { describe, expect, it, vi } from "vitest";
import { reconcileCollectionHydration, type CollectionMergePolicy } from "./accountCollectionHydration";

const base = {
  remote: [1], local: [2], baseline: [0], ownership: "account" as const,
  hasInSessionEdits: false, unsynced: false, pendings: [],
};
const policy: CollectionMergePolicy<number> = {
  merge: (remote, local) => [...remote, ...local],
  mergeAfterLocalEdits: (remote, local) => [...remote, ...local],
};
const pending = (items: number[]) => ({ accountId: "a", baseline: [0], items });

describe("collection hydration decisions", () => {
  it("does not restore an owned stale cache without edits or journals", () => {
    expect(reconcileCollectionHydration(base, policy)).toEqual([1]);
  });

  it("merges guest data but does not import another account's cache", () => {
    expect(reconcileCollectionHydration({ ...base, ownership: "unclaimed" }, policy)).toEqual([1, 2]);
    expect(reconcileCollectionHydration({ ...base, ownership: "other" }, policy)).toEqual([1]);
  });

  it("automatically reconciles all pending journals in order", () => {
    const reconcile = vi.fn((remote: number[], local: number[]) => [...remote, ...local]);
    const result = reconcileCollectionHydration({
      ...base, pendings: [pending([3]), pending([4])],
    }, { ...policy, reconcile });
    expect(result).toEqual([1, 3, 4]);
    expect(reconcile.mock.calls).toEqual([[[1], [3], [0]], [[1, 3], [4], [0]]]);
  });

  it("replays journals then applies newer in-session edits exactly once", () => {
    const options = { ...base, hasInSessionEdits: true, unsynced: true, pendings: [pending([3])] };
    expect(reconcileCollectionHydration(options, policy)).toEqual([1, 3, 2]);
    expect(reconcileCollectionHydration({ ...options, local: [3] }, policy)).toEqual([1, 3]);
    expect(reconcileCollectionHydration({ ...options, unsynced: false }, policy)).toEqual([1, 3]);
  });
});
