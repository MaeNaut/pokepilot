import { describe, expect, it } from "vitest";
import { getIndexAfterSwap, swapArrayItems } from "./reorder";

describe("reorder helpers", () => {
  it("swaps two entries without mutating the source array", () => {
    const source = ["first", "second", "third"];

    expect(swapArrayItems(source, 0, 2)).toEqual(["third", "second", "first"]);
    expect(source).toEqual(["first", "second", "third"]);
  });

  it("tracks only the indices involved in a swap", () => {
    expect(getIndexAfterSwap(1, 1, 4)).toBe(4);
    expect(getIndexAfterSwap(4, 1, 4)).toBe(1);
    expect(getIndexAfterSwap(2, 1, 4)).toBe(2);
  });
});
