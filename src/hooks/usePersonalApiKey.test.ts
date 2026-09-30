// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPersonalApiKeyStatus, removePersonalApiKey, savePersonalApiKey } from "../api/personalApiKey";
import { deferred, renderHook } from "../test/renderHook";
import { usePersonalApiKey } from "./usePersonalApiKey";
import { ACCOUNT_EVENT_STORAGE_KEY } from "../utils/accountCrossTab";

vi.mock("../api/personalApiKey", () => ({ readPersonalApiKeyStatus: vi.fn(), removePersonalApiKey: vi.fn(), savePersonalApiKey: vi.fn() }));
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readPersonalApiKeyStatus).mockResolvedValue(false);
  vi.mocked(savePersonalApiKey).mockResolvedValue(undefined);
  vi.mocked(removePersonalApiKey).mockResolvedValue(undefined);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(account: string | null = "a") {
  const hook = await renderHook(usePersonalApiKey, account, true);
  cleanups.push(hook.unmount);
  return hook;
}

describe("personal key lifecycle", () => {
  it.each([false, true])("replays peer refresh after a pending mutation (failed=%s)", async (failed) => {
    const pending = deferred<void>();
    vi.mocked(savePersonalApiKey).mockReturnValue(pending.promise);
    const hook = await mount();
    vi.mocked(readPersonalApiKeyStatus).mockClear();
    let operation!: Promise<boolean>;
    await act(async () => { operation = hook.current.update("test-key"); });
    await act(async () => {
      for (let i = 0; i < 2; i += 1) window.dispatchEvent(new StorageEvent("storage", {
        key: ACCOUNT_EVENT_STORAGE_KEY,
        newValue: JSON.stringify({ kind: "personal-key", accountId: "a" }),
      }));
    });
    expect(readPersonalApiKeyStatus).not.toHaveBeenCalled();
    await act(async () => {
      if (failed) pending.reject(new Error("response lost"));
      else pending.resolve();
      await operation;
    });
    expect(readPersonalApiKeyStatus).toHaveBeenCalledTimes(1);
    expect(hook.current.hasPersonalApiKey).toBe(false);
    expect(hook.current.personalApiKeyStatus).toBe("ready");
  });

  it("does not replay a queued refresh after logout", async () => {
    const pending = deferred<void>();
    vi.mocked(savePersonalApiKey).mockReturnValue(pending.promise);
    const hook = await mount();
    vi.mocked(readPersonalApiKeyStatus).mockClear();
    let operation!: Promise<boolean>;
    await act(async () => { operation = hook.current.update("test-key"); });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await hook.rerender(null);
    await act(async () => { pending.resolve(); await operation; });
    expect(readPersonalApiKeyStatus).not.toHaveBeenCalled();
    expect(hook.current.hasPersonalApiKey).toBe(false);
  });

  it("refreshes another tab after a key changes without exposing the key", async () => {
    const hook = await mount();
    vi.mocked(readPersonalApiKeyStatus).mockResolvedValue(true);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: ACCOUNT_EVENT_STORAGE_KEY,
        newValue: JSON.stringify({ kind: "personal-key", accountId: "a" }),
      }));
    });
    expect(hook.current.hasPersonalApiKey).toBe(true);
    await act(async () => { await hook.current.update("private-test-key"); });
    expect(localStorage.getItem(ACCOUNT_EVENT_STORAGE_KEY)).not.toContain("private-test-key");
  });
  it("ignores initial reads that finish after a save", async () => {
    const stale = deferred<boolean>();
    vi.mocked(readPersonalApiKeyStatus).mockReturnValue(stale.promise);
    const hook = await mount();
    await act(async () => { expect(await hook.current.update(" test-key ")).toBe(true); });
    await act(async () => { stale.resolve(false); });
    expect(savePersonalApiKey).toHaveBeenCalledWith("test-key", "a");
    expect(hook.current.hasPersonalApiKey).toBe(true);
  });
  it("does not restore a removed key from a pending read", async () => {
    const stale = deferred<boolean>();
    vi.mocked(readPersonalApiKeyStatus).mockReturnValue(stale.promise);
    const hook = await mount();
    await act(async () => { await hook.current.update(null); });
    await act(async () => { stale.resolve(true); });
    expect(hook.current.hasPersonalApiKey).toBe(false);
    expect(hook.current.personalApiKeyStatus).toBe("ready");
  });
  it("discards a mutation belonging to the previous account", async () => {
    const pending = deferred<void>();
    vi.mocked(savePersonalApiKey).mockReturnValue(pending.promise);
    const hook = await mount();
    let result!: Promise<boolean>;
    await act(async () => { result = hook.current.update("test-key"); });
    await hook.rerender("b");
    await act(async () => { pending.resolve(); expect(await result).toBe(false); });
    expect(hook.current.hasPersonalApiKey).toBe(false);
    await hook.rerender(null);
    expect(hook.current.personalApiKeyStatus).toBe("loading");
    expect(await hook.current.update("test-key")).toBe(false);
  });
  it("reports failures and permits a successful retry", async () => {
    vi.mocked(readPersonalApiKeyStatus).mockRejectedValue(new Error("unavailable"));
    const hook = await mount();
    expect(hook.current.personalApiKeyStatus).toBe("error");
    await act(async () => { await hook.current.update("test-key"); });
    expect(hook.current.personalApiKeyStatus).toBe("ready");
  });
  it("invalidates writes when the hook unmounts", async () => {
    const pending = deferred<void>();
    vi.mocked(savePersonalApiKey).mockReturnValue(pending.promise);
    const hook = await renderHook(usePersonalApiKey, "a");
    let result!: Promise<boolean>;
    await act(async () => { result = hook.current.update("test-key"); });
    await hook.unmount();
    pending.resolve();
    expect(await result).toBe(false);
  });
  it("retains known key presence after a failed mutation", async () => {
    vi.mocked(readPersonalApiKeyStatus).mockResolvedValue(true);
    vi.mocked(removePersonalApiKey).mockRejectedValue(new Error("unavailable"));
    const hook = await mount();
    await act(async () => { expect(await hook.current.update(null)).toBe(false); });
    expect(hook.current.hasPersonalApiKey).toBe(true);
    expect(hook.current.personalApiKeyStatus).toBe("error");
  });
});
