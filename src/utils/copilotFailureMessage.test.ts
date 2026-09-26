import { describe, expect, it } from "vitest";
import { getCopilotFailureMessage } from "./copilotFailureMessage";

describe.each(["ko", "en"] as const)("personal-key failure messages (%s)", (locale) => {
  it("has distinct localized guidance without provider error text", () => {
    const codes = ["PERSONAL_KEY_INVALID", "PERSONAL_KEY_FORBIDDEN", "AI_QUOTA_EXCEEDED", "AI_MODEL_UNAVAILABLE", "AI_RATE_LIMITED"];
    const messages = codes.map((code) => getCopilotFailureMessage(code, locale, "PRIVATE_PROVIDER_DETAIL"));
    expect(new Set(messages).size).toBe(codes.length);
    for (const message of messages) expect(message).not.toContain("PRIVATE_PROVIDER_DETAIL");
    expect(messages[1]).toContain("Responses Write");
    expect(messages[2]).toContain("Billing");
  });
});
