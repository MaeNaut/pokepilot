import { describe, expect, it, vi } from "vitest";
import {
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_MAX_SHARED_WAITERS,
  PokePilotCapacityError,
} from "./pokepilotOperations";
import {
  UpstashPokePilotOperations,
  type PokePilotRedisClient,
} from "./upstashPokePilotOperations";

class FakeRedisClient {
  readonly evalCalls: Array<{
    args: unknown[];
    keys: string[];
    script: string;
  }> = [];
  readonly values = new Map<string, unknown>();
  readonly setCalls: Array<{
    key: string;
    options: { nx?: true; px: number };
    value: unknown;
  }> = [];
  rateResult: [number, number, number] = [1, 0, 0];
  requestResult: [number, number, number] = [1, 0, 0];
  completeResult: [number, number, number, number] = [1, 1, 0, 0];

  async del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      if (this.values.delete(key)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async eval<TArgs extends unknown[], TData>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    this.evalCalls.push({ args, keys, script });
    if (script.includes("local clientLimit")) {
      return this.requestResult as TData;
    }

    if (script.includes("local expiresAt")) {
      const keyWaiters = new Set(
        (this.values.get(keys[0]) as Set<string> | undefined) ?? [],
      );
      const totalWaiters = new Set(
        (this.values.get(keys[1]) as Set<string> | undefined) ?? [],
      );
      const token = String(args[2]);
      const keyLimit = Number(args[3]);
      const totalLimit = Number(args[4]);
      if (keyWaiters.size >= keyLimit || totalWaiters.size >= totalLimit) {
        return 0 as TData;
      }
      keyWaiters.add(token);
      totalWaiters.add(token);
      this.values.set(keys[0], keyWaiters);
      this.values.set(keys[1], totalWaiters);
      return 1 as TData;
    }

    if (keys[0]?.includes(":waiters:") && script.includes('redis.call("ZREM"')) {
      for (const key of keys) {
        const waiters = new Set(
          (this.values.get(key) as Set<string> | undefined) ?? [],
        );
        waiters.delete(String(args[0]));
        if (waiters.size === 0) this.values.delete(key);
        else this.values.set(key, waiters);
      }
      return [1, 1] as TData;
    }

    if (keys.length === 1) {
      if (this.values.get(keys[0]) === args[0]) {
        this.values.delete(keys[0]);
        return 1 as TData;
      }
      return 0 as TData;
    }

    if (script.includes("local completedAt")) {
      return this.completeResult as TData;
    }

    return (script.includes("ZREMRANGEBYSCORE")
      ? this.rateResult
      : [1, 1]) as TData;
  }

