// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { registerAccountSyncLifecycle } from "./accountSyncLifecycle";
import { reportAccountCollectionSync, retryAccountCollections } from "./accountCollectionSyncStatus";

describe("account sync lifecycle", () => {
  it.each(["committed", "all"] as const)("keeps the %s journal notification policy explicit", async (pendingChanges) => {
    const retry = vi.fn(async () => true);
    const session = { close: vi.fn() };
    const token = Symbol();
    const close = registerAccountSyncLifecycle({ token, retry, session, pendingKey: "pending", pendingChanges });
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: "pending:peer", newValue: "edit" }));
      expect(retry).toHaveBeenCalledTimes(pendingChanges === "all" ? 1 : 0);
      retry.mockClear();
      for (const key of ["pending", "pending:peer"]) {
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }));
      }
      window.dispatchEvent(new StorageEvent("storage", { key: "pending-unrelated", newValue: null }));
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
      expect(retry).toHaveBeenCalledTimes(2);
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      expect(retry).toHaveBeenCalledTimes(4);
      reportAccountCollectionSync(token, true, true);
      await retryAccountCollections();
      expect(retry).toHaveBeenCalledTimes(5);
    } finally {
      close();
    }
    retry.mockClear();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new StorageEvent("storage", { key: "pending:peer", newValue: null }));
    await retryAccountCollections();
    expect(retry).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalledTimes(1);
  });
});
