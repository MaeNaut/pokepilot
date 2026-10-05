import { describe, expect, it } from "vitest";
import {
  createCopilotResponsibilityCounts,
  inferCopilotResponsibilities,
} from "./copilotResponsibilities";

describe("copilot responsibilities", () => {
  it("summarizes exact Ability and move mechanics without species rules", () => {
    expect(
      inferCopilotResponsibilities({
        abilities: [
          {
            id: "future-priority-shield",
            effect:
              "Priority moves used by opposing Pokemon targeting this Pokemon or its allies are prevented from having an effect.",
          },
          {
            id: "friendguard",
            effect:
              "This Pokemon's allies receive 3/4 damage from other Pokemon's attacks.",
          },
        ],
        moves: [
          {
            id: "followme",
            effect:
              "The user becomes the center of attention, forcing all attacks to target it.",
          },
          {
            id: "helpinghand",
            effect: "The target's next attack has 1.5x power.",
          },
          {
            id: "trickroom",
            effect: "For 5 turns, slower Pokemon move first.",
          },
        ],
      }),
    ).toEqual([
      "attack-redirection",
      "ally-damage-reduction",
      "priority-denial",
      "ally-damage-amplification",
      "turn-order-control",
    ]);
  });

  it("counts each responsibility once per configured set", () => {
    const counts = createCopilotResponsibilityCounts([
      ["attack-redirection", "attack-redirection", "priority-denial"],
      ["attack-redirection", "ally-damage-reduction"],
    ]);

    expect(counts).toMatchObject({
      "attack-redirection": 2,
      "ally-damage-reduction": 1,
      "priority-denial": 1,
      "ally-damage-amplification": 0,
    });
  });

  it("recognizes conditional Psychic Terrain protection without treating all terrain as priority denial", () => {
    expect(inferCopilotResponsibilities({ abilities: [{ id: "Psychic Surge" }] }))
      .toEqual(["priority-denial"]);
    expect(inferCopilotResponsibilities({ moves: [{ id: "Psychic Terrain" }] }))
      .toEqual(["priority-denial"]);
    expect(inferCopilotResponsibilities({
      abilities: [{ id: "Grassy Surge" }], moves: [{ id: "Electric Terrain" }],
    })).not.toContain("priority-denial");
    expect(inferCopilotResponsibilities({
      abilities: [{ id: "psychicsurge" }], moves: [{ id: "psychicterrain" }],
    })).toEqual(["priority-denial"]);
  });
});
