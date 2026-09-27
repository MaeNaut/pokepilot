// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalizationContext, type LocalizationContextValue } from "../i18n/LocalizationContext";
import { getUiTranslation } from "../i18n/translations";
import { CopilotAnalysisResult } from "./CopilotAnalysisResult";

vi.mock("../hooks/useSequentialTextReveal", () => ({
  useSequentialTextReveal: () => ({
    isAnimated: true,
    isComplete: true,
    visibleTexts: ["Team analysis", "The analysis body."],
    activeIndex: null,
  }),
}));

const localization: LocalizationContextValue = {
  locale: "en",
  setLocale: () => undefined,
  t: (key, variables) => getUiTranslation("en", key, variables),
  gameName: (_category, _id, fallback) => fallback,
  gameDescription: (_category, _id, fallback) => fallback,
  moveTag: (tag) => tag,
  pokemonName: ({ fallback }) => fallback,
  pokemonFormName: (_pokemonId, fallback) => fallback,
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("completed analysis execution details", () => {
  it("waits for the final recommendation animation before showing metrics", () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => root.render(createElement(LocalizationContext.Provider, { value: localization },
      createElement(CopilotAnalysisResult, {
        response: {
          version: 2, source: "hosted", scope: "team", title: "Team analysis",
          paragraphs: ["The analysis body."],
          recommendations: [{ id: "step", title: "Step", reason: "Reason", priority: "high" }],
        },
        execution: { durationMs: 12_400, totalTokens: 1_840, estimatedCostUsd: 0.0018 },
        scope: "team", usedFallback: false, fallbackMessage: "", isStale: false,
        isLanguageMismatch: false, isAnalyzeDisabled: false, shouldReveal: true,
        onRevealStart: () => undefined, recommendationCandidates: [],
        selectingCandidateId: null, savingCandidateId: null, candidateApplyFailure: null,
        candidateSaveStatus: null, optimizationCandidates: [],
        optimizationCurrentItemDisplayName: null, optimizationActionStatus: null,
        onAnalyze: () => undefined, onSelectCandidate: () => undefined,
        onSaveCandidate: () => undefined, onApplyOptimizationCandidate: () => undefined,
        onSaveOptimizationCandidate: () => undefined,
      }),
    )));

    expect(container.querySelector(".copilot-execution")).toBeNull();
    const lastRecommendation = container.querySelector("li.is-recommendation");
    expect(lastRecommendation).not.toBeNull();
    act(() => {
      lastRecommendation?.dispatchEvent(new Event("animationend", { bubbles: true }));
      lastRecommendation?.dispatchEvent(new Event("webkitAnimationEnd", { bubbles: true }));
    });
    expect(container.querySelector(".copilot-execution")?.textContent).toContain("1,840");
    act(() => root.unmount());
  });
});
