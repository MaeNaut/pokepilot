import { describe, expect, it } from "vitest";
import {
  isTheme,
  isThemePreference,
  resolveTheme,
  resolveThemePreference,
} from "./theme";

describe("theme preferences", () => {
  it("keeps supported stored preferences", () => {
    expect(resolveThemePreference("system")).toBe("system");
    expect(resolveThemePreference("light")).toBe("light");
    expect(resolveThemePreference("dark")).toBe("dark");
  });

  it("uses system mode for missing or invalid stored preferences", () => {
    expect(resolveThemePreference(null)).toBe("system");
    expect(resolveThemePreference("midnight")).toBe("system");
  });

  it("resolves system mode while preserving explicit choices", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("recognizes resolved themes and all supported preferences", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("midnight")).toBe(false);
  });
});
