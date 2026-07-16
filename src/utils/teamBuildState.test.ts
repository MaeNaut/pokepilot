import { describe, expect, it } from "vitest";
import {
  clearBuildStateSlot,
  createEmptyBuildState,
  patchBuildStateSlot,
  reorderBuildStateSlots,
  replaceBuildStateField,
} from "./teamBuildState";

describe("team build state", () => {
  it("preserves the state object when a field updater returns the same value", () => {
    const state = createEmptyBuildState();

    expect(
      replaceBuildStateField(state, "abilityBySlot", state.abilityBySlot),
    ).toBe(state);
    expect(replaceBuildStateField(state, "abilityBySlot", { 0: "blaze" })).not.toBe(
      state,
    );
  });

  it("patches only the requested slot fields", () => {
    const state = patchBuildStateSlot(createEmptyBuildState(), 2, {
      ability: "Intimidate",
      moveIds: ["fakeout"],
      item: null,
    });

    expect(state.abilityBySlot[2]).toBe("Intimidate");
    expect(state.moveIdsBySlot[2]).toEqual(["fakeout"]);
    expect(state.itemBySlot[2]).toBeNull();
    expect(state.natureBySlot).toEqual({});
  });

  it("removes every build field when a slot is cleared", () => {
    const patched = patchBuildStateSlot(createEmptyBuildState(), 1, {
      ability: "Levitate",
      nature: "modest",
      moveIds: ["shadowball"],
    });

    expect(clearBuildStateSlot(patched, 1)).toEqual(createEmptyBuildState());
  });

  it("swaps complete slot records without shifting other slots", () => {
    let state = patchBuildStateSlot(createEmptyBuildState(), 0, {
      ability: "Drought",
      moveIds: ["overheat"],
    });
    state = patchBuildStateSlot(state, 2, {
      ability: "Drizzle",
      moveIds: ["hydropump"],
    });

    const reordered = reorderBuildStateSlots(state, 0, 2);

    expect(reordered.abilityBySlot).toEqual({ 0: "Drizzle", 2: "Drought" });
    expect(reordered.moveIdsBySlot).toEqual({
      0: ["hydropump"],
      2: ["overheat"],
    });
  });
});
