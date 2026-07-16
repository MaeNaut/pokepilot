import { describe, expect, it } from "vitest";
import {
  getExpandedOptionLimit,
  getOptionLimitForIndex,
  isNearOptionListEnd,
} from "./useIncrementalOptions";

describe("incremental option helpers", () => {
  it("expands by one page without exceeding the total", () => {
    expect(getExpandedOptionLimit(20, 55)).toBe(40);
    expect(getExpandedOptionLimit(40, 55)).toBe(55);
  });

  it("calculates the page required to reveal an option", () => {
    expect(getOptionLimitForIndex(-1)).toBe(20);
    expect(getOptionLimitForIndex(0)).toBe(20);
    expect(getOptionLimitForIndex(19)).toBe(20);
    expect(getOptionLimitForIndex(20)).toBe(40);
  });

  it("detects when a result list is close to its scroll boundary", () => {
    expect(
      isNearOptionListEnd({
        scrollHeight: 500,
        scrollTop: 270,
        clientHeight: 200,
      }),
    ).toBe(true);
    expect(
      isNearOptionListEnd({
        scrollHeight: 500,
        scrollTop: 200,
        clientHeight: 200,
      }),
    ).toBe(false);
  });
});
