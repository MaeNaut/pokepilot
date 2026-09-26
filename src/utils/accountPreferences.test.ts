import { describe, expect, it } from "vitest";
import {
  mergeAccountPreferences,
  normalizeAccountPreferences,
  type AccountPreferences,
  areAccountPreferencesEqual,
} from "./accountPreferences";

const localPreferences: AccountPreferences = {
  locale: "ko",
  themePreference: "dark",
  battleFormat: "doubles",
  tutorialCompleted: true,
};

describe("account preferences", () => {
  it("preserves analysis selection and rejects unsupported combinations", () => {
    const preferences: AccountPreferences = { ...localPreferences, analysis: {
      scope: "pokemon", modelId: "gpt-6-sol", reasoningEffort: "low",
    } };
    expect(normalizeAccountPreferences(preferences)).toEqual(preferences);
    expect(areAccountPreferencesEqual(preferences, localPreferences)).toBe(false);
    expect(normalizeAccountPreferences({ ...preferences, analysis: {
      ...preferences.analysis, reasoningEffort: "medium",
    } })).toBeNull();
    expect(normalizeAccountPreferences({ ...preferences, analysis: {
      ...preferences.analysis, scope: "unknown",
    } })).toBeNull();
  });
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
