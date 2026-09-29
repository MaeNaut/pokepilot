import { describe, expect, it } from "vitest";
import { jsonValueEqual } from "./jsonValueEqual";

describe("jsonValueEqual", () => {
  it("ignores object property insertion order at every depth", () => {
    expect(jsonValueEqual(
      { name: "Team", build: { ability: "A", moves: ["one", "two"] } },
      { build: { moves: ["one", "two"], ability: "A" }, name: "Team" },
    )).toBe(true);
  });

  it("preserves array ordering and real value differences", () => {
    expect(jsonValueEqual(["first", "second"], ["second", "first"])).toBe(false);
    expect(jsonValueEqual({ name: "A" }, { name: "B" })).toBe(false);
  });
});
