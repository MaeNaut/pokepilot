import { describe, expect, it, vi } from "vitest";
import {
  createPokePilotAnalysisCacheKey,
  getPokePilotSafeguardConfig,
  InMemoryPokePilotOperations,
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_CLIENT_REQUEST_LIMIT,
  POKEPILOT_MAX_SHARED_WAITERS,
  PokePilotCapacityError,
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


  it("keeps local test modes explicit and production-safe by default", () => {
    expect(getPokePilotSafeguardConfig("enforced")).toEqual({
      cacheEnabled: true,
      requestRateLimitEnabled: true,
    });
    expect(getPokePilotSafeguardConfig("ai-test")).toEqual({
      cacheEnabled: true,
      requestRateLimitEnabled: false,
    });
    expect(getPokePilotSafeguardConfig("ai-fresh")).toEqual({
      cacheEnabled: false,
      requestRateLimitEnabled: false,
    });
    expect(resolvePokePilotSafeguardMode("production")).toBe("enforced");
    expect(resolvePokePilotSafeguardMode("shared")).toBe("enforced");
    expect(resolvePokePilotSafeguardMode("unexpected-mode")).toBe(
      "enforced",
    );
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
