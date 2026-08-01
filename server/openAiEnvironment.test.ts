import { describe, expect, it } from "vitest";
import {
  parseOpenAiApiKeyFromEnvSource,
  selectUsableOpenAiApiKey,
} from "./openAiEnvironment";

const validKey = `sk-test-${"x".repeat(40)}`;

describe("OpenAI server environment", () => {
  it("ignores an unusable process value in favor of a valid file value", () => {
    expect(selectUsableOpenAiApiKey(["*", validKey])).toBe(validKey);
  });

  it("parses quoted keys without exposing comments or unrelated values", () => {
    expect(
      parseOpenAiApiKeyFromEnvSource(
        `OTHER_VALUE=ignored\nOPENAI_API_KEY='${validKey}'\n`,
      ),
    ).toBe(validKey);
  });
});
