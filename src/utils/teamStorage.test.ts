import { describe, expect, it } from "vitest";
import type { TeamMember } from "../types";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  createEmptyBuildState,
  createFallbackMember,
  createSavedSlot,
  getCopiedTeamName,
  normalizeSavedTeam,
  serializeTeamSnapshot,
  type SavedTeamSummary,
} from "./teamStorage";

function savedTeam(name: string): SavedTeamSummary {
  return {
    version: SAVED_TEAM_SCHEMA_VERSION,
    id: name.toLowerCase().replace(/ /g, "-"),
    name,
    slots: [],
    bench: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("team storage normalization", () => {
  it("adds an empty bench to older saved-team records", () => {
    const normalized = normalizeSavedTeam({
      id: "legacy-team",
      name: "Legacy Team",
      slots: [null],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(normalized).toMatchObject({
      version: SAVED_TEAM_SCHEMA_VERSION,
      id: "legacy-team",
      bench: [],
    });
  });

  it("rejects malformed records without an id, name, or slot array", () => {
    expect(normalizeSavedTeam({ name: "Missing id", slots: [] })).toBeNull();
    expect(normalizeSavedTeam({ id: "missing-name", slots: [] })).toBeNull();
    expect(normalizeSavedTeam({ id: "missing-slots", name: "Missing slots" })).toBeNull();
  });
});

describe("saved-team helpers", () => {
  it("increments duplicate names case-insensitively", () => {
    const teams = [
      savedTeam("Rain"),
      savedTeam("Rain Copy"),
      savedTeam("rain copy 2"),
    ];

    expect(getCopiedTeamName("Rain", teams)).toBe("Rain Copy 3");
  });

  it("round-trips the Pokemon identity used for offline fallback", () => {
    const member: TeamMember = {
      id: "charizard",
      name: "Charizard",
      types: [],
      roles: [],
      spriteUrl: "art.png",
      iconSpriteUrl: "icon.png",
    };
    const slot = createSavedSlot(member);

    expect(slot).not.toBeNull();
    expect(createFallbackMember(slot!)).toMatchObject({
      id: "charizard",
      name: "Charizard",
      spriteUrl: "art.png",
      iconSpriteUrl: "icon.png",
      source: "local",
    });
  });

  it("serializes empty-slot Pokemon requirements with the team snapshot", () => {
    const buildState = createEmptyBuildState();
    buildState.candidateFiltersBySlot[2] = {
      types: ["fire", "dark"],
      ability: { id: "intimidate", name: "Intimidate" },
      moves: [{ id: "fakeout", name: "Fake Out" }],
    };

    const serialized = serializeTeamSnapshot({
      name: "Candidate Team",
      slots: [null, null, null, null, null, null],
      bench: [],
      buildState,
    });

    expect(JSON.parse(serialized).buildState.candidateFiltersBySlot[2]).toEqual({
      types: ["fire", "dark"],
      ability: { id: "intimidate", name: "Intimidate" },
      moves: [{ id: "fakeout", name: "Fake Out" }],
    });
  });
});
