import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const production = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const qa = JSON.parse(readFileSync("wrangler.qa.jsonc", "utf8"));

describe("Cloudflare production / QA configuration", () => {
  it("cannot deploy the QA config over the production Worker", () => {
    expect(production.name).toBe("pokepilot");
    expect(qa.name).toBe("qa-pokepilot");
    expect(qa.routes).toBeUndefined();
    expect(qa.d1_databases[0].database_id).not.toBe(production.d1_databases[0].database_id);
  });

  it("keeps the gate class owned by production with separate object scopes", () => {
    expect(production.main).toBe("./worker/entry.ts");
    expect(qa.main).toBe("./worker/index.ts");
    expect(production.migrations).toEqual([{ tag: "v1-analysis-gate", new_sqlite_classes: ["PokePilotAnalysisGate"] }]);
    expect(qa.migrations).toBeUndefined();
    expect(qa.durable_objects.bindings[0]).toEqual({
      name: "POKEPILOT_ANALYSIS_GATE", class_name: "PokePilotAnalysisGate", script_name: "pokepilot",
    });
    expect(production.vars.POKEPILOT_ANALYSIS_GATE_SCOPE).toBe("production");
    expect(qa.vars.POKEPILOT_ANALYSIS_GATE_SCOPE).toBe("qa");
    expect(production.vars.POKEPILOT_ANALYSIS_PAUSED).toBe("false");
    expect(qa.vars.POKEPILOT_ANALYSIS_PAUSED).toBe("false");
  });
});
