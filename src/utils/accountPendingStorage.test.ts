// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  clearConsumedPendingCollections, clearPendingCollection, readPendingCollection,
  readPendingCollections, writePendingCollection, hasPendingCollectionForAccount,
} from "./accountPendingStorage";

const key = "test.pending";
const normalize = (value: unknown) => value as number[];

afterEach(() => localStorage.clear());

describe("account pending journal", () => {
  it("retains separate tab snapshots and replays the legacy key", () => {
    const first = { accountId: "a", baseline: [1], items: [1, 2] };
    const second = { accountId: "a", baseline: [1], items: [1, 3] };
    writePendingCollection(key, first);
    localStorage.setItem(`${key}:other-tab`, JSON.stringify(second));
    expect(readPendingCollection(key, normalize)).toEqual(first);
    expect(readPendingCollections(key, normalize).map(({ items }) => items)).toEqual([[1, 2], [1, 3]]);

    localStorage.setItem(key, JSON.stringify({ accountId: "a", baseline: [], items: [1] }));
    expect(readPendingCollections(key, normalize)).toHaveLength(3);
  });

  it("does not clear a snapshot that another tab has changed since it was read", () => {
    const old = { accountId: "a", baseline: [1], items: [1, 2] };
    const updated = { accountId: "a", baseline: [1], items: [1, 2, 3] };
    localStorage.setItem(`${key}:other-tab`, JSON.stringify(old));
    const read = readPendingCollections(key, normalize);
    localStorage.setItem(`${key}:other-tab`, JSON.stringify(updated));
    clearConsumedPendingCollections(read);
    expect(readPendingCollections(key, normalize)[0].items).toEqual(updated.items);
    clearPendingCollection(key);
    expect(readPendingCollections(key, normalize)).toEqual([]);
  });

  it("detects another tab's pending record even if one record is malformed", () => {
    localStorage.setItem(`${key}:broken`, "{");
    localStorage.setItem(`${key}:other-tab`, JSON.stringify({ accountId: "a", baseline: [], items: [2] }));
    expect(hasPendingCollectionForAccount(key, "a")).toBe(true);
    expect(hasPendingCollectionForAccount(key, "b")).toBe(false);
  });

  it("clears only the signed-out account's tab records", () => {
    localStorage.setItem(`${key}:first`, JSON.stringify({ accountId: "a", baseline: [], items: [1] }));
    localStorage.setItem(`${key}:second`, JSON.stringify({ accountId: "b", baseline: [], items: [2] }));
    clearPendingCollection(key, "a");
    expect(readPendingCollections(key, normalize).map(({ accountId }) => accountId)).toEqual(["b"]);
  });
});
