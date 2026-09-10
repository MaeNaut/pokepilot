import { describe, expect, it } from "vitest";
import {
  getNextCircularIndex,
  getSearchActiveIndex,
} from "./optionNavigation";

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

describe("search option navigation", () => {
  it("selects the first matching result after a clear option", () => {
    expect(getSearchActiveIndex("life orb", 2, 1)).toBe(1);
  });

  it("keeps the first row active when there is no search query", () => {
    expect(getSearchActiveIndex("", 2, 1)).toBe(0);
  });

  it("does not select the clear row when a query has no matches", () => {
    expect(getSearchActiveIndex("missing", 0, 1)).toBe(-1);
  });
});
