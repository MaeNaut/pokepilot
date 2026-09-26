// @vitest-environment jsdom
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAccountPreferences, writeAccountPreferences } from "../api/accountStorage";
import { deferred, renderHook } from "../test/renderHook";
import { ACCOUNT_PREFERENCES_OWNER_STORAGE_KEY, DEFAULT_ANALYSIS_PREFERENCE, type AccountPreferences } from "../utils/accountPreferences";
import { useAccountPreferencesSync } from "./useAccountPreferencesSync";

vi.mock("../api/accountStorage", () => ({ readAccountPreferences: vi.fn(), writeAccountPreferences: vi.fn() }));
const defaults: AccountPreferences = { locale: "en", themePreference: "system", battleFormat: "singles", tutorialCompleted: false };
const remote: AccountPreferences = { locale: "ko", themePreference: "dark", battleFormat: "doubles", tutorialCompleted: true };
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(readAccountPreferences).mockResolvedValue(remote);
  vi.mocked(writeAccountPreferences).mockResolvedValue(undefined);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

async function mount(id: string | null = "a", strict = false) {
  const hook = await renderHook((accountId: string | null) => {
    const [locale, setLocale] = useState(defaults.locale);
    const [themePreference, setThemePreference] = useState(defaults.themePreference);
    const [battleFormat, setBattleFormat] = useState(defaults.battleFormat);
    const [tutorialCompleted, setTutorialCompleted] = useState(false);
    useAccountPreferencesSync({ accountId, locale, setLocale, themePreference, setThemePreference, battleFormat, setBattleFormat, tutorialCompleted, setTutorialCompleted });
    return { preferences: { locale, themePreference, battleFormat, tutorialCompleted }, setLocale, setTutorialCompleted };
  }, id, strict);
  cleanups.push(hook.unmount);
  return hook;
}

describe("account preference synchronization", () => {
  it("restores analysis selection, syncs edits, and resets it on logout", async () => {
    const saved: AccountPreferences = { ...remote, analysis: {
      scope: "team", modelId: "gpt-6-sol", reasoningEffort: "low",
    } };
    vi.mocked(readAccountPreferences).mockResolvedValue(saved);
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
    }, expect.any(AbortSignal));
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
    expect(writeAccountPreferences).toHaveBeenCalledWith({ ...remote, locale: "en" }, expect.any(AbortSignal));
  });

  it("keeps guest changes local", async () => {
    const hook = await mount(null);
    await act(async () => { hook.current.setLocale("ko"); });
    expect(readAccountPreferences).not.toHaveBeenCalled();
    expect(writeAccountPreferences).not.toHaveBeenCalled();
  });

  it("does not apply a late account response after logout", async () => {
    const read = deferred<AccountPreferences | null>();
    vi.mocked(readAccountPreferences).mockReturnValue(read.promise);
    const hook = await mount();
    await hook.rerender(null);
    await act(async () => { read.resolve(remote); });
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

  it("does not repeat initial uploads under StrictMode", async () => {
    vi.mocked(readAccountPreferences).mockResolvedValue(null);
    const hook = await mount("a", true);
    expect(hook.current.preferences).toEqual(defaults);
    expect(writeAccountPreferences).toHaveBeenCalledTimes(1);
  });
});

function noop() {}
