import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_MODE,
  isAppMode,
  resolveAppMode,
} from "./appMode";

describe("app mode", () => {
  it("accepts the supported application modes", () => {
    expect(isAppMode("builder")).toBe(true);
    expect(isAppMode("calculator")).toBe(true);
    expect(isAppMode("settings")).toBe(false);
  });

  it("falls back to the builder for missing or unsupported values", () => {
    expect(resolveAppMode(null)).toBe(DEFAULT_APP_MODE);
    expect(resolveAppMode("unknown")).toBe(DEFAULT_APP_MODE);
  });
});
