import { describe, expect, it } from "vitest";
import { matchesSearchText, normalizeSearchText } from "./searchText";

describe("search text", () => {
  it.each([
    ["Farfetch'd", "Farfetch’d"],
    ["Mr Mime", "Mr. Mime"],
    ["Porygon Z", "Porygon-Z"],
    ["Flabebe", "Flabébé"],
  ])("matches punctuation and accent variants for %s", (query, value) => {
    expect(matchesSearchText(query, value)).toBe(true);
  });

  it("preserves Korean letters", () => {
    expect(normalizeSearchText("알로라 페르시온")).toBe("알로라페르시온");
    expect(matchesSearchText("페르시온", "알로라 페르시온")).toBe(true);
  });
});
