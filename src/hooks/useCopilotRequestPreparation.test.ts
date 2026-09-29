// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadShowdownData } from "../api/showdownData";
import { renderHook } from "../test/renderHook";
import { createEmptyBuildState } from "../utils/teamBuildState";
import { createTeamAnalysisContext } from "../utils/teamAnalysisContext";
import { createCopilotAnalysisRequest } from "../utils/copilotRequestBuilder";
import { useCopilotRequestPreparation } from "./useCopilotRequestPreparation";

const mocks = vi.hoisted(() => ({
  recommendation: vi.fn(), optimization: vi.fn(), matchup: vi.fn(),
}));
vi.mock("../api/showdownData", () => ({ loadShowdownData: vi.fn() }));
vi.mock("../utils/copilotRequestBuilder", () => ({ createCopilotAnalysisRequest: vi.fn((input) => input) }));
vi.mock("./useCopilotRecommendationCandidates", () => ({
  useCopilotRecommendationCandidates: () => ({ candidates: [], status: "ready", run: mocks.recommendation }),
}));
vi.mock("./useSetOptimizationPlan", () => ({
  useSetOptimizationPlan: () => ({ plan: null, loading: false, run: mocks.optimization }),
}));
vi.mock("./useMetaThreatAnalysisPlan", () => ({
  useMetaThreatAnalysisPlan: () => ({ plan: null, replacementCandidates: [], loading: false, run: mocks.matchup }),
}));
type Options = Parameters<typeof useCopilotRequestPreparation>[0];
const buildState = createEmptyBuildState();
const { diagnostics, validity } = createTeamAnalysisContext({
  team: [], buildState, moveSources: [], legality: null, pokemonIndex: [], itemIndex: [],
});
const options: Options = {
  scope: "team", locale: "en", battleFormat: "singles", teamName: "Test",
  team: [], pokemonIndex: [], itemIndex: [], abilityIndex: [], abilityIndexStatus: "ready",
  showdownLegality: null, showdownLegalityStatus: "ready", selectedSlot: 0,
  buildState, diagnostics, validity,
};
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadShowdownData).mockRejectedValue(new Error("offline"));
  vi.mocked(createCopilotAnalysisRequest).mockImplementation((input) => input as unknown as ReturnType<typeof createCopilotAnalysisRequest>);
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(scope: Options["scope"]) {
  const hook = await renderHook(useCopilotRequestPreparation, { ...options, scope });
  cleanups.push(hook.unmount);
  return hook;
}

it.each(["team", "pokemon"] as const)("uses the existing request for %s even without the optional catalog", async (scope) => {
  const hook = await mount(scope);
  expect(hook.current.isAnalysisPreparing).toBe(false);
  expect(await hook.current.prepareRequest()).toBe(hook.current.request);
  expect(mocks.recommendation).not.toHaveBeenCalled();
});

it("uses freshly ranked candidates rather than a previous render", async () => {
  const candidates = [{ pokemonId: "lucario" }];
  mocks.recommendation.mockResolvedValue(candidates);
  const hook = await mount("recommendation");
  await act(async () => {
    expect(await hook.current.prepareRequest()).toMatchObject({ recommendationCandidates: candidates });
  });
});

it.each([
  ["recommendation", null], ["recommendation", []],
  ["optimization", null], ["optimization", { status: "unavailable", candidates: [] }],
  ["optimization", { status: "ready", candidates: [] }],
  ["matchup", null], ["matchup", { plan: { status: "unavailable" } }],
] as const)("does not submit cancelled or empty %s preparation: %j", async (scope, result) => {
  mocks.recommendation.mockResolvedValue(result);
  mocks.optimization.mockResolvedValue(result);
  mocks.matchup.mockResolvedValue(result);
  const hook = await mount(scope);
  expect(await hook.current.prepareRequest()).toBeNull();
});

it("attaches a ready optimization plan", async () => {
  const plan = { status: "ready", candidates: [{ id: "set" }] };
  mocks.optimization.mockResolvedValue(plan);
  const hook = await mount("optimization");
  expect(await hook.current.prepareRequest()).toMatchObject({ optimizationPlan: plan });
});

it("attaches a ready matchup plan and its replacement candidates", async () => {
  const result = { plan: { status: "ready" }, replacementCandidates: [{ pokemonId: "lucario" }] };
  mocks.matchup.mockResolvedValue(result);
  const hook = await mount("matchup");
  expect(await hook.current.prepareRequest()).toMatchObject({
    optimizationPlan: null, threatPlan: result.plan, threatReplacementCandidates: result.replacementCandidates,
  });
});
