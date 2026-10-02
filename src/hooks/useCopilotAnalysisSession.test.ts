// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAccountCopilotHistory, writeAccountCopilotHistory } from "../api/accountStorage";
import { deferred, renderHook } from "../test/renderHook";
import { executeCopilotAnalysis } from "../utils/copilotAnalysisExecution";
import type { CopilotAnalysisRequest } from "../utils/copilotContracts";
import { useCopilotAnalysisSession } from "./useCopilotAnalysisSession";
import { CopilotApiError } from "../api/copilotApi";

vi.mock("../api/accountStorage", () => ({ readAccountCopilotHistory: vi.fn(), writeAccountCopilotHistory: vi.fn() }));
vi.mock("../utils/copilotAnalysisExecution", () => ({ executeCopilotAnalysis: vi.fn() }));

const request = { scope: "team", teamName: "Test", battleFormat: "singles", sets: [] } as unknown as CopilotAnalysisRequest;
const result: Awaited<ReturnType<typeof executeCopilotAnalysis>> = {
  response: { version: 2, scope: "team", source: "hosted", title: "Test", paragraphs: ["Analysis"], recommendations: [] },
  usedFallback: false,
  fallbackReason: undefined,
};
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(readAccountCopilotHistory).mockResolvedValue({ value: [], version: '"v1"' });
  vi.mocked(writeAccountCopilotHistory).mockResolvedValue('"v2"');
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
  async function mountDraft() {
    const hook = await renderHook((options: { savedTeamId: string | null; accountId: string; request: CopilotAnalysisRequest }) =>
      useCopilotAnalysisSession({ ...options, locale: "en", battleFormat: "singles", failedMessage: "Failed" }),
    { savedTeamId: null as string | null, accountId: "a", request });
    cleanups.push(hook.unmount);
    return hook;
  }

  it("attaches analysis and its usage to an explicitly saved team before the prop updates", async () => {
    const execution = { durationMs: 11_000, totalTokens: 7_391, estimatedCostUsd: 0.0012 };
    vi.mocked(executeCopilotAnalysis).mockResolvedValue({ ...result, execution });
    const hook = await mountDraft();
    await act(async () => { await hook.current.analyze(request, { teamId: "new-team" }); });
    expect(hook.current.teamHistory).toHaveLength(0);
    await hook.rerender({ savedTeamId: "new-team", accountId: "a", request });
    expect(hook.current.teamHistory).toHaveLength(1);
    expect(hook.current.teamHistory[0]).toMatchObject({ teamKey: "saved:new-team", execution });
    expect(hook.current.response?.title).toBe("Test");
    expect(hook.current.analysisState.execution).toEqual(execution);
  });

  it("keeps a pending analysis attached to its explicitly saved team", async () => {
    const pending = deferred<typeof result>();
    vi.mocked(executeCopilotAnalysis).mockReturnValue(pending.promise);
    const hook = await mountDraft();
    let analysis!: Promise<void>;
    await act(async () => { analysis = hook.current.analyze(request, { teamId: "new-team" }); });
    await hook.rerender({ savedTeamId: "new-team", accountId: "a", request });
    expect(hook.current.analysisState.status).toBe("loading");
    await act(async () => { pending.resolve(result); await analysis; });
    expect(hook.current.teamHistory[0].teamKey).toBe("saved:new-team");
    expect(hook.current.response?.title).toBe("Test");
  });

  it("does not overwrite explicitly selected history during a pending analysis", async () => {
    const hook = await mountDraft();
    await hook.rerender({ savedTeamId: "new-team", accountId: "a", request });
    await act(async () => { await hook.current.analyze(); });
    const selected = hook.current.teamHistory[0];
    const pending = deferred<typeof result>();
    vi.mocked(executeCopilotAnalysis).mockReturnValue(pending.promise);
    let analysis!: Promise<void>;
    await act(async () => { analysis = hook.current.analyze(); });
    await hook.rerender({ savedTeamId: "new-team", accountId: "a", request });
    await act(async () => { hook.current.selectHistory(selected); });
    await act(async () => { pending.resolve({ ...result, response: { ...result.response, title: "Later" } }); await analysis; });
    expect(hook.current.response?.title).toBe("Test");
    expect(hook.current.teamHistory).toHaveLength(2);
  });

  it.each(["same", "different"])("does not move legacy draft history when loading a %s roster", async (roster) => {
    vi.mocked(readAccountCopilotHistory).mockResolvedValue({ value: [{
      id: "legacy", teamKey: "draft:singles:empty", locale: "en", scope: "team", battleFormat: "singles",
      requestFingerprint: JSON.stringify(request), createdAt: "2026-09-30T00:00:00Z", response: result.response, usedFallback: false,
    }], version: '"v1"' });
    const hook = await mountDraft();
    expect(hook.current.teamHistory).toHaveLength(1);
    await hook.rerender({ savedTeamId: "other", accountId: "a", request: roster === "same" ? request : {
      ...request, sets: [{ slotIndex: 0, pokemonId: "garchomp" }] as CopilotAnalysisRequest["sets"],
    } });
    expect(hook.current.teamHistory).toEqual([]);
    expect(hook.current.response).toBeUndefined();
  });

  it("does not send any AI request without a saved team", async () => {
    const hook = await mountDraft();
    await act(async () => { await hook.current.analyze(); });
    expect(executeCopilotAnalysis).not.toHaveBeenCalled();
    expect(hook.current.teamHistory).toEqual([]);
    expect(hook.current.response).toBeUndefined();
  });

  it("restores the original statistics provenance after a history reload", async () => {
    const usageSource = { provider: "champions-battle-data" as const, season: "M6", sourceDate: "2026-10-01", generatedAt: "2026-10-01T00:00:00Z" };
    const hook = await mount();
    await act(async () => { await hook.current.analyze(request, { teamId: "saved-a", usageSource }); });
    expect(hook.current.analysisState.usageSource).toEqual(usageSource);
    const history = hook.current.teamHistory;
    await hook.unmount();
    vi.mocked(readAccountCopilotHistory).mockResolvedValue({ value: history, version: '"v2"' });
    const reloaded = await mount();
    expect(reloaded.current.analysisState.usageSource).toEqual(usageSource);
  });

  it.each([
    ["AI_NOT_CONFIGURED", false],
    ["AI_INVALID_RESPONSE", undefined],
  ] as const)("keeps %s as an error without saving analysis history", async (code, providerAttempted) => {
    vi.mocked(executeCopilotAnalysis).mockRejectedValue(
      new CopilotApiError("failed", code, 502, undefined, providerAttempted),
    );
    const hook = await mount();
    await act(async () => { await hook.current.analyze(); });
    expect(hook.current.analysisState).toMatchObject({ status: "error", errorCode: code });
    expect(hook.current.analysisState.providerAttempted).toBe(providerAttempted);
    expect(hook.current.response).toBeUndefined();
    expect(writeAccountCopilotHistory).not.toHaveBeenCalled();
  });
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

  it("keeps only recommended candidate snapshots when lazy candidate data resets", async () => {
    const candidates = [{ pokemonId: "hippowdon" }, { pokemonId: "gyarados" }] as CopilotAnalysisRequest["recommendationCandidates"];
    const baseline = { ...request, scope: "recommendation", recommendationCandidates: [] } as CopilotAnalysisRequest;
    const prepared = { ...baseline, recommendationCandidates: candidates };
    vi.mocked(executeCopilotAnalysis).mockResolvedValue({ ...result, response: {
      ...result.response, scope: "recommendation", recommendations: [{ id: "hippowdon", title: "Hippowdon", reason: "Sand", priority: "high" }],
    } });
    const hook = await renderHook((input: CopilotAnalysisRequest) => useCopilotAnalysisSession({
      accountId: "a", savedTeamId: "saved-a", request: input, locale: "en", battleFormat: "singles", failedMessage: "Failed",
    }), prepared);
    cleanups.push(hook.unmount);
    await act(async () => { await hook.current.analyze(prepared); });
    expect(hook.current.response?.recommendationCandidates).toEqual([candidates[0]]);
    await hook.rerender(baseline);
    expect(hook.current.isStale).toBe(false);
    expect(hook.current.response?.recommendationCandidates).toEqual([candidates[0]]);
    await hook.rerender({ ...baseline, selectedSlot: 1 });
    expect(hook.current.isStale).toBe(true);
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

  it("discards a late failure from a logged-out account", async () => {
    const pending = deferred<typeof result>();
    vi.mocked(executeCopilotAnalysis).mockReturnValue(pending.promise);
    const hook = await mount();
    let analysis!: Promise<void>;
    await act(async () => { analysis = hook.current.analyze(); });
    await hook.rerender(null);
    await act(async () => {
      pending.reject(new Error("Old failure"));
      await analysis;
    });
    expect(hook.current.analysisState.status).toBe("idle");
  });

  it("keeps an explicitly selected history entry when an older request finishes", async () => {
    const hook = await mount();
    await act(async () => { await hook.current.analyze(); });
    const selected = hook.current.teamHistory[0];
    const pending = deferred<typeof result>();
    vi.mocked(executeCopilotAnalysis).mockReturnValue(pending.promise);
    let analysis!: Promise<void>;
    await act(async () => { analysis = hook.current.analyze(); });
    await act(async () => { hook.current.selectHistory(selected); });
    await act(async () => { pending.resolve({ ...result, response: { ...result.response, title: "New result" } }); await analysis; });
    expect(hook.current.response?.title).toBe(selected.response.title);
    expect(hook.current.analysisState.historyEntryId).toBe(selected.id);
    expect(hook.current.teamHistory).toHaveLength(2);
  });

  it("shows a retired Sol history result while Luna remains the active model", async () => {
    const hook = await mount();
    await act(async () => { await hook.current.analyze(); });
    const legacy = {
      ...hook.current.teamHistory[0], id: "old-sol", modelId: "gpt-6-sol" as const,
      response: { ...hook.current.teamHistory[0].response, title: "Old Sol result" },
    };
    await act(async () => { hook.current.selectHistory(legacy); });
    expect(hook.current.response?.title).toBe("Old Sol result");
    expect(hook.current.analysisState.historyEntryId).toBe(legacy.id);
    expect(hook.current.analysisContextKey).toContain(":gpt-6-luna:");
  });
});
