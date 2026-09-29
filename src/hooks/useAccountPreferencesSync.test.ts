// @vitest-environment jsdom
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountStorageConflictError, readAccountPreferences, writeAccountPreferences } from "../api/accountStorage";
import { deferred, renderHook } from "../test/renderHook";
import { ACCOUNT_PREFERENCES_OWNER_STORAGE_KEY, ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY,
  DEFAULT_ANALYSIS_PREFERENCE, getAllPendingAccountPreferences, getPendingAccountPreferences,
  type AccountPreferences } from "../utils/accountPreferences";
import { useAccountPreferencesSync } from "./useAccountPreferencesSync";
import { getAccountCollectionSyncSnapshot } from "../utils/accountCollectionSyncStatus";

vi.mock("../api/accountStorage", async (original) => ({
  ...await original<typeof import("../api/accountStorage")>(),
  readAccountPreferences: vi.fn(), writeAccountPreferences: vi.fn(),
}));
const defaults: AccountPreferences = { locale: "en", themePreference: "system", battleFormat: "singles", tutorialCompleted: false };
const remote: AccountPreferences = { locale: "ko", themePreference: "dark", battleFormat: "doubles", tutorialCompleted: true };
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(readAccountPreferences).mockResolvedValue({ value: remote, version: '"v1"' });
  vi.mocked(writeAccountPreferences).mockResolvedValue('"v2"');
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

async function mount(id: string | null = "a", strict = false) {
  const hook = await renderHook((accountId: string | null) => {
    const [locale, setLocale] = useState(defaults.locale);
    const [themePreference, setThemePreference] = useState(defaults.themePreference);
    const [battleFormat, setBattleFormat] = useState(defaults.battleFormat);
    const [tutorialCompleted, setTutorialCompleted] = useState(false);
    useAccountPreferencesSync({ accountId, locale, setLocale, themePreference, setThemePreference, battleFormat, setBattleFormat, tutorialCompleted, setTutorialCompleted });
    return { preferences: { locale, themePreference, battleFormat, tutorialCompleted },
      setLocale, setThemePreference, setTutorialCompleted };
  }, id, strict);
  cleanups.push(hook.unmount);
  return hook;
}

