import { describe, expect, it } from "vitest";
import type { CopilotAnalysisRequest } from "../src/utils/copilotAnalysis";
import type { CopilotGroundedModelOutput } from "../src/utils/copilotModelTypes";
import { validateCopilotModelOutput } from "../src/utils/copilotModelValidation";
import { reviewHostedCopilotAnalysis, validateHostedCopilotAnalysis } from "./pokepilotAnalysisValidation";

const request = {
  locale: "en",
  scope: "optimization",
  optimization: { candidates: [{ id: "set-balanced" }, { id: "set-bulky" }, { id: "set-fast" }] },
} as CopilotAnalysisRequest;

function createOutput(ids = ["set-balanced"]): CopilotGroundedModelOutput {
  return {
    analysis: {
      version: 2, scope: "optimization", title: "Compare the supplied options",
      paragraphs: ["Keep the current role in mind."],
      recommendations: ids.map((id) => ({ id, title: "Consider this option.", reason: "Weigh the tradeoff.", priority: "medium" })),
    },
    strategyAudit: { plans: [], interactions: [], facts: [], candidateFacts: [], recommendationEvidence: [] },
  };
}

describe("hosted validation boundaries", () => {
  it.each([
    "Hurricane has 50% accuracy in harsh sunlight.",
    "Dark Pulse has a 20% chance to make the target flinch.",
    "폭풍은 햇살 아래에서 명중률이 50%가 됩니다.",
    "악의파동의 20% 풀죽음 효과를 잃고, 용성군 사용 후 특수공격이 하락합니다.",
    "An OHKO has not been verified for this set.",
    "The spread has 14.5% usage, not the popularity of the complete set.",
    "확정 2타인지는 검증하지 않았습니다.",
    "Guaranteed 2HKO after investment. Keep the support role intact.",
    "The set-balanced candidate keeps the selected role.",
  ])("preserves prose without pretending to certify it: %s", (text) => {
    const output = createOutput();
    output.analysis.paragraphs = [text, text];
    output.analysis.recommendations[0].title = text;
    output.analysis.recommendations[0].reason = text;
    const before = structuredClone(output);
    const reviewed = reviewHostedCopilotAnalysis(output, request);
    expect(reviewed.analysis).toEqual(before.analysis);
    expect(validateHostedCopilotAnalysis(output, request)).toEqual(before.analysis);
    expect(output).toEqual(before);
    expect(reviewed.qualityWarnings).toEqual([]);
    expect(reviewed.diagnostics).toMatchObject({ proseVerified: false, auditNormalized: false });
  });

  it("does not hide unexpected calculator audit entries", () => {
    const output = createOutput();
    output.strategyAudit.plans.push({ id: "unused", lineupSlotIndexes: [], leadSlotIndexes: [], backlineSlotIndexes: [], actions: [] });
    const reviewed = reviewHostedCopilotAnalysis(output, request);
    expect(reviewed.analysis).toEqual(output.analysis);
    expect(reviewed.qualityWarnings).toEqual(["grounding-incomplete"]);
    expect(reviewed.diagnostics.rawAuditErrors).toEqual(reviewed.diagnostics.auditErrors);
    expect(reviewed.diagnostics.auditNormalized).toBe(false);
    expect(() => validateHostedCopilotAnalysis(output, request)).toThrow("invalid response");
  });

  it("reports raw audit failures separately from harmless unary-slot normalization", () => {
    const output = createOutput([]);
    output.analysis.scope = "pokemon";
    output.strategyAudit.facts = [{
      id: "ground", kind: "weak-to", subjectSlotIndex: 0, objectSlotIndex: 0, state: "current", valueId: "ground",
    }];
    const pokemonRequest = { scope: "pokemon", selectedSlot: 0, typeLabels: [], sets: [{
      slotIndex: 0, displayName: "Archaludon", moves: [],
      defensiveProfile: { weaknesses: [{ type: "ground", multiplier: 2 }], resistances: [], immunities: [] },
    }] } as unknown as CopilotAnalysisRequest;
    const reviewed = reviewHostedCopilotAnalysis(output, pokemonRequest);
    expect(reviewed.diagnostics.rawAuditErrors.length).toBeGreaterThan(0);
    expect(reviewed.diagnostics.auditErrors).toEqual([]);
    expect(reviewed.diagnostics.auditNormalized).toBe(true);
    expect(reviewed.diagnostics.proseVerified).toBe(false);
    expect(output.strategyAudit.facts[0].objectSlotIndex).toBe(0);
  });

  it("keeps uncited contradictory facts visible internally without blocking public prose", () => {
    const output = createOutput([]);
    output.analysis.scope = "pokemon";
    output.strategyAudit.facts = [{
      id: "false-weakness", kind: "weak-to", subjectSlotIndex: 0, objectSlotIndex: -1, state: "current", valueId: "fire",
    }];
    const pokemonRequest = { scope: "pokemon", selectedSlot: 0, typeLabels: [], sets: [{
      slotIndex: 0, displayName: "Archaludon", moves: [],
      defensiveProfile: { weaknesses: [{ type: "ground", multiplier: 2 }], resistances: [], immunities: [] },
    }] } as unknown as CopilotAnalysisRequest;
    const reviewed = reviewHostedCopilotAnalysis(output, pokemonRequest);
    expect(reviewed.analysis).toEqual(output.analysis);
    expect(reviewed.qualityWarnings).toEqual(["grounding-incomplete"]);
    expect(reviewed.diagnostics.auditErrors).toContain("strategyAudit.facts[0] contradicts the supplied defensive profile.");
    expect(reviewed.diagnostics.rawAuditErrors).toEqual(reviewed.diagnostics.auditErrors);
    expect(reviewed.diagnostics.auditNormalized).toBe(false);
    expect(() => validateHostedCopilotAnalysis(output, pokemonRequest)).toThrow("invalid response");
  });

  it("accepts one to three known sample candidates", () => {
    for (const ids of [["set-balanced"], ["set-balanced", "set-bulky", "set-fast"]]) {
      expect(validateHostedCopilotAnalysis(createOutput(ids), request).recommendations.map(r => r.id)).toEqual(ids);
    }
  });

  it.each([[], ["invented"], ["set-balanced", "set-balanced"]].map(ids => ({ ids })))("rejects invalid strict action lists: $ids", ({ ids }) => {
    expect(() => validateHostedCopilotAnalysis(createOutput(ids), request)).toThrow("invalid candidate list");
  });

  it("filters unknown and duplicate actions without editing retained prose", () => {
    const output = createOutput(["set-balanced", "invented", "set-balanced", "set-bulky"]);
    const reviewed = reviewHostedCopilotAnalysis(output, request);
    expect(reviewed.analysis.recommendations).toEqual([output.analysis.recommendations[0], output.analysis.recommendations[3]]);
    expect(reviewed.analysis.paragraphs).toEqual(output.analysis.paragraphs);
    expect(reviewed.qualityWarnings).toEqual(["recommendations-adjusted"]);
    expect(reviewed.diagnostics).toMatchObject({ suppliedRecommendations: 4, retainedRecommendations: 2 });
  });

  it("rejects an actionable response with no usable candidate", () => {
    expect(() => reviewHostedCopilotAnalysis(createOutput(["invented"]), request)).toThrow("no usable candidate");
  });

  it("does not manufacture a different move explanation", () => {
    const output = createOutput(["move-solarbeam"]);
    output.analysis.recommendations[0].reason = "Replace Hurricane with Solar Beam while keeping Weather Ball.";
    const moveRequest = { ...request, optimization: { candidates: [{
      id: "move-solarbeam", moveChanges: [{ currentMoveDisplayName: "Weather Ball", optimizedMoveDisplayName: "Solar Beam" }],
    }] } } as CopilotAnalysisRequest;
    const reviewed = reviewHostedCopilotAnalysis(output, moveRequest);
    expect(reviewed.analysis).toEqual(output.analysis);
    expect(reviewed.diagnostics.proseVerified).toBe(false);
    expect(moveRequest.optimization!.candidates[0].moveChanges[0].currentMoveDisplayName).toBe("Weather Ball");
  });

  it("keeps a renderable answer when its private audit is absent", () => {
    const output = createOutput().analysis;
    const reviewed = reviewHostedCopilotAnalysis(output, request);
    expect(reviewed.analysis).toEqual(output);
    expect(reviewed.qualityWarnings).toEqual(["grounding-incomplete"]);
    expect(reviewed.diagnostics.auditErrors.length).toBeGreaterThan(0);
    expect(() => validateHostedCopilotAnalysis(output, request)).toThrow("invalid response");
  });

  it("rejects wrong scope and unexpected public fields", () => {
    const wrongScope = createOutput();
    wrongScope.analysis.scope = "team";
    for (const output of [wrongScope, { ...createOutput().analysis, debug: "not public" }]) {
      expect(() => reviewHostedCopilotAnalysis(output, request)).toThrow("invalid response");
    }
  });

  it.each([null, 7, {}, [], true, "", "   "])("returns a structured failure for malformed paragraph %j", (paragraph) => {
    const output = { ...createOutput().analysis, paragraphs: [paragraph] };
    expect(validateCopilotModelOutput(output).success).toBe(false);
    expect(() => reviewHostedCopilotAnalysis(output, request)).toThrow("invalid response");
    try {
      reviewHostedCopilotAnalysis(output, request);
    } catch (error) {
      expect(error).toMatchObject({ code: "AI_INVALID_RESPONSE" });
      expect(error).not.toBeInstanceOf(TypeError);
    }
  });
});

