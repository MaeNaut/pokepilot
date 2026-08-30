import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const vercelRuntimeFiles = [
  "api/pokepilot/analyze.ts",
  "server/nodePokepilotApi.ts",
  "server/openAiLuna.ts",
  "server/pokepilotAnalysisValidation.ts",
  "server/pokepilotApi.ts",
  "server/pokepilotIdentity.ts",
  "server/pokepilotOperations.ts",
  "server/pokepilotOperationsRuntime.ts",
  "server/upstashPokePilotOperations.ts",
  "src/utils/copilotModelContract.ts",
  "src/utils/copilotRequestContract.ts",
  "src/utils/copilotRequestFingerprint.ts",
  "src/utils/copilotResponsibilities.ts",
  "src/utils/copilotStrategyAudit.ts",
] as const;

const relativeImportPattern = /\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g;

describe("Vercel Node runtime imports", () => {
  it.each(vercelRuntimeFiles)("uses Node-compatible ESM paths in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const relativeImports = [...source.matchAll(relativeImportPattern)].map(
      ([, specifier]) => specifier,
    );

    expect(relativeImports).toEqual(
      relativeImports.map(() => expect.stringMatching(/\.(?:c|m)?js$/)),
    );
  });
});
