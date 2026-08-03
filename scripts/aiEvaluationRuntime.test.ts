import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

describe("AI evaluation runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replays the development Smogon proxy in Node evaluations", async () => {
    const nativeFetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", nativeFetch);
    const restore = installAiEvaluationRuntime(process.cwd(), {
      persistStorage: false,
    });

    try {
      await fetch("/smogon-stats/2026-07/moveset/example.json");
    } finally {
      restore();
    }

    expect(nativeFetch).toHaveBeenCalledWith(
      "https://www.smogon.com/stats/2026-07/moveset/example.json",
      undefined,
    );
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
