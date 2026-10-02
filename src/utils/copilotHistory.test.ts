import { afterEach, describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisResponse } from "./copilotAnalysis";
import type { CopilotRecommendationCandidateSnapshot } from "./pokemonRecommendations";
import { getCopilotRequestFingerprint } from "./copilotRequestFingerprint";
import {
  addCopilotHistoryEntry,
  clearStoredCopilotHistory,
  clearCopilotHistoryForTeam,
  copilotHistoryLimits,
  createCopilotHistoryEntry,
  findMatchingCopilotHistoryEntry,
  getStoredCopilotHistory,
  getPendingCopilotHistory,
  storeCopilotHistory,
  storePendingCopilotHistory,
  normalizeCopilotHistoryEntry,
} from "./copilotHistory";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const response: CopilotAnalysisResponse = {
  version: 2,
  source: "hosted",
  scope: "team",
  title: "Test Team",
  paragraphs: ["This is the saved analysis."],
  recommendations: [],
};

const recommendationCandidate: CopilotRecommendationCandidateSnapshot = {
  pokemonId: "hippowdon", displayName: "Hippowdon", types: ["ground"], typeDisplayNames: ["Ground"],
  abilities: [], baseStats: null, speedTier: "slow", requiresMegaStone: false, usageRank: 5,
  commonSet: null, responsibilityIds: [],
  target: {
    mode: "addition", slotIndex: 3, currentPokemonId: null, currentDisplayName: null,
    currentRoleIds: [], currentSetterConceptIds: [], currentAceConceptIds: [],
    currentResponsibilityIds: [], currentSupportElements: [], megaOptionPokemonId: null, allySupportLinks: [],
  },
  fit: {
    weakTo: [], resistsTeamThreats: [], amplifiesTeamThreats: [], addsUnansweredWeaknesses: [],
    coversTypes: [], roleContributions: [], roleRedundancies: [], conceptSynergies: [], conflicts: [],
  },
};

