import { describe, expect, it } from "vitest";
import { createCopilotHistoryEntry, type CopilotHistoryEntry } from "./copilotHistory";
import {
  mergeAccountCopilotHistory,
  mergeAccountCopilotHistoryAfterLocalEdits,
  mergeAccountTeams,
  mergeAccountTeamsAfterLocalEdits,
  reconcileAccountTeams,
  reconcileLegacyAccountTeams,
  reconcileUnclaimedAccountTeams,
  reconcileAccountCopilotHistory,
  resolveAccountTeamConflicts,
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

  it("preserves local team deletions and order after a failed remote read", () => {
    const base = [savedTeam("a", "2026-09-01"), savedTeam("b", "2026-09-01")];
    const local = [base[1], savedTeam("c", "2026-09-02")];
    const remote = [...base, savedTeam("d", "2026-09-02")];
    expect(mergeAccountTeamsAfterLocalEdits(remote, local, base).map((team) => team.id))
      .toEqual(["b", "c", "d"]);
  });

  it("does not resurrect cleared history after a failed remote read", () => {
    const base = [historyEntry("old", "2026-09-01")];
    const remote = [...base, historyEntry("new", "2026-09-02")];
    expect(mergeAccountCopilotHistoryAfterLocalEdits(remote, [], base).map((entry) => entry.id))
      .toEqual(["new"]);
  });

  it("merges independent edits from two devices without discarding either team", () => {
    const original = savedTeam("original", "2026-09-01");
    const result = reconcileAccountTeams(
      [original, savedTeam("desktop", "2026-09-02")],
      [original, savedTeam("mobile", "2026-09-02")],
      [original],
    );
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.map((team) => team.id)).toEqual(["original", "mobile", "desktop"]);
  });

  it("does not call a normalized copy of the same team a concurrent edit", () => {
    const original = savedTeam("team", "2026-09-02");
    const reordered = {
      name: original.name, slots: original.slots, bench: original.bench,
      battleFormat: original.battleFormat, version: original.version, id: original.id,
      createdAt: original.createdAt, updatedAt: original.updatedAt,
    } as SavedTeamSummary;
    const result = reconcileAccountTeams([original], [reordered], []);
    expect(result.conflicts).toEqual([]);
    expect(result.merged).toEqual([original]);
  });

  it("requires an explicit removal when concurrent additions exceed 30 teams", () => {
    const original = Array.from({ length: 29 }, (_, index) => savedTeam(`original-${index}`, "2026-09-01"));
    const remote = [...original, savedTeam("remote", "2026-09-02")];
    const local = [...original, savedTeam("local", "2026-09-02")];
    const result = reconcileAccountTeams(remote, local, original);
    expect(result.merged).toHaveLength(31);
    expect(result.conflicts).toHaveLength(31);
    const keepAll = Object.fromEntries(result.conflicts.map(({ id, remote: there }) => [
      id, there ? "remote" : "local",
    ])) as Record<string, "remote" | "local" | "discard">;
    expect(resolveAccountTeamConflicts(result.merged, result.conflicts, keepAll, "copy")).toBeNull();
    keepAll.remote = "discard";
    expect(resolveAccountTeamConflicts(result.merged, result.conflicts, keepAll, "copy")?.teams)
      .toEqual(local);
  });

  it("asks before replacing two edits to the same team, and can preserve both", () => {
    const original = savedTeam("team", "2026-09-01");
    const here = { ...original, name: "Mobile", updatedAt: "2026-09-02" };
    const there = { ...original, name: "Desktop", updatedAt: "2026-09-03" };
    const result = reconcileAccountTeams([there], [here], [original]);
    expect(result.conflicts).toEqual([{ id: "team", local: here, remote: there }]);
    const resolved = resolveAccountTeamConflicts(result.merged, result.conflicts, { team: "both" }, "(this device)");
    expect(resolved?.teams).toHaveLength(2);
    expect(resolved?.teams.find((team) => team.id === "team")?.name).toBe("Desktop");
    expect(resolved?.copies[0].copy).toMatchObject({ name: "Mobile (this device)" });
    expect(resolved?.copies[0].copy.id).not.toBe("team");
  });

  it("treats a remote deletion and local edit as a choice, but accepts an uncontested deletion", () => {
    const original = savedTeam("team", "2026-09-01");
    const changed = { ...original, name: "Changed" };
    expect(reconcileAccountTeams([], [original], [original])).toEqual({ merged: [], conflicts: [] });
    const result = reconcileAccountTeams([], [changed], [original]);
    expect(result.conflicts).toEqual([{ id: "team", local: changed, remote: null }]);
    expect(resolveAccountTeamConflicts(result.merged, result.conflicts, { team: "local" }, "copy")?.teams)
      .toEqual([changed]);
  });

  it("asks before migrating an old cache that differs from the account copy", () => {
    const stale = savedTeam("deleted-elsewhere", "2026-09-01");
    const remote = savedTeam("new-elsewhere", "2026-09-02");
    expect(reconcileLegacyAccountTeams([remote], [stale])).toEqual({
      merged: [remote],
      conflicts: [
        { id: "deleted-elsewhere", local: stale, remote: null },
        { id: "new-elsewhere", local: null, remote },
      ],
    });
  });

  it("does not silently discard a guest team when first-login libraries exceed capacity", () => {
    const remote = Array.from({ length: 30 }, (_, index) => savedTeam(`remote-${index}`, "2026-09-01"));
    const guest = savedTeam("guest", "2026-09-02");
    const result = reconcileUnclaimedAccountTeams(remote, [guest]);
    expect(result.merged).toEqual(remote);
    expect(result.conflicts).toContainEqual({ id: "guest", local: guest, remote: null });
    const choices: Record<string, "local" | "remote"> =
      Object.fromEntries(result.conflicts.map(({ id }) => [id, "remote"]));
    choices.guest = "local";
    choices[remote[0].id] = "local";
    const resolved = resolveAccountTeamConflicts(result.merged, result.conflicts, choices, "copy");
    expect(resolved?.teams).toHaveLength(30);
    expect(resolved?.teams.map((team) => team.id)).toContain("guest");
    expect(resolved?.teams.map((team) => team.id)).not.toContain("remote-0");
  });

  it("merges new analysis records while respecting records removed on another device", () => {
    const old = historyEntry("old", "2026-09-01");
    const desktop = historyEntry("desktop", "2026-09-02");
    const mobile = historyEntry("mobile", "2026-09-03");
    expect(reconcileAccountCopilotHistory([desktop], [old, mobile], [old]).map((entry) => entry.id))
      .toEqual(["mobile", "desktop"]);
  });
});
