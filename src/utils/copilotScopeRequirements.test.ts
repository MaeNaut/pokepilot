import { describe, expect, it } from "vitest";
import type { TeamMember, TeamSlot } from "../types";
import { getCopilotScopeRequirement } from "./copilotScopeRequirements";

const pokemon = (id: string): TeamMember => ({
  id,
  name: id,
  types: ["normal"],
  roles: [],
});

const teamWith = (...members: TeamMember[]): TeamSlot[] => [
  ...members,
  ...Array<TeamSlot>(6 - members.length).fill(null),
];

describe("PokePilot scope requirements", () => {
  it("requires three active Pokemon for singles team analysis and recommendations", () => {
    const team = teamWith(pokemon("a"), pokemon("b"));

    expect(getCopilotScopeRequirement({
      scope: "team",
      battleFormat: "singles",
      team,
      selectedSlot: 0,
    })).toEqual({ kind: "minimum-team-size", activeCount: 2, requiredCount: 3 });
    expect(getCopilotScopeRequirement({
      scope: "recommendation",
      battleFormat: "singles",
      team,
      selectedSlot: 0,
    })).toEqual({ kind: "minimum-team-size", activeCount: 2, requiredCount: 3 });
  });

  it("requires four active Pokemon for doubles team analysis and recommendations", () => {
    const team = teamWith(pokemon("a"), pokemon("b"), pokemon("c"));

    expect(getCopilotScopeRequirement({
      scope: "team",
      battleFormat: "doubles",
      team,
      selectedSlot: 0,
    })).toEqual({ kind: "minimum-team-size", activeCount: 3, requiredCount: 4 });
    expect(getCopilotScopeRequirement({
      scope: "recommendation",
      battleFormat: "doubles",
      team,
      selectedSlot: 0,
    })).toEqual({ kind: "minimum-team-size", activeCount: 3, requiredCount: 4 });
  });

  it("allows team analysis and recommendations at each format's minimum size", () => {
    expect(getCopilotScopeRequirement({
      scope: "team",
      battleFormat: "singles",
      team: teamWith(pokemon("a"), pokemon("b"), pokemon("c")),
      selectedSlot: 0,
    })).toBeNull();
    expect(getCopilotScopeRequirement({
      scope: "recommendation",
      battleFormat: "doubles",
      team: teamWith(pokemon("a"), pokemon("b"), pokemon("c"), pokemon("d")),
      selectedSlot: 0,
    })).toBeNull();
  });

  it("requires a Pokemon in the currently selected slot for Pokemon analysis", () => {
    const team = teamWith(pokemon("a"), pokemon("b"), pokemon("c"));

    expect(getCopilotScopeRequirement({
      scope: "pokemon",
      battleFormat: "singles",
      team,
      selectedSlot: 4,
    })).toEqual({ kind: "selected-pokemon" });
    expect(getCopilotScopeRequirement({
      scope: "pokemon",
      battleFormat: "singles",
      team,
      selectedSlot: 1,
    })).toBeNull();
  });
});
