import { describe, expect, it } from "vitest";
import type { PokemonMove } from "../types";
import {
  findMoveByLookup,
  reconcileMoveIds,
} from "./pokemonMoves";

const moves: PokemonMove[] = [
  {
    id: "kingsshield",
    name: "King's Shield",
    type: "steel",
    category: "Status",
    power: null,
    accuracy: null,
    pp: 10,
    description: "Protects the user.",
  },
  {
    id: "poltergeist",
    name: "Poltergeist",
    type: "ghost",
    category: "Physical",
    power: 110,
    accuracy: 90,
    pp: 5,
    description: "Fails if the target has no held item.",
  },
  {
    id: "shadowsneak",
    name: "Shadow Sneak",
    type: "ghost",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 30,
    description: "Usually goes first.",
  },
  {
    id: "ironhead",
    name: "Iron Head",
    type: "steel",
    category: "Physical",
    power: 80,
    accuracy: 100,
    pp: 15,
    description: "May make the target flinch.",
  },
];

describe("Pokemon move lookup", () => {
  it("matches legacy IDs and display names against canonical Showdown IDs", () => {
    expect(findMoveByLookup(moves, "king's-shield")?.id).toBe("kingsshield");
    expect(findMoveByLookup(moves, "Shadow Sneak")?.id).toBe("shadowsneak");
  });

  it("canonicalizes stored IDs and fills only missing move slots", () => {
    expect(
      reconcileMoveIds(moves, ["king's-shield", "Poltergeist"]),
    ).toEqual(["kingsshield", "poltergeist", "shadowsneak", "ironhead"]);
  });

  it("preserves move slots that the user explicitly cleared", () => {
    expect(
      reconcileMoveIds(moves, ["kingsshield", "", "shadowsneak", ""]),
    ).toEqual(["kingsshield", "", "shadowsneak", ""]);
  });
});
