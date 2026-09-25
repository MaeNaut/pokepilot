import { describe, expect, it } from "vitest";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type { PokemonMove } from "../types";
import { filterEditorLegalMoves, getEditorLegalMoveIds } from "./editorMoveLegality";

const legality: ShowdownLegalitySnapshot = {
  pokemonIds: new Set(), knownPokemonIds: new Set(), itemIds: new Set(), abilityByPokemon: new Map(),
  moveByPokemon: new Map([["charizard", new Set(["flamethrower"])], ["charizardmegax", new Set(["dragonclaw"])]]),
  loadedFormatId: "test", dataMod: "test", generatedAt: 0, source: "showdown",
};

describe("editor move legality", () => {
  it("unions base and mega learnsets without mutating either", () => {
    expect(getEditorLegalMoveIds(legality, "charizard-mega-x", undefined, "charizard"))
      .toEqual(new Set(["dragonclaw", "flamethrower"]));
    expect(legality.moveByPokemon.get("charizardmegax")).toEqual(new Set(["dragonclaw"]));
  });
  it("retains known data when one catalog is missing", () => {
    expect(getEditorLegalMoveIds(null, "charizard")).toBeNull();
    expect(getEditorLegalMoveIds(legality, "unknown", undefined, "charizard")).toEqual(new Set(["flamethrower"]));
    expect(getEditorLegalMoveIds(legality, "charizard")).toEqual(new Set(["flamethrower"]));
  });
  it("matches normalized ids or names, leaving fallback policy to the editor", () => {
    const moves: PokemonMove[] = [
      { id: "dragon-claw", name: "Dragon Claw", type: "dragon", power: 80, accuracy: 100, pp: 15, description: "" },
      { id: "localized", name: "Flamethrower", type: "fire", power: 90, accuracy: 100, pp: 15, description: "" },
    ];
    expect(filterEditorLegalMoves(moves, null)).toBe(moves);
    expect(filterEditorLegalMoves(moves, new Set(["flamethrower"]))).toEqual([moves[1]]);
    expect(filterEditorLegalMoves(moves, new Set(["dragonclaw"]))).toEqual([moves[0]]);
    expect(filterEditorLegalMoves(moves, new Set())).toEqual([]);
  });
});
