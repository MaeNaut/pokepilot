import { describe, expect, it } from "vitest";
import { getNextCircularIndex } from "./optionNavigation";

describe("circular option navigation", () => {
  it("returns no selection for an empty option list", () => {
    expect(getNextCircularIndex(0, 0, 1)).toBe(-1);
  });

  it("enters an unselected list from the requested edge", () => {
    expect(getNextCircularIndex(-1, 4, 1)).toBe(0);
    expect(getNextCircularIndex(-1, 4, -1)).toBe(3);
  });

  it("wraps in both directions", () => {
    expect(getNextCircularIndex(3, 4, 1)).toBe(0);
    expect(getNextCircularIndex(0, 4, -1)).toBe(3);
  });
});
