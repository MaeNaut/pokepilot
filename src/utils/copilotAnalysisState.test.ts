import { describe, expect, it } from "vitest";
import type { CopilotHistoryEntry } from "./copilotHistory";
import {
  createReadyAnalysisState,
  restoreAnalysisHistory,
  type AnalysisState,
} from "./copilotAnalysisState";

const entry: CopilotHistoryEntry = {
  id: "analysis-1",
  teamKey: "saved:team-1",
  locale: "ko",
  scope: "team",
  battleFormat: "doubles",
  requestFingerprint: "request-1",
  createdAt: "2026-09-07T00:00:00Z",
  usedFallback: true,
  fallbackReason: "connection",
  response: {
    version: 2,
    source: "local",
    scope: "team",
    title: "Team",
    paragraphs: ["Team analysis."],
    recommendations: [],
  },
};

describe("analysis presentation state", () => {
  it.each([
    ["analysis", false, true],
    ["restore", false, false],
    ["selection", true, false],
  ] as const)("creates %s state with the correct reveal and selection flags", (source, selected, reveal) => {
    expect(createReadyAnalysisState(entry, source)).toEqual({
      status: "ready",
      fingerprint: entry.requestFingerprint,
      response: entry.response,
      usedFallback: true,
      fallbackReason: "connection",
      historyEntryId: entry.id,
      locale: "ko",
      isHistorySelection: selected,
      shouldReveal: reveal,
    });
  });

  it("restores one context without changing another team or scope", () => {
    const other: AnalysisState = { status: "loading" };
    const current = { "saved:other:pokemon": other };
    const restored = restoreAnalysisHistory(current, "saved:team-1:team", entry);
    expect(restored["saved:team-1:team"]).toEqual(createReadyAnalysisState(entry, "restore"));
    expect(restored["saved:other:pokemon"]).toBe(other);
    expect(current).toEqual({ "saved:other:pokemon": other });
  });

  it.each<AnalysisState>([
    { status: "loading" },
    { status: "ready", isHistorySelection: true, historyEntryId: "older-entry" },
    { status: "ready", historyEntryId: entry.id, shouldReveal: true },
  ])("does not override a protected state %#", (state) => {
    const current = { context: state };
    expect(restoreAnalysisHistory(current, "context", entry)).toBe(current);
  });

  it("replaces an old automatic result with a locale-matched entry without replaying animation", () => {
    const current = { context: { ...createReadyAnalysisState(entry, "analysis"), error: "old error" } };
    const english = { ...entry, id: "english-1", locale: "en" as const };
    const next = restoreAnalysisHistory(current, "context", english);
    expect(next.context.locale).toBe("en");
    expect(next.context.shouldReveal).toBe(false);
    expect(next.context.error).toBeUndefined();
    expect(current.context.locale).toBe("ko");
  });

  it("clears obsolete fallback metadata when a hosted entry replaces a fallback", () => {
    const hosted = { ...entry, id: "hosted-1", usedFallback: false, fallbackReason: undefined };
    const next = restoreAnalysisHistory({ context: createReadyAnalysisState(entry, "restore") }, "context", hosted);
    expect(next.context.usedFallback).toBe(false);
    expect(next.context.fallbackReason).toBeUndefined();
  });
});
