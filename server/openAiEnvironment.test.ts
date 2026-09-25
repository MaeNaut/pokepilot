import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseOpenAiApiKeyFromEnvSource,
  selectUsableOpenAiApiKey,
  resolveOpenAiEvaluationApiKey,
} from "./openAiEnvironment";

const validKey = `sk-test-${"x".repeat(40)}`;

describe("OpenAI server environment", () => {
  it("requires an evaluation key even when production credentials exist", () => {
    const root = mkdtempSync(join(tmpdir(), "pokepilot-key-test-"));
    vi.stubEnv("OPENAI_EVALUATION_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", validKey);
    try {
      writeFileSync(join(root, ".env.local"), `OPENAI_API_KEY=${validKey}\n`);
      expect(() => resolveOpenAiEvaluationApiKey(root)).toThrow("will not fall back");
      writeFileSync(join(root, ".env.local"), `OPENAI_EVALUATION_API_KEY='${validKey}'\n`);
      expect(resolveOpenAiEvaluationApiKey(root)).toBe(validKey);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  });
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