function createEntry(index: number, teamKey = "saved:test") {
  return createCopilotHistoryEntry({
    id: `entry-${index}`,
    teamKey,
    locale: index % 2 === 0 ? "ko" : "en",
    scope: "team",
    battleFormat: "doubles",
    requestFingerprint: `fingerprint-${index}`,
    createdAt: new Date(Date.UTC(2026, 7, 1, 12, index)).toISOString(),
    response: { ...response, title: `Test Team ${index}` },
    usedFallback: false,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PokePilot analysis history", () => {
  it("retains analysis provenance across serialization, even after the current season changes", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const usageSource = { provider: "champions-battle-data" as const, season: "M6", sourceDate: "2026-10-01", generatedAt: "2026-10-01T00:00:00Z", stale: true };
    storeCopilotHistory([{ ...createEntry(1), usageSource }]);
    expect(getStoredCopilotHistory()[0]?.usageSource).toEqual(usageSource);
  });

  it.each([undefined, { provider: "unknown" }, { provider: "champions-battle-data", season: "M6", sourceDate: "invalid", generatedAt: "invalid" }])(
    "keeps older analysis usable without inventing statistics provenance: %j", (usageSource) => {
      const restored = normalizeCopilotHistoryEntry({ ...createEntry(1), usageSource });
      expect(restored?.response.title).toBe("Test Team 1");
      expect(restored?.usageSource).toBeUndefined();
    },
  );
  it.each([false, true])("restores recommendation cards from %s legacy metadata", (legacy) => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const extraCandidate = { ...recommendationCandidate, pokemonId: "gyarados", displayName: "Gyarados" };
    const input = { scope: "recommendation", teamName: "Test", recommendationCandidates: [recommendationCandidate, extraCandidate] };
    const entry = {
      ...createEntry(1), scope: "recommendation" as const,
      requestFingerprint: JSON.stringify(input),
      response: {
        ...response, scope: "recommendation" as const,
        recommendations: [{ id: "hippowdon", title: "Hippowdon", reason: "Sand", priority: "high" as const }],
        ...(legacy ? {} : { recommendationCandidates: [recommendationCandidate, extraCandidate, { pokemonId: "invalid" } as CopilotRecommendationCandidateSnapshot] }),
      },
    };
    storeCopilotHistory([entry]);
    const restored = getStoredCopilotHistory()[0];
    expect(restored.response.recommendationCandidates).toEqual([recommendationCandidate]);
    expect(restored.requestFingerprint).toBe(getCopilotRequestFingerprint(input as unknown as import("./copilotContracts").CopilotAnalysisRequest));
  });

  it("clears account-scoped local history on sign-out", () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("localStorage", storage);
    storeCopilotHistory([createEntry(1)]);
    storage.setItem("pokepilot:analysis-history.account.v1", "account-a");
    storePendingCopilotHistory({ accountId: "account-a", baseline: [], items: [createEntry(1)] });

    clearStoredCopilotHistory();

    expect(getStoredCopilotHistory()).toEqual([]);
    expect(storage.getItem("pokepilot:analysis-history.account.v1")).toBeNull();
    expect(getPendingCopilotHistory()).toBeNull();
  });

  it("keeps pending analysis entries and their baseline across a reload", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const pending = { accountId: "account-a", baseline: [createEntry(1)], items: [createEntry(2)] };
    storePendingCopilotHistory(pending);
    expect(getPendingCopilotHistory()).toEqual(pending);
  });

  it("persists validated analysis records and restores an exact locale match", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const koreanEntry = {
      ...createEntry(2),
      usedFallback: true,
      fallbackReason: "invalid-response" as const,
    };
    const englishEntry = createEntry(1);

    storeCopilotHistory([koreanEntry, englishEntry]);
    const restored = getStoredCopilotHistory();

    expect(restored).toEqual([koreanEntry, englishEntry]);
    expect(
      findMatchingCopilotHistoryEntry(
        restored,
        "saved:test",
        "team",
        "ko",
        "fingerprint-2",
      ),
    ).toEqual(koreanEntry);
  });

  it("keeps measured execution data with saved analyses", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const execution = { durationMs: 12_400, totalTokens: 1_840, estimatedCostUsd: 0.0018 };
    const entry = { ...createEntry(1), execution };
    storeCopilotHistory([entry]);
    expect(getStoredCopilotHistory()[0]?.execution).toEqual(execution);
  });

  it("keeps low and medium results separate for the same team request", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const low = { ...createEntry(2), reasoningEffort: "low" as const };
    const medium = { ...createEntry(2), id: "entry-medium", reasoningEffort: "medium" as const };
    storeCopilotHistory([medium, low]);
    const restored = getStoredCopilotHistory();
    expect(findMatchingCopilotHistoryEntry(restored, low.teamKey, low.scope, low.locale, low.requestFingerprint, "low")).toEqual(low);
    expect(findMatchingCopilotHistoryEntry(restored, low.teamKey, low.scope, low.locale, low.requestFingerprint, "medium")).toEqual(medium);
  });

  it("keeps Sol low separate from Luna low, including stored history", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const luna = { ...createEntry(2), reasoningEffort: "low" as const };
    const sol = { ...createEntry(2), id: "entry-sol", reasoningEffort: "low" as const, modelId: "gpt-6-sol" as const };
    storeCopilotHistory([sol, luna]);
    const restored = getStoredCopilotHistory();
    expect(findMatchingCopilotHistoryEntry(restored, luna.teamKey, luna.scope, luna.locale, luna.requestFingerprint, "low", "gpt-6-luna")).toEqual(luna);
    expect(findMatchingCopilotHistoryEntry(restored, sol.teamKey, sol.scope, sol.locale, sol.requestFingerprint, "low", "gpt-6-sol")).toEqual(sol);
  });

  it("limits each team and supports clearing only that team's records", () => {
    const otherTeamEntry = createEntry(99, "saved:other");
    const entries = Array.from(
      { length: copilotHistoryLimits.perTeam + 2 },
      (_, index) => createEntry(index),
    ).reduce(addCopilotHistoryEntry, [otherTeamEntry]);

    expect(entries.filter((entry) => entry.teamKey === "saved:test")).toHaveLength(
      copilotHistoryLimits.perTeam,
    );
    expect(clearCopilotHistoryForTeam(entries, "saved:test")).toEqual([
      otherTeamEntry,
    ]);
  });

  it("ignores malformed stored payloads", () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem(
      "pokepilot:analysis-history:v1",
      JSON.stringify({ version: 1, entries: [{ id: "broken" }] }),
    );

    expect(getStoredCopilotHistory()).toEqual([]);
  });

  it("persists supported hosted quality warnings", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const warnedEntry = createCopilotHistoryEntry({
      ...createEntry(3),
      response: {
        ...response,
        qualityWarnings: ["grounding-incomplete", "content-repaired"],
      },
    });

    storeCopilotHistory([warnedEntry]);

    expect(getStoredCopilotHistory()[0]?.response.qualityWarnings).toEqual([
      "grounding-incomplete",
      "content-repaired",
    ]);
  });

  it("migrates section-based history into narrative paragraphs", () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const legacyEntry = {
      ...createEntry(1),
      response: {
        version: 1,
        source: "hosted",
        scope: "team",
        title: "Legacy Team",
        summary: "This team has a clear central plan.",
        playstyle: "Balance",
        strengths: ["Its opening is reliable.", "Its damage is varied."],
        weaknesses: ["It still needs a safer switch-in."],
        recommendations: [],
      },
    };

    storage.setItem(
      "pokepilot:analysis-history:v1",
      JSON.stringify({ version: 1, entries: [legacyEntry] }),
    );

    expect(getStoredCopilotHistory()[0]?.response).toMatchObject({
      version: 2,
      title: "Legacy Team",
      paragraphs: [
        "This team has a clear central plan.",
        "Its opening is reliable. Its damage is varied.",
        "It still needs a safer switch-in.",
      ],
    });
  });

  it("drops obsolete optimization records without clearing other history", () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const teamEntry = createEntry(2);
    const obsoleteOptimizationEntry = {
      ...createEntry(1),
      scope: "optimization",
      response: {
        ...response,
        scope: "optimization",
        optimizationCandidates: [{ id: "legacy-direction-candidate" }],
      },
    };

    storage.setItem(
      "pokepilot:analysis-history:v1",
      JSON.stringify({
        version: 1,
        entries: [obsoleteOptimizationEntry, teamEntry],
      }),
    );

    expect(getStoredCopilotHistory()).toEqual([teamEntry]);
  });
});
