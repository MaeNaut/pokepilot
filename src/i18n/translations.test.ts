import { describe, expect, it } from "vitest";
import { interpolateTranslation, ko } from "./translations";

describe("UI translations", () => {
  it("interpolates named variables", () => {
    expect(
      interpolateTranslation("{matching} of {total}", {
        matching: 12,
        total: 30,
      }),
    ).toBe("12 of 30");
  });

  it("keeps an unknown placeholder intact", () => {
    expect(interpolateTranslation("Hello {name}", {})).toBe("Hello {name}");
  });

  it("includes Korean interface copy", () => {
    expect(ko["builder.ability"]).toBe("특성");
    expect(ko["team.save"]).toBe("팀 저장");
  });
});
