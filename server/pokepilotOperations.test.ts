import { describe, expect, it } from "vitest";
import {
  createPokePilotAnalysisCacheKey,
  getPokePilotSafeguardConfig,
  InMemoryPokePilotOperations,
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_COOLDOWN_TEST_DURATION_MS,
  resolvePokePilotSafeguardMode,
} from "./pokepilotOperations";

describe("PokePilot operational safeguards", () => {
  it("creates the same cache key regardless of object key order", () => {
    const left = createPokePilotAnalysisCacheKey(
      { locale: "ko", team: { name: "A", slots: [1, 2] } },
      "model",
      25,
      "low",
    );
    const right = createPokePilotAnalysisCacheKey(
      { team: { slots: [1, 2], name: "A" }, locale: "ko" },
      "model",
      25,
      "low",
    );

    expect(left).toBe(right);
  });

  it("expires cached analyses after 24 hours", () => {
    const operations = new InMemoryPokePilotOperations();
    operations.setCached("request", { title: "Cached" }, 1_000);

    expect(operations.getCached("request", 1_001)).toEqual({
      title: "Cached",
    });
    expect(
      operations.getCached(
        "request",
        1_000 + POKEPILOT_ANALYSIS_CACHE_TTL_MS,
      ),
    ).toBeNull();
  });

  it("applies increasing client cooldowns inside the rolling window", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };

    for (let index = 0; index < 5; index += 1) {
      expect(operations.consume(requester, 0)).toEqual({ allowed: true });
    }

    expect(operations.consume(requester, 0)).toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      scope: "client",
    });
    expect(operations.consume(requester, 60_000)).toEqual({ allowed: true });
    expect(operations.consume(requester, 60_000)).toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      scope: "client",
    });
  });

  it("keeps local test modes explicit and production-safe by default", () => {
    expect(getPokePilotSafeguardConfig("enforced")).toEqual({
      cacheEnabled: true,
      rateLimitMode: "enforced",
    });
    expect(getPokePilotSafeguardConfig("ai-test")).toEqual({
      cacheEnabled: true,
      rateLimitMode: null,
    });
    expect(getPokePilotSafeguardConfig("ai-fresh")).toEqual({
      cacheEnabled: false,
      rateLimitMode: null,
    });
    expect(getPokePilotSafeguardConfig("cooldown-test")).toEqual({
      cacheEnabled: false,
      rateLimitMode: "cooldown-test",
    });
    expect(resolvePokePilotSafeguardMode("production")).toBe("enforced");
    expect(resolvePokePilotSafeguardMode("unexpected-mode")).toBe(
      "enforced",
    );
  });

  it("triggers the isolated cooldown test policy after one use", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };

    expect(operations.consume(requester, 0, "cooldown-test")).toEqual({
      allowed: true,
    });
    expect(operations.consume(requester, 0, "cooldown-test")).toEqual({
      allowed: false,
      retryAfterMs: POKEPILOT_COOLDOWN_TEST_DURATION_MS,
      scope: "client",
    });
    expect(operations.consume(requester, 0, "enforced")).toEqual({
      allowed: true,
    });
  });
});
