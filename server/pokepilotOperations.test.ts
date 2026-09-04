import { describe, expect, it, vi } from "vitest";
import {
  createPokePilotAnalysisCacheKey,
  getPokePilotSafeguardConfig,
  InMemoryPokePilotOperations,
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_CLIENT_REQUEST_LIMIT,
  POKEPILOT_COOLDOWN_TEST_DURATION_MS,
  POKEPILOT_MAX_SHARED_WAITERS,
  PokePilotCapacityError,
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
      providerAttemptLimitEnabled: true,
      rateLimitMode: "enforced",
      requestRateLimitEnabled: true,
    });
    expect(getPokePilotSafeguardConfig("ai-test")).toEqual({
      cacheEnabled: true,
      providerAttemptLimitEnabled: false,
      rateLimitMode: null,
      requestRateLimitEnabled: false,
    });
    expect(getPokePilotSafeguardConfig("ai-fresh")).toEqual({
      cacheEnabled: false,
      providerAttemptLimitEnabled: false,
      rateLimitMode: null,
      requestRateLimitEnabled: false,
    });
    expect(getPokePilotSafeguardConfig("cooldown-test")).toEqual({
      cacheEnabled: false,
      providerAttemptLimitEnabled: false,
      rateLimitMode: "cooldown-test",
      requestRateLimitEnabled: false,
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

  it("limits all requests without consuming analysis credits", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };

    for (let index = 0; index < POKEPILOT_CLIENT_REQUEST_LIMIT; index += 1) {
      expect(operations.admitRequest(requester, 0)).toEqual({ allowed: true });
    }
    expect(operations.admitRequest(requester, 0)).toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      scope: "client",
    });

    reserve(operations, requester, 0);
  });

  it("counts provider attempts even when user analysis credits are canceled", () => {
    const operations = new InMemoryPokePilotOperations();
    const requester = { clientId: "client-a", ipHash: "ip-a" };

    for (let index = 0; index < 5; index += 1) {
      expect(operations.admitProviderAttempt(requester, 0)).toEqual({
        allowed: true,
      });
    }
    expect(operations.admitProviderAttempt(requester, 0)).toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      scope: "client",
    });
  });

  it("bounds followers waiting on one in-flight analysis", async () => {
    const operations = new InMemoryPokePilotOperations();
    let finish: ((value: string) => void) | undefined;
    const owner = operations.runOnce(
      "request",
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
      { maxWaiters: POKEPILOT_MAX_SHARED_WAITERS },
    );
    const followers = Array.from({ length: POKEPILOT_MAX_SHARED_WAITERS }, () =>
      operations.runOnce("request", async () => "duplicate", {
        maxWaiters: POKEPILOT_MAX_SHARED_WAITERS,
      }),
    );

    await expect(
      operations.runOnce("request", async () => "overflow", {
        maxWaiters: POKEPILOT_MAX_SHARED_WAITERS,
      }),
    ).rejects.toBeInstanceOf(PokePilotCapacityError);

    finish?.("owner");
    await expect(owner).resolves.toEqual({ shared: false, value: "owner" });
    await expect(Promise.all(followers)).resolves.toEqual(
      Array.from({ length: POKEPILOT_MAX_SHARED_WAITERS }, () => ({
        shared: true,
        value: "owner",
      })),
    );
  });

  it("bounds the total number of local followers across request keys", async () => {
    const operations = new InMemoryPokePilotOperations();
    const finishes: Array<(value: string) => void> = [];
    const createOwner = (key: string) =>
      operations.runOnce(
        key,
        () =>
          new Promise<string>((resolve) => {
            finishes.push(resolve);
          }),
      );
    const ownerA = createOwner("request-a");
    const ownerB = createOwner("request-b");
    const follower = operations.runOnce("request-a", async () => "duplicate", {
      maxTotalWaiters: 1,
      maxWaiters: 4,
    });

    await expect(
      operations.runOnce("request-b", async () => "overflow", {
        maxTotalWaiters: 1,
        maxWaiters: 4,
      }),
    ).rejects.toBeInstanceOf(PokePilotCapacityError);

    finishes[0]("a");
    finishes[1]("b");
    await Promise.all([ownerA, ownerB, follower]);
  });

  it("times out local followers before the hosting deadline", async () => {
    vi.useFakeTimers();
    try {
      const operations = new InMemoryPokePilotOperations();
      let finish: ((value: string) => void) | undefined;
      const owner = operations.runOnce(
        "request",
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      );
      const follower = operations.runOnce("request", async () => "duplicate", {
        maxWaiters: 4,
        waitTimeoutMs: 50,
      });
      const rejection = expect(follower).rejects.toBeInstanceOf(
        PokePilotCapacityError,
      );

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      finish?.("owner");
      await owner;
    } finally {
      vi.useRealTimers();
    }
  });
});