describe("keeping a team versus losing all actionable recommendations", () => {
  const replacementRequest = {
    locale: "en", scope: "recommendation", diagnostics: { concepts: [] },
    recommendationCandidates: [{ pokemonId: "rotom-wash", target: {
      mode: "replacement", slotIndex: 2, currentPokemonId: "pelipper", currentDisplayName: "Pelipper",
    } }],
  } as unknown as CopilotAnalysisRequest;
  function output(ids: string[]) {
    const result = createOutput(ids);
    result.analysis.scope = "recommendation";
    return result;
  }

  it("allows an originally empty replacement list", () => {
    expect(reviewHostedCopilotAnalysis(output([]), replacementRequest).analysis.recommendations).toEqual([]);
    expect(validateHostedCopilotAnalysis(output([]), replacementRequest).recommendations).toEqual([]);
  });

  it("does not turn a wholly invalid replacement list into keep-current success", () => {
    expect(() => reviewHostedCopilotAnalysis(output(["invented"]), replacementRequest)).toThrow("no usable candidate");
  });

  it("still requires an actionable candidate when filling an empty slot", () => {
    const addition = { ...replacementRequest, recommendationCandidates: [{
      ...replacementRequest.recommendationCandidates[0],
      target: { mode: "addition", slotIndex: 2, currentPokemonId: null, currentDisplayName: null },
    }] } as CopilotAnalysisRequest;
    expect(() => reviewHostedCopilotAnalysis(output([]), addition)).toThrow("no usable candidate");
    expect(() => validateHostedCopilotAnalysis(output([]), addition)).toThrow("invalid candidate list");
  });
});

