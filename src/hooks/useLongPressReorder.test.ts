import { describe, expect, it } from "vitest";
import { calculateSwapDisplacement } from "./useLongPressReorder";

const horizontalCenters = [0, 1, 2, 3].map((index) => ({
  index,
  x: index * 50,
  y: 20,
}));

describe("calculateSwapDisplacement", () => {
  it("moves only a forward swap target back to the source", () => {
    expect(calculateSwapDisplacement(horizontalCenters, 0, 3)).toEqual({
      index: 3,
      offsetX: -150,
      offsetY: 0,
    });
  });

  it("moves only a backward swap target forward to the source", () => {
    expect(calculateSwapDisplacement(horizontalCenters, 3, 1)).toEqual({
      index: 1,
      offsetX: 100,
      offsetY: 0,
    });
  });

  it("does not move other items when the drop position is unchanged", () => {
    expect(calculateSwapDisplacement(horizontalCenters, 2, 2)).toBeNull();
  });
});
