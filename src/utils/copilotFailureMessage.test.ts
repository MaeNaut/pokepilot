import { describe, expect, it } from "vitest";
import { getCopilotFailureMessage, getCopilotNoCostMessage } from "./copilotFailureMessage";

describe("analysis failure copy", () => {
  it("explains invalid model output in both languages", () => {
    expect(getCopilotFailureMessage("AI_INVALID_RESPONSE", "en", "fallback")).toContain("AI response");
    expect(getCopilotFailureMessage("AI_INVALID_RESPONSE", "ko", "fallback")).toContain("AI 응답");
  });

  it("does not invent a message for an unknown error code", () => {
    expect(getCopilotFailureMessage("UNKNOWN", "en", "fallback")).toBe("fallback");
  });

  it("states that the model was not called when the server confirms it", () => {
    expect(getCopilotNoCostMessage("en")).toContain("did not start");
  });
});
