import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";
import { battleUsageFixture } from "../src/test/fixtures/battleUsageFixture";

describe("AI evaluation runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the same battle data adapter in Node evaluations", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-30T12:00:00Z"));
    const nativeFetch = vi.fn(async () => Response.json(battleUsageFixture().index));
    vi.stubGlobal("fetch", nativeFetch);
    const restore = installAiEvaluationRuntime(process.cwd(), {
      persistStorage: false,
    });

    try {
      const response = await fetch("/api/battle-usage/singles");
      expect(response.status).toBe(200);
    } finally {
      restore();
    }

    expect(nativeFetch).toHaveBeenCalledOnce();
    expect((nativeFetch.mock.calls[0] as unknown as [Request])[0].url).toBe("https://championsbattledata.com/api");
  });

  it("persists evaluation localStorage across runtime installs", () => {
    const storagePath = join(
      process.cwd(),
      "node_modules",
      ".cache",
      "pokepilot-ai",
      "evaluation-local-storage.test.json",
    );
    const nativeFetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", nativeFetch);

    let restore = installAiEvaluationRuntime(process.cwd(), { storagePath });
    localStorage.clear();
    localStorage.setItem("showdown-cache", "cached-data");
    restore();

    restore = installAiEvaluationRuntime(process.cwd(), { storagePath });
    try {
      expect(localStorage.getItem("showdown-cache")).toBe("cached-data");
      expect(JSON.parse(readFileSync(storagePath, "utf8"))).toEqual({
        "showdown-cache": "cached-data",
      });
      localStorage.clear();
    } finally {
      restore();
    }
  });
});
