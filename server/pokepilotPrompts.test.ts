import { describe, expect, it } from "vitest";
import {
  getPokePilotScopeInstructions,
  pokepilotCommonInstructions,
} from "./pokepilotPrompts";

describe("PokePilot matchup prompt", () => {
  it("keeps candidate Mega conditions and evidence separate from the current state", () => {
    const instructions = getPokePilotScopeInstructions("recommendation");
    expect(instructions).toContain("candidate.megaEvolution is a separate possible state");
    expect(instructions).toContain("keeping that stone");
    expect(instructions).toContain("excluding a replaced target's slot");
    expect(instructions).toContain("mega-ability and mega-type");
    expect(instructions).toContain("competing setters can replace them");
    expect(instructions).toContain("A different item invalidates this projection");
  });
  it("distinguishes exact focused changes, incomplete baselines and slow-role losses", () => {
    const instructions = getPokePilotScopeInstructions("optimization");
    expect(instructions).toContain("item changes only the held item of currentBuild");
    expect(instructions).toContain("retaining currentBuild nature and Stat Points");
    expect(instructions).toContain("Unallocated points remain unallocated");
    expect(instructions).toContain("it never means the Speed number decreased");
    expect(instructions).toContain("aggregate fallback, not form-specific evidence");
    expect(instructions).toContain("shortlist lacks a suitable invested spread");
  });
  it("does not send Doubles sequencing instructions to a Singles team analysis", () => {
    const singles = getPokePilotScopeInstructions("team", "singles");
    expect(singles).toContain("only one active Pokemon per side");
    expect(singles).not.toContain("every unordered pair");
    expect(singles).not.toContain("ordered active pair");
    expect(getPokePilotScopeInstructions("team", "doubles")).toContain("every unordered pair");
    expect(pokepilotCommonInstructions).toContain("alternative users unless");
    expect(pokepilotCommonInstructions).toContain("never simultaneous active effects");
  });
  it("checks public claims and preserves the effective Mega attack role", () => {
    expect(pokepilotCommonInstructions).toContain("final literal-claim check on the public prose");
    expect(pokepilotCommonInstructions).toContain("In Singles, never discuss friendly fire");
    expect(pokepilotCommonInstructions).toContain("similar effects do not make different moves interchangeable");
    expect(pokepilotCommonInstructions).toContain("conditional speed control");
    expect(pokepilotCommonInstructions).toContain("An unused Attack boost does not invalidate");
    expect(pokepilotCommonInstructions).toContain("opposing-room reversal");
    expect(getPokePilotScopeInstructions("optimization")).toContain("sole ability-enhanced same-type attack");
  });
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
