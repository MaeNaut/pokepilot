// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import { useAccount } from "./useAccount";
import { deleteAccount, logoutAccount, readAccount, type AccountProfile } from "../api/accountAuth";

vi.mock("../api/accountAuth", () => ({
  accountAuthEnabled: true,
  readAccount: vi.fn(),
  loginAccount: vi.fn(),
  logoutAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readAccount).mockResolvedValue({ id: "a" });
  vi.mocked(logoutAccount).mockResolvedValue(undefined);
  vi.mocked(deleteAccount).mockResolvedValue(undefined);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount() {
  const hook = await renderHook(useAccount, undefined);
  cleanups.push(hook.unmount);
  return hook;
}

describe("account refresh lifecycle", () => {
  it("loads the profile and refreshes on focus", async () => {
    const hook = await mount();
    expect(hook.current.status).toBe("ready");
    vi.mocked(readAccount).mockResolvedValue(null);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(hook.current.status).toBe("guest");
    expect(hook.current.user).toBeNull();
  });

  it("does not restore a profile from a refresh that finished after logout", async () => {
    const hook = await mount();
    const pending = deferred<AccountProfile | null>();
    vi.mocked(readAccount).mockReturnValue(pending.promise);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => { await hook.current.act("logout"); });
    await act(async () => { pending.resolve({ id: "a" }); });
    expect(hook.current.status).toBe("guest");
    expect(hook.current.user).toBeNull();
  });

  it("only accepts the newest overlapping refresh", async () => {
    const hook = await mount();
    const stale = deferred<AccountProfile | null>();
    vi.mocked(readAccount).mockReturnValueOnce(stale.promise).mockResolvedValue(null);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
    });
    await act(async () => { stale.resolve({ id: "a" }); });
    expect(hook.current.status).toBe("guest");
  });

  it("suppresses repeated account actions and focus reads while busy", async () => {
    const hook = await mount();
    const pending = deferred<void>();
    vi.mocked(deleteAccount).mockReturnValue(pending.promise);
    await act(async () => {
      void hook.current.act("delete");
      void hook.current.act("delete");
      window.dispatchEvent(new Event("focus"));
    });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(readAccount).toHaveBeenCalledTimes(1);
    expect(hook.current.busy).toBe(true);
    await act(async () => { pending.resolve(); });
    expect(hook.current.busy).toBe(false);
    expect(hook.current.status).toBe("guest");
  });

  it("prompts for authentication only when explicitly requested", async () => {
    vi.mocked(readAccount).mockResolvedValue(null);
    const hook = await mount();
    expect(hook.current.prompt).toBe(false);
    await act(async () => { expect(await hook.current.ensureAuthenticated()).toBe(false); });
    expect(hook.current.prompt).toBe(true);
  });
});
