import { describe, expect, it } from "vitest";
import {
  ACTIVE_TEAM_SIZE,
  MAX_BENCH_POKEMON,
  MAX_SAVED_TEAMS,
  canAddBenchPokemon,
  canAddSavedTeam,
} from "./teamLimits";

describe("team persistence limits", () => {
  it("keeps the active team at six slots", () => {
    expect(ACTIVE_TEAM_SIZE).toBe(6);
  });

  it("allows new saved teams only below the 30-team limit", () => {
    expect(canAddSavedTeam(MAX_SAVED_TEAMS - 1)).toBe(true);
    expect(canAddSavedTeam(MAX_SAVED_TEAMS)).toBe(false);
    expect(canAddSavedTeam(MAX_SAVED_TEAMS + 1)).toBe(false);
  });

  it("allows bench additions only below the six-Pokemon limit", () => {
    expect(canAddBenchPokemon(MAX_BENCH_POKEMON - 1)).toBe(true);
    expect(canAddBenchPokemon(MAX_BENCH_POKEMON)).toBe(false);
    expect(canAddBenchPokemon(MAX_BENCH_POKEMON + 1)).toBe(false);
  });
});
