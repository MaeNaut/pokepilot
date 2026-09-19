import { describe, expect, it } from "vitest";
import {
  mergeAccountPreferences,
  normalizeAccountPreferences,
  type AccountPreferences,
} from "./accountPreferences";

const localPreferences: AccountPreferences = {
  locale: "ko",
  themePreference: "dark",
  battleFormat: "doubles",
  tutorialCompleted: true,
};

describe("account preferences", () => {
  it("accepts only the bounded set of supported preference values", () => {
    expect(normalizeAccountPreferences(localPreferences)).toEqual(localPreferences);
    expect(normalizeAccountPreferences({ ...localPreferences, locale: "ja" })).toBeNull();
    expect(normalizeAccountPreferences({ ...localPreferences, tutorialCompleted: "yes" })).toBeNull();
  });

  it("uses signed-in preferences while retaining a locally completed tutorial", () => {
    expect(mergeAccountPreferences({
      locale: "en",
      themePreference: "light",
      battleFormat: "singles",
      tutorialCompleted: false,
    }, localPreferences)).toEqual({
      locale: "en",
      themePreference: "light",
      battleFormat: "singles",
      tutorialCompleted: true,
    });
  });
});
