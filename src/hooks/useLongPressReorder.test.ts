import { describe, expect, it, vi } from "vitest";
import {
  calculateSwapDisplacement,
  installReorderSelectionGuard,
} from "./useLongPressReorder";

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

describe("installReorderSelectionGuard", () => {
  it("blocks native selection during a touch reorder and restores it afterward", () => {
    const listeners = new Map<string, EventListener>();
    const style = {
      userSelect: "text",
      webkitUserSelect: "text",
    };
    const documentTarget = {
      documentElement: { style },
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type);
      }),
    } as unknown as Document;
    const selection = {
      rangeCount: 1,
      removeAllRanges: vi.fn(),
    } as unknown as Selection;

    const cleanup = installReorderSelectionGuard(
      documentTarget,
      () => selection,
    );
    const selectStart = new Event("selectstart", { cancelable: true });
    listeners.get("selectstart")?.(selectStart);
    listeners.get("selectionchange")?.(new Event("selectionchange"));

    expect(style).toEqual({ userSelect: "none", webkitUserSelect: "none" });
    expect(selectStart.defaultPrevented).toBe(true);
    expect(selection.removeAllRanges).toHaveBeenCalledTimes(2);

    cleanup();

    expect(style).toEqual({ userSelect: "text", webkitUserSelect: "text" });
    expect(listeners.size).toBe(0);
  });
});