describe("prose is not repaired using word co-occurrence", () => {
  it.each([
    ["singles", "지진으로 상대를 압박한 뒤 동료에게 교대해 피해를 분산합니다."],
    ["singles", "싱글에서는 양쪽 포켓몬 두 마리가 동시에 필드에 있지만 우리 팀은 한 마리씩 교대합니다."],
    ["singles", "지진은 아군에게 피해를 주지만 상대에게는 효과가 없습니다."],
    ["doubles", "세 마리가 동시에 필드에 나올 수 없으므로 비 요원은 후발 교체로 투입합니다."],
    ["doubles", "세 마리를 동시에 필드에 내보내세요."],
  ] as const)("preserves %s prose even when it cannot certify its meaning", (battleFormat, text) => {
    const output = createOutput(["strategy"]);
    output.analysis.scope = "team";
    output.analysis.paragraphs = [text];
    output.analysis.recommendations[0].reason = text;
    const teamRequest = { ...request, scope: "team", battleFormat, sets: [] } as CopilotAnalysisRequest;
    expect(reviewHostedCopilotAnalysis(output, teamRequest).analysis).toEqual(output.analysis);
  });

  it("does not reverse cautious meta replacement advice", () => {
    const output = createOutput(["rotom-wash"]);
    output.analysis.scope = "matchup";
    output.analysis.recommendations[0].title = "Keep the rain setter.";
    output.analysis.recommendations[0].reason = "Avoid switching to Rotom Wash because losing rain breaks the weather plan.";
    const metaRequest = { ...request, scope: "matchup", optimization: null,
      recommendationCandidates: [{ pokemonId: "rotom-wash", displayName: "Rotom Wash",
        target: { mode: "replacement", slotIndex: 2, currentPokemonId: "pelipper", currentDisplayName: "Pelipper" } }],
      matchup: { mode: "meta", replacementEvidence: [{
        candidatePokemonId: "rotom-wash", targetSlotIndex: 2, threatPokemonId: "archaludon", member: { responseTier: "check" },
      }], threats: [{ opponent: { pokemonId: "archaludon", displayName: "Archaludon" } }] },
    } as unknown as CopilotAnalysisRequest;
    expect(reviewHostedCopilotAnalysis(output, metaRequest).analysis).toEqual(output.analysis);
    expect(validateHostedCopilotAnalysis(output, metaRequest)).toEqual(output.analysis);
  });
});
