import { describe, expect, it } from "vitest";
import {
  getPokePilotScopeInstructions,
  pokepilotCommonInstructions,
} from "./pokepilotPrompts";

describe("PokePilot matchup prompt", () => {
  it("requires allocation, internal-conflict and bounded-comparison checks", () => {
    expect(pokepilotCommonInstructions).toContain("separate nature effects from Stat Point allocation");
    expect(pokepilotCommonInstructions).toContain("item requires full HP");
    expect(pokepilotCommonInstructions).toContain("explain the other's non-Mega role");
    expect(pokepilotCommonInstructions).toContain("Type resistance alone is not proof of a safe switch-in");
    expect(pokepilotCommonInstructions).toContain("not globally optimal");
    expect(getPokePilotScopeInstructions("team")).toContain("separate selections with one Mega each");
  });
  it("requires bounded meta-threat and persistent-mechanics checks", () => {
    const instructions = getPokePilotScopeInstructions("matchup");

    expect(instructions).toContain("persistentSequence");
    expect(instructions).toContain("first paragraph and first recommendation");
    expect(instructions).toContain("ignores the target's defensive stat changes");
    expect(instructions).toContain("Audit conditional power");
    expect(instructions).toContain("guaranteedActionTurns");
    expect(instructions).toContain("representative aggregate usage profile");
    expect(instructions).toContain("usageRank is context");
    expect(instructions).toContain("answerCount and checkCount");
    expect(instructions).toContain("up to three when no answer exists");
    expect(instructions).toContain("at most three verified candidates");
    expect(instructions).toContain("complete supplied loadout");
    expect(instructions).toContain("at most three legal replacement candidates");
    expect(instructions).toContain("the sole deterministic matchup evidence");
    expect(instructions).toContain(
      "Never name a replacement Pokemon outside request.recommendationCandidates",
    );
    expect(instructions).toContain("mutually exclusive Mega projections");
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
