import { describe, expect, it } from "vitest";
import { getPokePilotScopeInstructions } from "./pokepilotPrompts";

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
  });
});
