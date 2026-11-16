import { describe, expect, it } from "vitest";
import { requiresAnalysisDrain } from "./prepare-cloudflare-cutover";

const bindings = [
  { name: "POKEPILOT_ANALYSIS_GATE", type: "durable_object_namespace", namespace_id: "test" },
  { name: "POKEPILOT_ANALYSIS_GATE_SCOPE", type: "plain_text", text: "production" },
  { name: "POKEPILOT_ANALYSIS_PAUSED", type: "plain_text", text: "false" },
];

describe("Cloudflare analysis cutover planning", () => {
  it("requires a drain when upgrading from the Redis release", () => {
    expect(requiresAnalysisDrain({ bindings: [{ type: "secret_text", name: "UPSTASH_REDIS_REST_TOKEN" }] })).toBe(true);
  });
  it("does not interrupt ordinary deployments after cutover", () => {
    expect(requiresAnalysisDrain({ bindings })).toBe(false);
  });
  it("safely repeats a drain if a previous deployment stopped during maintenance", () => {
    expect(requiresAnalysisDrain({ bindings: [...bindings.slice(0, 2), { ...bindings[2], text: "true" }] })).toBe(true);
  });
  it("does not treat QA scope as production", () => {
    expect(requiresAnalysisDrain({ bindings: [bindings[0], { ...bindings[1], text: "qa" }] })).toBe(true);
  });
  it.each([null, {}, { bindings: "invalid" }])("stops on malformed settings rather than guessing: %j", (settings) => {
    expect(() => requiresAnalysisDrain(settings)).toThrow();
  });
});