describe("account preference synchronization", () => {
  it("restores analysis selection, syncs edits, and resets it on logout", async () => {
    const saved: AccountPreferences = { ...remote, analysis: {
      scope: "team", modelId: "gpt-6-sol", reasoningEffort: "low",
    } };
    vi.mocked(readAccountPreferences).mockResolvedValue({ value: saved, version: '"v1"' });
    const hook = await renderHook((accountId: string | null) => {
      const [analysis, setAnalysis] = useState(DEFAULT_ANALYSIS_PREFERENCE);
      useAccountPreferencesSync({ accountId, ...remote,
        setLocale: noop, setThemePreference: noop, setBattleFormat: noop,
        setTutorialCompleted: noop, analysis, setAnalysis,
      });
      return { analysis, setAnalysis };
    }, "a" as string | null);
    cleanups.push(hook.unmount);
    expect(hook.current.analysis).toEqual(saved.analysis);
    expect(writeAccountPreferences).not.toHaveBeenCalled();
    await act(async () => { hook.current.setAnalysis({
      scope: "pokemon", modelId: "gpt-6-luna", reasoningEffort: "medium",
    }); });
    expect(writeAccountPreferences).toHaveBeenLastCalledWith({
      ...remote, analysis: hook.current.analysis,
    }, '"v1"', expect.any(AbortSignal), "a");
    await hook.rerender(null);
    expect(hook.current.analysis).toEqual(DEFAULT_ANALYSIS_PREFERENCE);
  });
  it("hydrates all settings without echoing remote values back", async () => {
    const hook = await mount();
    expect(hook.current.preferences).toEqual(remote);
    expect(writeAccountPreferences).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACCOUNT_PREFERENCES_OWNER_STORAGE_KEY)).toBe("a");
  });

  it("uploads user edits after hydration", async () => {
    const hook = await mount();
    await act(async () => { hook.current.setLocale("en"); });
    expect(writeAccountPreferences).toHaveBeenCalledWith({ ...remote, locale: "en" }, '"v1"', expect.any(AbortSignal), "a");
  });

  it("combines independent preference edits after another device saved first", async () => {
    vi.mocked(readAccountPreferences)
      .mockResolvedValueOnce({ value: remote, version: '"v1"' })
      .mockResolvedValueOnce({ value: { ...remote, themePreference: "light" }, version: '"v2"' });
    vi.mocked(writeAccountPreferences)
      .mockRejectedValueOnce(new AccountStorageConflictError())
      .mockResolvedValueOnce('"v3"');
    const hook = await mount();
    await act(async () => { hook.current.setLocale("en"); });
    expect(hook.current.preferences).toMatchObject({ locale: "en", themePreference: "light" });
    expect(writeAccountPreferences).toHaveBeenLastCalledWith(
      { ...remote, locale: "en", themePreference: "light" }, '"v2"', expect.any(AbortSignal), "a",
    );
  });

  it("replays two tabs' independent pending settings without overwriting either record", async () => {
    vi.mocked(writeAccountPreferences).mockRejectedValueOnce(new Error("offline"));
    const first = await mount();
    await act(async () => { first.current.setLocale("en"); });
    const secondTabKey = `${ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY}:second-tab`;
    localStorage.setItem(secondTabKey, JSON.stringify({
      accountId: "a", baseline: remote, value: { ...remote, themePreference: "light" },
      updatedAt: Date.now() + 1,
    }));

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(first.current.preferences).toMatchObject({ locale: "en", themePreference: "light" });
    expect(writeAccountPreferences).toHaveBeenLastCalledWith(
      { ...remote, locale: "en", themePreference: "light" }, '"v1"', expect.any(AbortSignal), "a",
    );
    expect(getAllPendingAccountPreferences()).toEqual([]);
  });

  it("refreshes another tab's settings on focus when local settings are already synced", async () => {
    vi.mocked(readAccountPreferences)
      .mockResolvedValueOnce({ value: remote, version: '"v1"' })
      .mockResolvedValueOnce({ value: { ...remote, themePreference: "light" }, version: '"v2"' });
    const first = await mount();
    expect(first.current.preferences.themePreference).toBe("dark");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(first.current.preferences.themePreference).toBe("light");
    expect(writeAccountPreferences).not.toHaveBeenCalled();
  });

  it("keeps a second tab's changed preference while the first write is in flight", async () => {
    const firstWrite = deferred<void>();
    let server = { value: remote, version: '"v1"' };
    vi.mocked(readAccountPreferences).mockImplementation(async () => server);
    vi.mocked(writeAccountPreferences).mockImplementation(async (value) => {
      if (server.version === '"v1"') await firstWrite.promise;
      server = { value, version: server.version === '"v1"' ? '"v2"' : '"v3"' };
      return server.version;
    });
    const first = await mount();
    await act(async () => { first.current.setLocale("en"); });
    localStorage.setItem(`${ACCOUNT_PREFERENCES_PENDING_STORAGE_KEY}:second-tab`, JSON.stringify({
      accountId: "a", baseline: remote, value: { ...remote, themePreference: "light" },
      updatedAt: Date.now() + 1,
    }));
    await act(async () => {
      firstWrite.resolve();
      await vi.waitFor(() => expect(server.value).toMatchObject({
        locale: "en", themePreference: "light",
      }));
    });
    expect(getAllPendingAccountPreferences()).toEqual([]);
  });

  it("keeps guest changes local", async () => {
    const hook = await mount(null);
    await act(async () => { hook.current.setLocale("ko"); });
    expect(readAccountPreferences).not.toHaveBeenCalled();
    expect(writeAccountPreferences).not.toHaveBeenCalled();
  });

  it("does not apply a late account response after logout", async () => {
    const read = deferred<{ value: AccountPreferences | null; version: string }>();
    vi.mocked(readAccountPreferences).mockReturnValue(read.promise);
    const hook = await mount();
    await hook.rerender(null);
    await act(async () => { read.resolve({ value: remote, version: '"v1"' }); });
    expect(hook.current.preferences).toEqual(defaults);
    expect(writeAccountPreferences).not.toHaveBeenCalled();
  });

  it("does not overwrite unseen remote settings on read failure", async () => {
    vi.mocked(readAccountPreferences).mockRejectedValue(new Error("offline"));
    const hook = await mount();
    await act(async () => { hook.current.setLocale("ko"); });
    expect(hook.current.preferences.locale).toBe("ko");
    expect(writeAccountPreferences).not.toHaveBeenCalled();
  });

  it("retries a failed preference read and keeps edits made before recovery", async () => {
    const recovered = { ...remote, locale: "en" as const };
    vi.mocked(readAccountPreferences).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ value: recovered, version: '"v1"' });
    const hook = await mount();
    await act(async () => { hook.current.setLocale("ko"); });
    expect(getAccountCollectionSyncSnapshot()).toBe("1:1");
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(hook.current.preferences).toMatchObject({ locale: "ko", themePreference: "dark" });
    expect(writeAccountPreferences).toHaveBeenCalledWith(
      { ...recovered, locale: "ko" }, '"v1"', expect.any(AbortSignal), "a",
    );
    expect(getAccountCollectionSyncSnapshot()).toBe("0:0");
  });

  it("retries a failed preference write without waiting for another setting change", async () => {
    vi.mocked(writeAccountPreferences).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce('"v2"');
    const hook = await mount();
    await act(async () => { hook.current.setLocale("en"); });
    expect(getAccountCollectionSyncSnapshot()).toBe("1:1");
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(writeAccountPreferences).toHaveBeenCalledTimes(2);
    expect(getAccountCollectionSyncSnapshot()).toBe("0:0");
  });

  it("restores an unsent preference edit after a failed write and page reload", async () => {
    vi.mocked(writeAccountPreferences).mockRejectedValueOnce(new Error("offline"));
    const first = await mount();
    await act(async () => { first.current.setLocale("en"); });
    expect(getAccountCollectionSyncSnapshot()).toBe("1:1");
    await first.unmount();
    cleanups.splice(cleanups.indexOf(first.unmount), 1);

    const reopened = await mount();
    expect(reopened.current.preferences.locale).toBe("en");
    expect(writeAccountPreferences).toHaveBeenLastCalledWith(
      { ...remote, locale: "en" }, '"v1"', expect.any(AbortSignal), "a",
    );
    expect(getAccountCollectionSyncSnapshot()).toBe("0:0");
  });

  it("rebases a pending locale edit on a remote theme change after reload", async () => {
    vi.mocked(readAccountPreferences)
      .mockResolvedValueOnce({ value: remote, version: '"v1"' })
      .mockResolvedValueOnce({ value: { ...remote, themePreference: "light" }, version: '"v2"' });
    vi.mocked(writeAccountPreferences).mockRejectedValueOnce(new Error("offline"));
    const first = await mount();
    await act(async () => { first.current.setLocale("en"); });
    await first.unmount();
    cleanups.splice(cleanups.indexOf(first.unmount), 1);

    const reopened = await mount();
    expect(reopened.current.preferences).toMatchObject({ locale: "en", themePreference: "light" });
    expect(writeAccountPreferences).toHaveBeenLastCalledWith(
      { ...remote, locale: "en", themePreference: "light" }, '"v2"', expect.any(AbortSignal), "a",
    );
  });

  it("does not retain an unsent account preference after explicit logout", async () => {
    vi.mocked(writeAccountPreferences).mockRejectedValueOnce(new Error("offline"));
    const hook = await mount();
    await act(async () => { hook.current.setLocale("en"); });
    expect(getPendingAccountPreferences()?.accountId).toBe("a");
    await hook.rerender(null);
    expect(getPendingAccountPreferences()).toBeNull();
  });

  it("preserves an unsent preference through a transient authentication error", async () => {
    vi.mocked(writeAccountPreferences).mockRejectedValueOnce(new Error("offline"));
    const hook = await renderHook(
      ({ id, resolved }: { id: string | null; resolved: boolean }) => {
        const [locale, setLocale] = useState(defaults.locale);
        const [themePreference, setThemePreference] = useState(defaults.themePreference);
        const [battleFormat, setBattleFormat] = useState(defaults.battleFormat);
        const [tutorialCompleted, setTutorialCompleted] = useState(false);
        useAccountPreferencesSync({ accountId: id, authResolved: resolved,
          locale, setLocale, themePreference, setThemePreference,
          battleFormat, setBattleFormat, tutorialCompleted, setTutorialCompleted,
        });
        return { locale, setLocale };
      },
      { id: "a" as string | null, resolved: true },
    );
    cleanups.push(hook.unmount);
    await act(async () => { hook.current.setLocale("en"); });
    expect(getPendingAccountPreferences()?.value.locale).toBe("en");
    await hook.rerender({ id: null, resolved: false });
    expect(getPendingAccountPreferences()?.value.locale).toBe("en");
    await hook.rerender({ id: "a", resolved: true });
    expect(hook.current.locale).toBe("en");
    expect(getPendingAccountPreferences()).toBeNull();
  });

  it("keeps settings changed during a transient authentication error", async () => {
    const hook = await renderHook(
      ({ id, resolved }: { id: string | null; resolved: boolean }) => {
        const [locale, setLocale] = useState(defaults.locale);
        const [themePreference, setThemePreference] = useState(defaults.themePreference);
        const [battleFormat, setBattleFormat] = useState(defaults.battleFormat);
        const [tutorialCompleted, setTutorialCompleted] = useState(false);
        useAccountPreferencesSync({ accountId: id, authResolved: resolved,
          locale, setLocale, themePreference, setThemePreference,
          battleFormat, setBattleFormat, tutorialCompleted, setTutorialCompleted,
        });
        return { locale, setLocale, themePreference, setThemePreference };
      },
      { id: "a" as string | null, resolved: true },
    );
    cleanups.push(hook.unmount);
    expect(hook.current.locale).toBe("ko");
    await hook.rerender({ id: null, resolved: false });
    await act(async () => {
      hook.current.setLocale("en");
      hook.current.setThemePreference("light");
    });
    expect(getPendingAccountPreferences()).toMatchObject({
      accountId: "a", baseline: remote, value: { locale: "en", themePreference: "light" },
    });

    await hook.rerender({ id: "a", resolved: true });
    expect(hook.current).toMatchObject({ locale: "en", themePreference: "light" });
    expect(writeAccountPreferences).toHaveBeenLastCalledWith(
      { ...remote, locale: "en", themePreference: "light" }, '"v1"', expect.any(AbortSignal), "a",
    );
    expect(getPendingAccountPreferences()).toBeNull();
  });

  it("preserves a setting changed while the first server read is pending", async () => {
    const read = deferred<{ value: AccountPreferences | null; version: string }>();
    vi.mocked(readAccountPreferences).mockReturnValue(read.promise);
    const hook = await mount();
    await act(async () => { hook.current.setLocale("ko"); });
    await act(async () => { read.resolve({ value: { ...remote, locale: "en" }, version: '"v1"' }); });
    expect(hook.current.preferences).toMatchObject({ locale: "ko", themePreference: "dark" });
  });

  it("does not repeat initial uploads under StrictMode", async () => {
    vi.mocked(readAccountPreferences).mockResolvedValue({ value: null, version: '"empty"' });
    const hook = await mount("a", true);
    expect(hook.current.preferences).toEqual(defaults);
    expect(writeAccountPreferences).toHaveBeenCalledTimes(1);
  });
});

function noop() {}
