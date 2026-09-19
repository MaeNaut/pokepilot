// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import { useMetaThreatAnalysisPlan } from "./useMetaThreatAnalysisPlan";
import { runWorkerTask } from "../utils/workerTask";
import { loadSmogonUsageSets } from "../api/smogonUsage";
import { selectMetaThreatReplacementCandidates } from "../utils/metaThreatRecommendations";
import type { MetaThreatAnalysisPlan } from "../calculator/metaThreatAnalysis";
import { createEmptyBuildState } from "../utils/teamBuildState";
import { analyzeTeam } from "../utils/teamDiagnostics";

vi.mock("../api/smogonUsage", () => ({ loadSmogonUsageSets: vi.fn() }));
vi.mock("../api/showdownData", () => ({ loadShowdownData: vi.fn().mockResolvedValue({}) }));
vi.mock("../calculator/metaThreatAnalysis", () => ({ createMetaThreatAnalysisInput: vi.fn(() => ({})) }));
vi.mock("../utils/pokemonRecommendations", () => ({
  createPokemonRecommendationOptions: vi.fn(() => []),
  createPokemonRecommendationTargets: vi.fn(() => []),
  rankUniversalPokemonRecommendationCandidates: vi.fn(() => []),
}));
vi.mock("../utils/metaThreatRecommendations", () => ({ selectMetaThreatReplacementCandidates: vi.fn() }));
vi.mock("../i18n/useLocalization", () => {
  const localization = { gameName: vi.fn(), pokemonName: vi.fn() };
  return { useLocalization: () => localization };
});
vi.mock("../utils/workerTask", async (original) => ({
  ...await original<typeof import("../utils/workerTask")>(),
  nextAnimationFrame: vi.fn(async (signal: AbortSignal) => !signal.aborted),
  runWorkerTask: vi.fn(),
}));

const options: Omit<Parameters<typeof useMetaThreatAnalysisPlan>[0], "enabled"> = {
  team: [{ id: "garchomp", name: "Garchomp", types: ["dragon", "ground"], roles: [] }],
  buildState: createEmptyBuildState(), battleFormat: "singles",
  pokemonIndex: [], itemIndex: [], abilityIndex: [],
  diagnostics: analyzeTeam([], createEmptyBuildState()), showdownLegality: null,
};
const plan = { threats: [] } as unknown as MetaThreatAnalysisPlan;
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  vi.mocked(loadSmogonUsageSets).mockReset().mockResolvedValue([]);
  vi.mocked(runWorkerTask).mockReset().mockResolvedValue(plan);
  vi.mocked(selectMetaThreatReplacementCandidates).mockReset().mockReturnValue([]);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount() {
  const hook = await renderHook((enabled: boolean) => useMetaThreatAnalysisPlan({ ...options, enabled }), true as boolean);
  cleanups.push(hook.unmount);
  return hook;
}

describe("meta threat task lifecycle", () => {
  it("publishes the plan and replacement candidates", async () => {
    const hook = await mount();
    await act(async () => { await expect(hook.current.run()).resolves.toEqual({ plan, replacementCandidates: [] }); });
    expect(hook.current.plan).toEqual(plan);
    expect(hook.current.loading).toBe(false);
  });

  it("retains a valid plan when optional replacement ranking fails", async () => {
    vi.mocked(selectMetaThreatReplacementCandidates).mockImplementation(() => { throw new Error("ranking failed"); });
    const hook = await mount();
    await act(async () => { await hook.current.run(); });
    expect(hook.current.plan).toEqual(plan);
    expect(hook.current.error).toBe(false);
    expect(hook.current.replacementCandidates).toEqual([]);
  });

  it("reports shared catalog failure without running the Worker", async () => {
    vi.mocked(loadSmogonUsageSets).mockRejectedValue(new Error("offline"));
    const hook = await mount();
    await act(async () => { await hook.current.run(); });
    expect(hook.current.error).toBe(true);
    expect(runWorkerTask).not.toHaveBeenCalled();
  });

  it("ignores a Worker result delivered after the view is disabled", async () => {
    const pending = deferred<MetaThreatAnalysisPlan>();
    vi.mocked(runWorkerTask).mockReturnValue(pending.promise);
    const hook = await mount();
    let result!: ReturnType<typeof hook.current.run>;
    await act(async () => { result = hook.current.run(); });
    await hook.rerender(false);
    await act(async () => { pending.resolve(plan); await result; });
    await hook.rerender(true);
    expect(hook.current.plan).toBeNull();
    expect(hook.current.loading).toBe(false);
    expect(selectMetaThreatReplacementCandidates).not.toHaveBeenCalled();
  });
});