  async get<T>(key: string) {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async mget<T extends unknown[]>(...keys: string[]) {
    return keys.map((key) => this.values.get(key) ?? null) as T;
  }

  async set<T>(
    key: string,
    value: T,
    options: { nx: true; px: number } | { nx?: never; px: number },
  ) {
    this.setCalls.push({ key, options, value });
    if (options.nx && this.values.has(key)) {
      return null;
    }
    this.values.set(key, value);
    return "OK" as const;
  }
}

function createOperations(
  redis: FakeRedisClient,
  overrides: Partial<
    ConstructorParameters<typeof UpstashPokePilotOperations>[0]
  > = {},
) {
  return new UpstashPokePilotOperations({
    keyPrefix: "test:pokepilot",
    redis: redis as PokePilotRedisClient,
    ...overrides,
  });
}

describe("Upstash PokePilot operations", () => {
  it("stores canonical analyses with the shared 24-hour TTL", async () => {
    const redis = new FakeRedisClient();
    const operations = createOperations(redis);

    await operations.setCached("request-a", { title: "Cached" }, 1_000);

    expect(await operations.getCached("request-a", 1_001)).toEqual({
      title: "Cached",
    });
    expect(redis.setCalls[0]).toMatchObject({
      key: "test:pokepilot:cache:request-a",
      options: { px: POKEPILOT_ANALYSIS_CACHE_TTL_MS },
    });
  });

  it("maps the atomic shared limiter result to the public decision", async () => {
    const redis = new FakeRedisClient();
    const operations = createOperations(redis);
    redis.rateResult = [0, 5_000, 2];

    await expect(
      operations.reserve(
        { clientId: "client-a", ipHash: "hashed-ip" },
        10_000,
      ),
    ).resolves.toEqual({
      allowed: false,
      retryAfterMs: 5_000,
      scope: "ip",
    });
  });

  it("keeps request and provider admission in separate Redis namespaces", async () => {
    const redis = new FakeRedisClient();
    const operations = createOperations(redis);
    const requester = { clientId: "client-a", ipHash: "hashed-ip" };

    redis.requestResult = [0, 4_000, 1];
    await expect(operations.admitRequest(requester, 10_000)).resolves.toEqual({
      allowed: false,
      retryAfterMs: 4_000,
      scope: "client",
    });
    redis.rateResult = [0, 5_000, 2];
    await expect(
      operations.admitProviderAttempt(requester, 10_000),
    ).resolves.toEqual({
      allowed: false,
      retryAfterMs: 5_000,
      scope: "ip",
    });

    expect(redis.evalCalls[0].keys).toEqual([
      "test:pokepilot:request:client:client-a",
      "test:pokepilot:request:ip:hashed-ip",
    ]);
    expect(redis.evalCalls[1].keys).toEqual([
      "test:pokepilot:provider:client:client-a",
      "test:pokepilot:provider:ip:hashed-ip",
    ]);
  });

  it("moves successful reservations to completion time and removes failures", async () => {
    const redis = new FakeRedisClient();
    const operations = createOperations(redis);
    const decision = await operations.reserve(
      { clientId: "client-a", ipHash: "hashed-ip" },
      10_000,
    );

    expect(decision.allowed).toBe(true);
    if (!decision.allowed) {
      throw new Error("Expected a shared rate-limit reservation.");
    }

    redis.completeResult = [1, 1, 10_000, 1];
    await expect(
      operations.completeReservation(decision.reservation, 18_000),
    ).resolves.toEqual({ retryAfterMs: 10_000, scope: "client" });
    await operations.cancelReservation(decision.reservation);

    const completeCall = redis.evalCalls.find((call) =>
      call.script.includes("local completedAt"),
    );
    const cancelCall = redis.evalCalls.find((call) =>
      call.script.includes('"ZREM"'),
    );
    expect(completeCall).toMatchObject({
      args: expect.arrayContaining([
        "18000",
        decision.reservation.id,
        String(24 * 60 * 60 * 1_000),
      ]),
      keys: [
        "test:pokepilot:usage:enforced:client:client-a",
        "test:pokepilot:usage:enforced:ip:hashed-ip",
      ],
    });
    expect(cancelCall).toMatchObject({
      args: [decision.reservation.id],
    });
  });

  it("deduplicates the same request across separate server instances", async () => {
    const redis = new FakeRedisClient();
    let releaseWait: (() => void) | undefined;
    const sleep = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseWait = resolve;
        }),
    );
    const firstOperations = createOperations(redis);
    const secondOperations = createOperations(redis, {
      clock: () => 0,
      sleep,
      waitTimeoutMs: 5_000,
    });
    let completeOwner: ((value: string) => void) | undefined;
    const ownerTask = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          completeOwner = resolve;
        }),
    );
    const duplicateTask = vi.fn(async () => "duplicate");

    const first = firstOperations.runOnce("request-a", ownerTask);
    await vi.waitFor(() => expect(ownerTask).toHaveBeenCalledOnce());
    const second = secondOperations.runOnce("request-a", duplicateTask);
    await vi.waitFor(() => expect(sleep).toHaveBeenCalledOnce());

    completeOwner?.("shared result");
    await first;
    releaseWait?.();

    await expect(second).resolves.toEqual({
      shared: true,
      value: "shared result",
    });
    expect(duplicateTask).not.toHaveBeenCalled();
  });

  it("keeps fresh-response QA deduplication local to each process", async () => {
    const redis = new FakeRedisClient();
    const firstOperations = createOperations(redis);
    const secondOperations = createOperations(redis);
    const firstTask = vi.fn(async () => "first");
    const secondTask = vi.fn(async () => "second");

    const [first, second] = await Promise.all([
      firstOperations.runOnce("request-a", firstTask, { distributed: false }),
      secondOperations.runOnce("request-a", secondTask, { distributed: false }),
    ]);

    expect(first).toEqual({ shared: false, value: "first" });
    expect(second).toEqual({ shared: false, value: "second" });
    expect(firstTask).toHaveBeenCalledOnce();
    expect(secondTask).toHaveBeenCalledOnce();
  });

  it("caps distributed waiters and releases their permits", async () => {
    const redis = new FakeRedisClient();
    const releases: Array<() => void> = [];
    const sleep = () =>
      new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    const ownerOperations = createOperations(redis);
    const followerOperations = Array.from(
      { length: POKEPILOT_MAX_SHARED_WAITERS + 1 },
      () => createOperations(redis, { clock: () => 0, sleep }),
    );
    let completeOwner: ((value: string) => void) | undefined;
    const ownerTask = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          completeOwner = resolve;
        }),
    );
    const owner = ownerOperations.runOnce("request-a", ownerTask, {
      maxWaiters: POKEPILOT_MAX_SHARED_WAITERS,
    });
    await vi.waitFor(() => expect(ownerTask).toHaveBeenCalledOnce());

    const followers = followerOperations
      .slice(0, POKEPILOT_MAX_SHARED_WAITERS)
      .map((operations) =>
        operations.runOnce("request-a", async () => "duplicate", {
          maxTotalWaiters: 64,
          maxWaiters: POKEPILOT_MAX_SHARED_WAITERS,
        }),
      );
    await vi.waitFor(() => expect(releases).toHaveLength(POKEPILOT_MAX_SHARED_WAITERS));

    await expect(
      followerOperations.at(-1)!.runOnce(
        "request-a",
        async () => "overflow",
        { maxTotalWaiters: 64, maxWaiters: POKEPILOT_MAX_SHARED_WAITERS },
      ),
    ).rejects.toBeInstanceOf(PokePilotCapacityError);

    completeOwner?.("shared result");
    await owner;
    releases.splice(0).forEach((release) => release());
    await expect(Promise.all(followers)).resolves.toEqual(
      Array.from({ length: POKEPILOT_MAX_SHARED_WAITERS }, () => ({
        shared: true,
        value: "shared result",
      })),
    );
    expect(
      redis.values.has("test:pokepilot:waiters:request-a"),
    ).toBe(false);
    expect(redis.values.has("test:pokepilot:waiters:total")).toBe(false);
  });
});
