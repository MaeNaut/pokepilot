import { describe, expect, it } from "vitest";
import type { PokemonMove } from "../types";
import { resolveSmogonUsageMoveIds } from "./smogonUsage";

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
