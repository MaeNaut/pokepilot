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

it("resolves a stored error code in the current display language and preserves unknown fallbacks", () => {
  const error = { code: "AUTH_REQUIRED", message: "provider detail" };
  expect(getCopilotFailureMessage(error.code, "en", error.message)).toContain("Sign in");
  expect(getCopilotFailureMessage(error.code, "ko", error.message)).toContain("로그인");
  expect(getCopilotFailureMessage("UNKNOWN", "en", "Retry later")).toBe("Retry later");
  expect(getCopilotFailureMessage(undefined, "ko", "실패")).toBe("실패");
});
