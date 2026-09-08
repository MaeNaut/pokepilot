import { describe, expect, it } from "vitest";
import {
  getPokePilotScopeInstructions,
  pokepilotCommonInstructions,
} from "./pokepilotPrompts";

describe("PokePilot matchup prompt", () => {
  it("requires persistent-defense and conditional-power checks", () => {
    const instructions = getPokePilotScopeInstructions("matchup");

    expect(instructions).toContain("persistentSequence");
    expect(instructions).toContain("first paragraph and first recommendation");
    expect(instructions).toContain("ignores the target's defensive stat changes");
    expect(instructions).toContain("Audit conditional power");
    expect(instructions).toContain("selectedMoveIds is empty");
    expect(instructions).toContain("guaranteedActionTurns");
    expect(instructions).toContain("If every member is limited");
    expect(instructions).toContain("does not block damaging moves");
    expect(instructions).toContain("never expose them");
    expect(instructions).toContain("Every matchup member has a state");
    expect(instructions).toContain("mutually exclusive Mega option");
  });

  it("protects compatible supported Mega axes during replacement analysis", () => {
    const instructions = getPokePilotScopeInstructions("recommendation");

    expect(instructions).toContain("allySupportLinks");
    expect(instructions).toContain("currentSupportElements");
    expect(instructions).toContain("recipient compatibility");
    expect(instructions).toContain("both a Mega option and a compatible ally-support link");
    expect(instructions).toContain("Generic typing, usage, or a small role gain is not enough");
    expect(instructions).toContain("damaging move of that exact category");
  });

  it("keeps current and projected Mega numbers distinct", () => {
    expect(pokepilotCommonInstructions).toContain(
      "baseStats, final stats",
    );
    expect(pokepilotCommonInstructions).toContain(
      "never label a current-form benchmark as a Mega benchmark",
    );
  });
});
