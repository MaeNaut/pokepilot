import { describe, expect, it } from "vitest";
import { createCopilotHistoryEntry, type CopilotHistoryEntry } from "./copilotHistory";
import { mergeAccountCopilotHistory, mergeAccountCopilotHistoryAfterLocalEdits, reconcileAccountCopilotHistory } from "./accountStorageSync";

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

describe("analysis history synchronization", () => {
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

  it("does not resurrect cleared history after a failed remote read", () => {
    const base = [historyEntry("old", "2026-09-01")];
    const remote = [...base, historyEntry("new", "2026-09-02")];
    expect(mergeAccountCopilotHistoryAfterLocalEdits(remote, [], base).map((entry) => entry.id))
      .toEqual(["new"]);
  });

  it("merges new analysis records while respecting records removed on another device", () => {
    const old = historyEntry("old", "2026-09-01");
    const desktop = historyEntry("desktop", "2026-09-02");
    const mobile = historyEntry("mobile", "2026-09-03");
    expect(reconcileAccountCopilotHistory([desktop], [old, mobile], [old]).map((entry) => entry.id))
      .toEqual(["mobile", "desktop"]);
  });
});
