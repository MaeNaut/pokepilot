// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAccountCopilotHistory, writeAccountCopilotHistory } from "../api/accountStorage";
import { deferred, renderHook } from "../test/renderHook";
import { executeCopilotAnalysis } from "../utils/copilotAnalysisExecution";
import type { CopilotAnalysisRequest } from "../utils/copilotContracts";
import { useCopilotAnalysisSession } from "./useCopilotAnalysisSession";

vi.mock("../api/accountStorage", () => ({ readAccountCopilotHistory: vi.fn(), writeAccountCopilotHistory: vi.fn() }));
vi.mock("../utils/copilotAnalysisExecution", () => ({ executeCopilotAnalysis: vi.fn() }));

const request = { scope: "team", teamName: "Test" } as CopilotAnalysisRequest;
const result: Awaited<ReturnType<typeof executeCopilotAnalysis>> = {
  response: { version: 2, scope: "team", source: "hosted", title: "Test", paragraphs: ["Analysis"], recommendations: [] },
  usedFallback: false,
  fallbackReason: undefined,
};
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(readAccountCopilotHistory).mockResolvedValue([]);
  vi.mocked(writeAccountCopilotHistory).mockResolvedValue(undefined);
  vi.mocked(executeCopilotAnalysis).mockResolvedValue(result);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount() {
  const hook = await renderHook((accountId: string | null) => useCopilotAnalysisSession({
    accountId, savedTeamId: "saved-a", request, locale: "en", battleFormat: "singles", failedMessage: "Failed",
  }), "a" as string | null);
  cleanups.push(hook.unmount);
  return hook;
}

describe("analysis account lifecycle", () => {
  it("persists successful results and clears them on logout", async () => {
    const hook = await mount();
    await act(async () => { await hook.current.analyze(); });
    expect(hook.current.response?.title).toBe("Test");
    expect(hook.current.teamHistory).toHaveLength(1);
    expect(writeAccountCopilotHistory).toHaveBeenCalledTimes(1);
    await hook.rerender(null);
    expect(hook.current.response).toBeUndefined();
    expect(hook.current.teamHistory).toEqual([]);
  });

  it.each([null, "b"])("discards a late success after switching to %s", async (accountId) => {
    const pending = deferred<typeof result>();
    vi.mocked(executeCopilotAnalysis).mockReturnValue(pending.promise);
    const hook = await mount();
    let analysis!: Promise<void>;
    await act(async () => { analysis = hook.current.analyze(); });
    await hook.rerender(accountId);
    await act(async () => { pending.resolve(result); await analysis; });
    expect(hook.current.response).toBeUndefined();
    expect(hook.current.teamHistory).toEqual([]);
    expect(writeAccountCopilotHistory).not.toHaveBeenCalled();
  });

  it("discards a late failure and cooldown from a logged-out account", async () => {
    const pending = deferred<typeof result>();
    vi.mocked(executeCopilotAnalysis).mockReturnValue(pending.promise);
    const hook = await mount();
    let analysis!: Promise<void>;
    await act(async () => { analysis = hook.current.analyze(); });
    const cooldown = vi.mocked(executeCopilotAnalysis).mock.calls[0][2];
    await hook.rerender(null);
    await act(async () => {
      cooldown(60);
      pending.reject(new Error("Old failure"));
      await analysis;
    });
    expect(hook.current.analysisState.status).toBe("idle");
    expect(hook.current.cooldownRemainingSeconds).toBe(0);
  });
});
