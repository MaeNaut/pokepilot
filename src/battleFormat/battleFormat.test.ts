import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATTLE_FORMAT,
  isBattleFormat,
  resolveBattleFormat,
} from "./battleFormat";

describe("battle format", () => {
  it("accepts the supported battle formats", () => {
    expect(isBattleFormat("singles")).toBe(true);
    expect(isBattleFormat("doubles")).toBe(true);
    expect(isBattleFormat("triples")).toBe(false);
  });

  it("falls back to doubles for missing or unsupported values", () => {
    expect(resolveBattleFormat(null)).toBe(DEFAULT_BATTLE_FORMAT);
    expect(resolveBattleFormat("unknown")).toBe(DEFAULT_BATTLE_FORMAT);
  });
});
