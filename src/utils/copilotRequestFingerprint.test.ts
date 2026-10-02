import { describe, expect, it } from "vitest";
import type { CopilotAnalysisRequest } from "./copilotContracts";
import {
  getCopilotAnalysisCacheFingerprint, getCopilotRequestFingerprint,
  normalizeCopilotRequestFingerprint,
} from "./copilotRequestFingerprint";

const request = {
  scope: "optimization", teamName: "Test", selectedSlot: 0,
  sets: [{ slotIndex: 0, pokemonId: "garchomp", item: "garchompitez" }],
  optimization: null,
} as CopilotAnalysisRequest;
const prepared = {
  ...request, optimization: { mode: "general", candidates: [{ id: "candidate" }] },
} as CopilotAnalysisRequest;

describe("analysis display fingerprints", () => {
  it("does not mark a restored general sample analysis stale before candidates are computed", () => {
    expect(getCopilotRequestFingerprint(request)).toBe(getCopilotRequestFingerprint(prepared));
  });

  it("still detects a changed sample, selected slot, and battle format", () => {
    for (const changed of [
      { ...request, sets: [{ ...request.sets[0], item: "leftovers" }] },
      { ...request, selectedSlot: 1 },
      { ...request, battleFormat: "doubles" },
    ] as CopilotAnalysisRequest[]) {
      expect(getCopilotRequestFingerprint(changed)).not.toBe(getCopilotRequestFingerprint(request));
    }
  });

  it("retains exact matchup context and full AI cache inputs", () => {
    const matchup = { ...prepared, optimization: { ...prepared.optimization, mode: "matchup", opponentPokemonId: "lucario" } } as CopilotAnalysisRequest;
    const changed = { ...matchup, optimization: { ...matchup.optimization, opponentPokemonId: "primarina" } } as CopilotAnalysisRequest;
    expect(getCopilotRequestFingerprint(matchup)).not.toBe(getCopilotRequestFingerprint(changed));
    expect(getCopilotAnalysisCacheFingerprint(request)).not.toBe(getCopilotAnalysisCacheFingerprint(prepared));
  });

  it("ignores lazy recommendation results but still checks user candidate filters", () => {
    const baseline = { ...request, scope: "recommendation", recommendationCandidates: [], candidateFilters: [] } as CopilotAnalysisRequest;
    const ready = { ...baseline, recommendationCandidates: [{ pokemonId: "hippowdon" }] } as CopilotAnalysisRequest;
    expect(getCopilotRequestFingerprint(baseline)).toBe(getCopilotRequestFingerprint(ready));
    expect(getCopilotAnalysisCacheFingerprint(baseline)).not.toBe(getCopilotAnalysisCacheFingerprint(ready));
    expect(getCopilotRequestFingerprint({ ...ready, candidateFilters: [{ slotIndex: 0, types: ["water"], ability: null, moves: [] }] }))
      .not.toBe(getCopilotRequestFingerprint(baseline));
    expect(normalizeCopilotRequestFingerprint(JSON.stringify(ready))).toBe(getCopilotRequestFingerprint(baseline));
  });

  it("normalizes existing full sample fingerprints without discarding history", () => {
    expect(normalizeCopilotRequestFingerprint(JSON.stringify({ ...prepared, teamName: "" })))
      .toBe(getCopilotRequestFingerprint(request));
    expect(normalizeCopilotRequestFingerprint("legacy-test-value")).toBe("legacy-test-value");
    expect(normalizeCopilotRequestFingerprint("null")).toBe("null");
  });
});
