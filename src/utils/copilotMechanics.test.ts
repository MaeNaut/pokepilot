import { describe, expect, it } from "vitest";
import {
  createCopilotMechanicsSnapshot,
  type CopilotMechanicsSetInput,
} from "./copilotMechanics";

function createSet(
  overrides: Partial<CopilotMechanicsSetInput> = {},
): CopilotMechanicsSetInput {
  return {
    abilities: [],
    itemId: null,
    itemDisplayName: null,
    moves: [],
    ...overrides,
  };
}

describe("PokePilot mechanics dictionary", () => {
  it("deduplicates selected mechanics without deriving team strategy", () => {
    const mechanics = createCopilotMechanicsSnapshot([
      createSet({
        abilities: [
          {
            id: "illusion",
            displayName: "Illusion",
            effect: "Appears as the last non-fainted party Pokemon.",
          },
        ],
        itemId: "choicescarf",
        itemDisplayName: "Choice Scarf",
        itemEffect: "Raises Speed but locks the holder into one move.",
        moves: [
          {
            id: "round",
            displayName: "Round",
            description:
              "Power doubles and the user moves immediately after an ally that already used Round this turn.",
            tags: ["Sound", "Sound", "Priority 0"],
          },
        ],
      }),
      createSet({
        moves: [
          {
            id: "round",
            displayName: "Round",
            description:
              "Power doubles and the user moves immediately after an ally that already used Round this turn.",
            tags: ["Sound"],
          },
          {
            id: "hypervoice",
            displayName: "Hyper Voice",
            description: "No additional effect.",
            tags: ["Sound", "Spread: Foes"],
          },
        ],
      }),
    ]);

    expect(mechanics).toEqual({
      moves: [
        {
          id: "round",
          displayName: "Round",
          effect:
            "Power doubles and the user moves immediately after an ally that already used Round this turn.",
          tags: ["Sound", "Priority 0"],
        },
        {
          id: "hypervoice",
          displayName: "Hyper Voice",
          tags: ["Sound", "Spread: Foes"],
        },
      ],
      abilities: [
        {
          id: "illusion",
          displayName: "Illusion",
          effect: "Appears as the last non-fainted party Pokemon.",
        },
      ],
      items: [
        {
          id: "choicescarf",
          displayName: "Choice Scarf",
          effect: "Raises Speed but locks the holder into one move.",
        },
      ],
    });
    expect(Object.keys(mechanics)).not.toContain("interactionFacts");
  });

  it("keeps unknown selected elements instead of inventing fallback effects", () => {
    const mechanics = createCopilotMechanicsSnapshot([
      createSet({
        abilities: [{ id: "newability", displayName: "New Ability" }],
        itemId: "newitem",
        itemDisplayName: "New Item",
        moves: [{ id: "newmove", displayName: "New Move" }],
      }),
    ]);

    expect(mechanics).toEqual({
      moves: [{ id: "newmove", displayName: "New Move" }],
      abilities: [{ id: "newability", displayName: "New Ability" }],
      items: [{ id: "newitem", displayName: "New Item" }],
    });
  });
});
