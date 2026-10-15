import { describe, expect, it } from "vitest";
import { getCopilotComparableSpeed, getCopilotItemSpeedMultiplier } from "./copilotSpeed";
import type { CopilotMechanicsSnapshot } from "./copilotMechanics";

const mechanics: CopilotMechanicsSnapshot = { moves: [], abilities: [], items: [
  { id: "choicescarf", displayName: "Choice Scarf", effect: "Holder's Speed is 1.5x, but it can only select the first move it executes." },
  { id: "ironball", displayName: "Iron Ball", effect: "Holder's Speed is halved." },
] };
describe("shared item-only Speed", () => {
  it.each([[155, "Choice Scarf", 232], [143, "Iron Ball", 71], [169, null, 169]] as const)(
    "uses game rounding for %s with %s", (speed, item, expected) => {
      expect(getCopilotComparableSpeed({ stats: { speed }, item }, mechanics)).toBe(expected);
    },
  );
  it("does not manufacture a zero Speed for missing stats", () => {
    expect(getCopilotComparableSpeed({ stats: null, item: null }, mechanics)).toBeNull();
  });
  it("does not promote a conditional description to an unconditional modifier", () => {
    const conditional = { ...mechanics, items: [{ id: "quickpowder", displayName: "Quick Powder", effect: "If the holder is Ditto, holder's Speed is 2x." }] };
    expect(getCopilotItemSpeedMultiplier({ stats: { speed: 100 }, item: "Quick Powder" }, conditional)).toBe(1);
  });
  it("supports canonical Unicode multiplication and apostrophes", () => {
    const unicode = { ...mechanics, items: [{ ...mechanics.items[0], effect: "Holder\u2019s Speed is 1.5\u00d7, but it is locked." }] };
    expect(getCopilotComparableSpeed({ stats: { speed: 155 }, item: "choice-scarf" }, unicode)).toBe(232);
  });
});
