import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LocalizationContext,
  type LocalizationContextValue,
} from "../i18n/LocalizationContext";
import { getUiTranslation } from "../i18n/translations";
import type { CopilotRecommendationCandidateSnapshot } from "../utils/pokemonRecommendations";
import { CopilotAnalysisResult } from "./CopilotAnalysisResult";

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

describe("CopilotAnalysisResult", () => {
  it.each(["en", "ko"] as const)("localizes displayed units without changing stored output and places metrics last (%s)", (locale) => {
    const response = {
      version: 2 as const, source: "hosted" as const, scope: "team" as const,
      title: "Team analysis", paragraphs: ["The analysis body. 32 Stat Points, 1 Stat Point."],
      recommendations: [{ id: "step", title: "Stat Points", reason: "2 Stat Points", priority: "high" as const }],
    };
    const html = renderToStaticMarkup(createElement(LocalizationContext.Provider, { value: {
      ...localization, locale,
      t: (key, variables) => getUiTranslation(locale, key, variables),
    } },
      createElement(CopilotAnalysisResult, {
        response,
        execution: { durationMs: 12_400, totalTokens: 1_840, estimatedCostUsd: 0.0018 },
        scope: "team", usedFallback: false, fallbackMessage: "", isStale: false,
        isLanguageMismatch: false, isAnalyzeDisabled: false, shouldReveal: false,
        onRevealStart: () => undefined, recommendationCandidates: [],
        selectingCandidateId: null, savingCandidateId: null, candidateApplyFailure: null,
        candidateSaveStatus: null, optimizationCandidates: [],
        optimizationCurrentItemDisplayName: null, optimizationActionStatus: null,
        onAnalyze: () => undefined, onSelectCandidate: () => undefined,
        onSaveCandidate: () => undefined, onApplyOptimizationCandidate: () => undefined,
        onSaveOptimizationCandidate: () => undefined,
      }),
    ));
    expect(html.indexOf("The analysis body.")).toBeLessThan(html.indexOf("copilot-execution"));
    expect(html).toContain("1,840");
    expect(html).toContain("$0.0018");
    expect(html).not.toContain("Input tokens");
    expect(html).toContain(locale === "ko" ? "노력치 32, 노력치 1" : "32 Stat Points, 1 Stat Point");
    expect(html).toContain(locale === "ko" ? "노력치 2" : "2 Stat Points");
    if (locale === "ko") expect(html).not.toContain("Stat Point");
    expect(response.paragraphs[0]).toBe("The analysis body. 32 Stat Points, 1 Stat Point.");
    expect(response.recommendations[0].reason).toBe("2 Stat Points");
  });
  it("renders a verified matchup replacement as an actionable Pokemon card", () => {
    const candidate = {
      pokemonId: "arcanine-hisui",
      displayName: "Arcanine Hisui",
      types: ["fire", "rock"],
      usageRank: 38,
      target: {
        mode: "replacement",
        slotIndex: 4,
        currentPokemonId: "basculegion",
        currentDisplayName: "Basculegion Male",
      },
    } as CopilotRecommendationCandidateSnapshot;
    const result = createElement(CopilotAnalysisResult, {
      response: {
        version: 2,
        source: "hosted",
        scope: "matchup",
        title: "Meta threat audit",
        paragraphs: ["Dragonite-Mega remains structurally unsafe."],
        qualityWarnings: ["grounding-incomplete"],
        recommendations: [{
          id: candidate.pokemonId,
          title: "Consider Arcanine Hisui over Basculegion Male.",
          reason: "This is a verified matchup-dependent replacement.",
          priority: "high",
        }],
      },
      scope: "matchup",
      usedFallback: false,
      fallbackMessage: "",
      isStale: false,
      isLanguageMismatch: false,
      isAnalyzeDisabled: false,
      shouldReveal: false,
      onRevealStart: () => undefined,
      recommendationCandidates: [candidate],
      selectingCandidateId: null,
      savingCandidateId: null,
      candidateApplyFailure: null,
      candidateSaveStatus: null,
      optimizationCandidates: [],
      optimizationCurrentItemDisplayName: null,
      optimizationActionStatus: null,
      onAnalyze: () => undefined,
      onSelectCandidate: () => undefined,
      onSaveCandidate: () => undefined,
      onApplyOptimizationCandidate: () => undefined,
      onSaveOptimizationCandidate: () => undefined,
    });
    const html = renderToStaticMarkup(
      createElement(LocalizationContext.Provider, { value: localization }, result),
    );

    expect(html).toContain("is-candidate-card");
    expect(html).toContain("Arcanine Hisui");
    expect(html).toContain("Replace");
    expect(html).toContain("Save to Bench");
    expect(html).not.toContain("Some strategic evidence could not be verified");
  });
});
