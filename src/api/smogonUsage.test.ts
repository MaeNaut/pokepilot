import { describe, expect, it } from "vitest";
import type { PokemonMove } from "../types";
import {
  getSmogonUsageFormatId,
  parseSmogonMovesetText,
  resolveSmogonUsageMoveIds,
} from "./smogonUsage";

function createMove(id: string, name: string): PokemonMove {
  return {
    id,
    name,
    type: "normal",
    category: "Status",
    power: null,
    accuracy: null,
    pp: 10,
    description: "Test move",
    tags: [],
  };
}

describe("Smogon usage move resolution", () => {
  it("maps legacy hyphenated usage IDs to canonical Showdown move IDs", () => {
    const moves = [
      createMove("shadowball", "Shadow Ball"),
      createMove("solarbeam", "Solar Beam"),
      createMove("protect", "Protect"),
      createMove("willowisp", "Will-O-Wisp"),
    ];

    expect(
      resolveSmogonUsageMoveIds(moves, [
        "shadow-ball",
        "solar-beam",
        "protect",
        "will-o-wisp",
      ]),
    ).toEqual(["shadowball", "solarbeam", "protect", "willowisp"]);
  });

  it("skips unavailable moves and continues to the next popular legal move", () => {
    const moves = [
      createMove("protect", "Protect"),
      createMove("shadowball", "Shadow Ball"),
      createMove("solarbeam", "Solar Beam"),
      createMove("willowisp", "Will-O-Wisp"),
    ];

    expect(
      resolveSmogonUsageMoveIds(moves, [
        "unavailable-move",
        "protect",
        "shadow-ball",
        "solar-beam",
        "will-o-wisp",
      ]),
    ).toEqual(["protect", "shadowball", "solarbeam", "willowisp"]);
  });
});

describe("Smogon usage formats", () => {
  it("maps singles and doubles to their Regulation M-B ladders", () => {
    expect(getSmogonUsageFormatId("singles")).toBe(
      "gen9championsbssregmb",
    );
    expect(getSmogonUsageFormatId("doubles")).toBe(
      "gen9championsvgc2026regmb",
    );
  });

  it("keeps several observed item candidates while preserving the top item", () => {
    const snapshot = parseSmogonMovesetText(
      `
 +------------+
 | Incineroar |
 +------------+
 | Raw count: 100
 | Items |
 | Sitrus Berry 50.000% |
 | Assault Vest 25.000% |
 | Safety Goggles 15.000% |
 | Leftovers 5.000% |
 | Choice Band 3.000% |
 | Moves |
 | Fake Out 90.000% |
`,
      "2026-08",
      1630,
    );

    expect(snapshot.sets[0]).toMatchObject({
      itemName: "Sitrus Berry",
      itemNames: [
        "Sitrus Berry",
        "Assault Vest",
        "Safety Goggles",
        "Leftovers",
      ],
    });
  });
});
