import { describe, expect, it } from "vitest";
import {
  createPokePilotAnalysisCacheKey,
  getPokePilotSafeguardConfig,
  InMemoryPokePilotOperations,
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_COOLDOWN_TEST_DURATION_MS,
  resolvePokePilotSafeguardMode,
  type PokePilotRateLimitMode,
  type PokePilotRequester,
} from "./pokepilotOperations";

function reserve(
  operations: InMemoryPokePilotOperations,
  requester: PokePilotRequester,
  now: number,
  mode: PokePilotRateLimitMode = "enforced",
) {
  const decision = operations.reserve(requester, now, mode);
  expect(decision.allowed).toBe(true);
  if (!decision.allowed) {
    throw new Error("Expected a rate-limit reservation.");
  }
  return decision.reservation;
}

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
      const reservation = reserve(operations, requester, 0);
      operations.completeReservation(reservation, 0);
    }

    expect(operations.reserve(requester, 0)).toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      scope: "client",
    });
    const nextReservation = reserve(operations, requester, 60_000);
    operations.completeReservation(nextReservation, 60_000);
    expect(operations.reserve(requester, 60_000)).toEqual({
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
    expect(resolvePokePilotSafeguardMode("shared")).toBe("enforced");
    expect(resolvePokePilotSafeguardMode("unexpected-mode")).toBe(
      "enforced",
    );
  });

  it("triggers the isolated cooldown test policy after one use", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };

    reserve(operations, requester, 0, "cooldown-test");
    expect(operations.reserve(requester, 0, "cooldown-test")).toEqual({
      allowed: false,
      retryAfterMs: POKEPILOT_COOLDOWN_TEST_DURATION_MS,
      scope: "client",
    });
    reserve(operations, requester, 0, "enforced");
  });

  it("starts the full cooldown when a successful analysis completes", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };
    const reservation = reserve(operations, requester, 1_000, "cooldown-test");

    expect(operations.completeReservation(reservation, 9_000)).toEqual({
      retryAfterMs: POKEPILOT_COOLDOWN_TEST_DURATION_MS,
      scope: "client",
    });

    expect(operations.reserve(requester, 9_000, "cooldown-test")).toEqual({
      allowed: false,
      retryAfterMs: POKEPILOT_COOLDOWN_TEST_DURATION_MS,
      scope: "client",
    });
    expect(operations.reserve(requester, 18_999, "cooldown-test")).toEqual({
      allowed: false,
      retryAfterMs: 1,
      scope: "client",
    });
    reserve(operations, requester, 19_000, "cooldown-test");
  });

  it("releases a failed analysis reservation without consuming a use", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };
    const reservation = reserve(operations, requester, 1_000, "cooldown-test");

    operations.cancelReservation(reservation);

    reserve(operations, requester, 1_000, "cooldown-test");
  });
});
