// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { reviewHostedCopilotAnalysis } from "../../server/pokepilotAnalysisValidation";
import { useCopilotAnalysisSession } from "../hooks/useCopilotAnalysisSession";
import { LocalizationContext, type LocalizationContextValue } from "../i18n/LocalizationContext";
import { getUiTranslation } from "../i18n/translations";
import { renderHook } from "../test/renderHook";
import { getStoredCopilotHistory } from "../utils/copilotHistory";
import type { CopilotAnalysisRequest, CopilotAnalysisResponse, CopilotExecutionInfo } from "../utils/copilotContracts";
import { CopilotAnalysisResult } from "./CopilotAnalysisResult";

vi.mock("../api/accountStorage", () => ({
  readAccountCopilotHistory: vi.fn(), writeAccountCopilotHistory: vi.fn(),
}));
vi.mock("../api/pokeApi", () => ({ fetchPokemon: vi.fn(async () => { throw new Error("No network in DOM QA"); }) }));

const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => { localStorage.clear(); });
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.unstubAllGlobals();
});

const cases = (["ko", "en"] as const).flatMap(locale =>
  (["pokemon", "team", "recommendation", "optimization"] as const).map(scope => ({ locale, scope })),
);

it.each(cases)("preserves $locale $scope from review through display and history reload", async ({ locale, scope }) => {
  const example = JSON.parse(readFileSync(`public/help/analysis-examples/${locale}-${scope}-low.json`, "utf8")) as {
    response: CopilotAnalysisResponse; execution: CopilotExecutionInfo;
  };
  const { source: _source, recommendationCandidates = [], optimizationCandidates = [], ...analysis } = example.response;
  expect(_source).toBe("hosted");
  const request = {
    scope, locale, selectedSlot: 0, teamName: "Validation QA", battleFormat: "singles", sets: [],
    recommendationCandidates, optimization: { candidates: optimizationCandidates },
  } as unknown as CopilotAnalysisRequest;
  const raw = structuredClone(analysis);
  if (scope === "recommendation" || scope === "optimization") {
    raw.recommendations.unshift({ id: "not-a-supplied-candidate", title: "Invalid action", reason: "Must not be applied.", priority: "high" });
  }
  // Malformed private evidence must not destroy a valid public answer.
  const reviewed = reviewHostedCopilotAnalysis({ analysis: raw, strategyAudit: null }, request);
  expect(reviewed.analysis).toEqual(analysis);
  expect(reviewed.qualityWarnings).toContain("grounding-incomplete");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    ok: true, analysis: reviewed.analysis, metadata: { execution: example.execution },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  const mountSession = async () => {
    const hook = await renderHook(() => useCopilotAnalysisSession({
      accountId: null, savedTeamId: "validator-qa", request, locale,
      battleFormat: "singles", failedMessage: "Failed",
    }), undefined);
    cleanups.push(hook.unmount);
    return hook;
  };
  const first = await mountSession();
  await act(async () => { await first.current.analyze(); });
  expect(first.current.analysisState.status).toBe("ready");
  expect(first.current.response?.paragraphs).toEqual(analysis.paragraphs);
  expect(fetchMock).toHaveBeenCalledOnce();
  const stored = getStoredCopilotHistory();
  expect(stored).toHaveLength(1);
  expect(stored[0].response.recommendations).toEqual(analysis.recommendations);
  expect(stored[0].execution).toEqual(example.execution);
  expect(JSON.stringify(stored)).not.toMatch(/strategyAudit|rawAuditErrors|not-a-supplied-candidate/);
  await first.unmount(); cleanups.pop();

  const reloaded = await mountSession();
  await act(async () => { reloaded.current.selectHistory(reloaded.current.teamHistory[0]); });
  expect(reloaded.current.response?.paragraphs).toEqual(analysis.paragraphs);
  expect(reloaded.current.analysisState.execution).toEqual(example.execution);
  expect(fetchMock).toHaveBeenCalledOnce();
  const response = reloaded.current.response!;
  const localization: LocalizationContextValue = {
    locale, setLocale: () => {}, t: (key, variables) => getUiTranslation(locale, key, variables),
    gameName: (_category, _id, fallback) => fallback, gameDescription: (_category, _id, fallback) => fallback,
    moveTag: tag => tag, pokemonName: ({ fallback }) => fallback, pokemonFormName: (_id, fallback) => fallback,
  };
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const props: ComponentProps<typeof CopilotAnalysisResult> = {
    response, scope, execution: reloaded.current.analysisState.execution,
    usedFallback: false, fallbackMessage: "Must not be shown", isStale: false,
    isLanguageMismatch: false, isAnalyzeDisabled: false, shouldReveal: false, onRevealStart: () => {},
    recommendationCandidates: response.recommendationCandidates ?? [],
    optimizationCandidates: response.optimizationCandidates ?? [],
    selectingCandidateId: null, savingCandidateId: null, candidateApplyFailure: null, candidateSaveStatus: null,
    optimizationCurrentItemDisplayName: null, optimizationActionStatus: null,
    onAnalyze: vi.fn(), onSelectCandidate: vi.fn(), onSaveCandidate: vi.fn(),
    onApplyOptimizationCandidate: vi.fn(), onSaveOptimizationCandidate: vi.fn(),
  };
  await act(async () => { root.render(<LocalizationContext.Provider value={localization}><CopilotAnalysisResult {...props} /></LocalizationContext.Provider>); });
  const localize = (text: string) => locale === "ko"
    ? text.replace(/\b(\d+)\s+Stat Points?\b/gi, "노력치 $1").replace(/\bStat Points?\b/gi, "노력치") : text;
  expect([...container.querySelectorAll(".copilot-narrative-copy p")].map(p => p.textContent)).toEqual(analysis.paragraphs.map(localize));
  for (const card of analysis.recommendations) expect(container.textContent).toContain(localize(card.reason));
  expect(container.querySelector(".copilot-fallback-notice")).toBeNull();
  expect(container.textContent).not.toContain("grounding-incomplete");
  expect(container.querySelector(".copilot-execution")).not.toBeNull();
  const cards = container.querySelectorAll("li.is-recommendation");
  expect(cards).toHaveLength(analysis.recommendations.length);
  if (scope === "recommendation") {
    expect(container.querySelectorAll("li.is-candidate-card")).toHaveLength(cards.length);
    await act(async () => { container.querySelectorAll<HTMLButtonElement>(".copilot-candidate-actions button.is-primary").forEach(button => button.click()); });
    expect(vi.mocked(props.onSelectCandidate).mock.calls.map(([id]) => id).sort()).toEqual(analysis.recommendations.map(card => card.id).sort());
  } else if (scope === "optimization") {
    expect(container.querySelectorAll("li.is-optimization-card")).toHaveLength(cards.length);
    await act(async () => { container.querySelectorAll<HTMLButtonElement>(".copilot-optimization-actions button:last-child").forEach(button => button.click()); });
    for (const [candidate] of vi.mocked(props.onSaveOptimizationCandidate).mock.calls) {
      expect(candidate).toEqual(optimizationCandidates.find(entry => entry.id === candidate.id));
    }
    expect(props.onSaveOptimizationCandidate).toHaveBeenCalledTimes(cards.length);
  }
});
