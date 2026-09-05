import { afterEach, describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisResponse } from "./copilotAnalysis";
import {
  addCopilotHistoryEntry,
  clearCopilotHistoryForTeam,
  copilotHistoryLimits,
  createCopilotHistoryEntry,
  findMatchingCopilotHistoryEntry,
  getStoredCopilotHistory,
  storeCopilotHistory,
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
  version: 1,
  source: "hosted",
  scope: "team",
  title: "Test Team",
  summary: "Summary",
  playstyle: "Balanced",
  strengths: [],
  weaknesses: [],
  recommendations: [],
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

  it("restores Chrome on-device analysis as a distinct source", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const deviceEntry = createCopilotHistoryEntry({
      ...createEntry(3),
      response: { ...response, source: "device" },
    });

    storeCopilotHistory([deviceEntry]);

    expect(getStoredCopilotHistory()).toEqual([deviceEntry]);
  });
});
