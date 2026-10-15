import { expect, it } from "vitest";
import { calculateCopilotEstimate } from "./copilotEstimateEngine";
import type { CopilotAnalysisRequest } from "./copilotContracts";
import { createPokePilotPromptParts } from "../../server/pokepilotPromptParts";

function request(members = 6): CopilotAnalysisRequest {
  return {
    version: 35, locale: "ko", scope: "team", battleFormat: "singles", teamName: "Estimate test", selectedSlot: 0,
    typeLabels: [], megaOptions: [], candidateFilters: [], recommendationCandidates: [],
    mechanics: { moves: [], abilities: [], items: [] },
    sets: Array.from({ length: members }, (_, slotIndex) => ({
      slotIndex, pokemonId: `pokemon-${slotIndex}`, moves: [], megaEvolution: null,
      ability: null, item: null, defensiveProfile: { weakTo: [], resists: [], immuneTo: [] },
    })),
    diagnostics: { filledSlots: members },
  } as unknown as CopilotAnalysisRequest;
}

it("counts the assembled prompt and schema, not just JSON length or team size", () => {
  const base = request();
  const estimate = calculateCopilotEstimate(base, "low")!;
  expect(estimate.inputTokens).toBeGreaterThan(1000);
  const expanded = { ...base, teamName: "Additional unique context and tactics. ".repeat(400) };
  const larger = calculateCopilotEstimate(expanded, "low")!;
  expect(larger.inputTokens).toBeGreaterThan(estimate.inputTokens);
  expect(larger.costUsd[0]).toBeGreaterThan(estimate.costUsd[0]);
  expect(larger.seconds[1]).toBeGreaterThanOrEqual(estimate.seconds[1]);
});

it("accounts for team size and Singles/Doubles without mutating the request", () => {
  const base = request();
  const original = JSON.stringify(base);
  const full = calculateCopilotEstimate(base, "low")!;
  const small = calculateCopilotEstimate(request(3), "low")!;
  expect(small.inputTokens).toBeLessThan(full.inputTokens);
  expect(small.totalTokens[1]).toBeLessThan(full.totalTokens[1]);
  expect(small.seconds[1]).toBeLessThan(full.seconds[1]);
  const doubles = calculateCopilotEstimate({ ...base, battleFormat: "doubles" }, "medium")!;
  const singles = calculateCopilotEstimate(base, "medium")!;
  expect(doubles.inputTokens).not.toBe(singles.inputTokens);
  expect(doubles.seconds).not.toEqual(singles.seconds);
  expect(doubles.costUsd[1]).toBeGreaterThan(singles.costUsd[1]);
  expect(JSON.stringify(base)).toBe(original);
});

it.each(["team", "pokemon", "recommendation", "optimization"] as const)("uses current prompt with distinct low/medium output forecasts for %s", (scope) => {
  const data = { ...request(), scope };
  const low = calculateCopilotEstimate(data, "low")!;
  const medium = calculateCopilotEstimate(data, "medium")!;
  expect(low.inputTokens).toBe(medium.inputTokens);
  expect(medium.totalTokens[1]).toBeGreaterThan(low.totalTokens[1]);
  expect(medium.costUsd[1]).toBeGreaterThan(low.costUsd[1]);
  expect(low.totalTokens[0]).toBeLessThanOrEqual(low.totalTokens[1]);
  expect(low.costUsd[0]).toBeGreaterThan(0);
});

it("has no invented estimate for empty input or uncalibrated matchup analysis", () => {
  expect(calculateCopilotEstimate(request(0), "low")).toBeNull();
  expect(calculateCopilotEstimate({ ...request(), scope: "matchup" }, "low")).toBeNull();
});

it("shares the battle rules and compressed encoding used by the real provider request", () => {
  const parts = createPokePilotPromptParts(request());
  const data = JSON.parse(parts.data);
  expect(data.battleRules).toEqual({
    activePokemonPerSide: 1, activeAlliesPerPokemon: 0, selectedPokemonPerBattle: 3, maximumActivatedMegas: 1,
  });
  expect(parts.common).not.toBe("");
  expect(parts.scope).not.toBe("");
  expect(parts.locale).not.toBe("");
});
