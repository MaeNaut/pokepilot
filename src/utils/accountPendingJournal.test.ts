// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearConsumedJournal, readPendingJournal } from "./accountPendingJournal";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("shared pending journal", () => {
  it("reads legacy and tab keys, skipping damaged and unrelated records", () => {
    localStorage.setItem("pending", "1");
    localStorage.setItem("pending:broken", "{");
    localStorage.setItem("pending:peer", "2");
    localStorage.setItem("pending-other", "3");
    expect(readPendingJournal("pending", (_key, raw) => JSON.parse(raw))).toEqual([1, 2]);
  });

  it("retains partial results when storage access fails", () => {
    localStorage.setItem("pending:a", "1");
    localStorage.setItem("pending:b", "2");
    const getItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "pending:b") throw new Error("storage unavailable");
      return getItem.call(this, key);
    });
    expect(readPendingJournal("pending", (_key, raw) => JSON.parse(raw))).toEqual([1]);
  });

  it("only removes the exact consumed snapshot", () => {
    localStorage.setItem("pending:a", "new");
    localStorage.setItem("pending:b", "old");
    clearConsumedJournal([
      { storageKey: "pending:a", serialized: "old" },
      { storageKey: "pending:b", serialized: "old" },
    ]);
    expect(localStorage.getItem("pending:a")).toBe("new");
    expect(localStorage.getItem("pending:b")).toBeNull();
  });
});
