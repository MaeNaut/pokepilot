import { describe, expect, it } from "vitest";
import { createCopilotHistoryEntry, type CopilotHistoryEntry } from "./copilotHistory";
import {
  mergeAccountCopilotHistory,
  mergeAccountTeams,
} from "./accountStorageSync";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  type SavedTeamSummary,
} from "./teamStorage";

function savedTeam(id: string, updatedAt: string): SavedTeamSummary {
  return {
    version: SAVED_TEAM_SCHEMA_VERSION,
    id,
    name: id,
    battleFormat: "singles",
    slots: [],
    bench: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt,
  };
}

function historyEntry(id: string, createdAt: string): CopilotHistoryEntry {
  return createCopilotHistoryEntry({
    id,
    teamKey: "saved:team-a",
    locale: "en",
    scope: "team",
    battleFormat: "singles",
    requestFingerprint: `request-${id}`,
    createdAt,
    response: {
      version: 2,
      source: "hosted",
      scope: "team",
      title: id,
      paragraphs: [id],
      recommendations: [],
    },
    usedFallback: false,
  });
}

describe("account storage synchronization", () => {
  it("keeps the server team order while taking the newer local revision", () => {
    const remote = [
      savedTeam("team-a", "2026-09-03T00:00:00.000Z"),
      savedTeam("team-b", "2026-09-02T00:00:00.000Z"),
    ];
    const local = [
      { ...savedTeam("team-a", "2026-09-04T00:00:00.000Z"), name: "Updated team" },
      savedTeam("team-c", "2026-09-04T00:00:00.000Z"),
    ];

    expect(mergeAccountTeams(remote, local)).toMatchObject([
      { id: "team-a", name: "Updated team" },
      { id: "team-b" },
      { id: "team-c" },
    ]);
  });

  it("deduplicates history records and retains the newest entries first", () => {
    const remote = [
      historyEntry("remote", "2026-09-02T00:00:00.000Z"),
      historyEntry("shared", "2026-09-01T00:00:00.000Z"),
    ];
    const local = [
      historyEntry("local", "2026-09-04T00:00:00.000Z"),
      historyEntry("shared", "2026-09-03T00:00:00.000Z"),
    ];

    expect(mergeAccountCopilotHistory(remote, local).map((entry) => entry.id)).toEqual([
      "local",
      "shared",
      "remote",
    ]);
  });
});
