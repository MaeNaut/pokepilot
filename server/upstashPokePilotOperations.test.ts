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
  readonly capacityExpirations = new Map<string, number>();
  failCapacityAcquire = false;
  failCapacityRelease = false;
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
    if (script.includes("local requesterLimit")) {
      if (this.failCapacityAcquire) throw new Error("Capacity store unavailable");
      const now = Number(args[0]);
      const sets = keys.map((key) => {
        const entries = new Map((this.values.get(key) as Map<string, number> | undefined) ?? []);
        for (const [token, expires] of entries) if (expires <= now) entries.delete(token);
        this.values.set(key, entries);
        return entries;
      });
      if (sets[0].size >= Number(args[3]) || sets[1].size >= Number(args[4])) return 0 as TData;
      sets.forEach((entries, index) => {
        entries.set(String(args[2]), Number(args[1]));
        this.capacityExpirations.set(keys[index], Math.max(...entries.values()));
      });
      return 1 as TData;
    }
    if (keys[0]?.includes(":active:") && script.includes('redis.call("ZREM"')) {
      if (this.failCapacityRelease) throw new Error("Capacity cleanup unavailable");
      for (const key of keys) (this.values.get(key) as Map<string, number> | undefined)?.delete(String(args[0]));
      return [1, 1] as TData;
    }
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
  const capacityOptions = (requesterId: string, leaseMs = 450_000) => ({
    distributed: false,
    capacity: { requesterId, maxPerRequester: 1, maxTotal: 2, leaseMs },
  });

  it("atomically bounds independent leaders across instances even without result sharing", async () => {
    const redis = new FakeRedisClient();
    const first = createOperations(redis), second = createOperations(redis), third = createOperations(redis);
    const finish: Array<(value: string) => void> = [];
    const task = () => new Promise<string>((resolve) => finish.push(resolve));
    const a = first.runOnce("low:a", task, capacityOptions("a"));
    await vi.waitFor(() => expect(finish).toHaveLength(1));
    const blocked = vi.fn(async () => "blocked");
    await expect(second.runOnce("medium:changed", blocked, capacityOptions("a"))).rejects.toBeInstanceOf(PokePilotCapacityError);
    const b = second.runOnce("b", task, capacityOptions("b"));
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    await expect(third.runOnce("c", blocked, capacityOptions("c"))).rejects.toBeInstanceOf(PokePilotCapacityError);
    expect(blocked).not.toHaveBeenCalled();
    const follower = first.runOnce("low:a", blocked, capacityOptions("a"));
    finish.forEach((resolve) => resolve("done"));
    await Promise.all([a, b, follower]);
    await expect(third.runOnce("c", async () => "next", capacityOptions("c"))).resolves.toMatchObject({ value: "next" });
    expect(redis.values.get("test:pokepilot:active:total")).toEqual(new Map());
  });

  it("uses capacity when a distributed request becomes leader and frees failed work", async () => {
    const redis = new FakeRedisClient();
    const first = createOperations(redis);
    const options = { ...capacityOptions("a"), distributed: true };
    await expect(first.runOnce("sync", () => { throw new Error("sync"); }, options)).rejects.toThrow("sync");
    await expect(first.runOnce("async", async () => { throw new Error("async"); }, options)).rejects.toThrow("async");
    expect(redis.values.get("test:pokepilot:active:total")).toEqual(new Map());
    await expect(first.runOnce("valid", async () => "ok", options)).resolves.toMatchObject({ value: "ok" });
  });

  it("fails closed on acquisition failure without starting a task", async () => {
    const redis = new FakeRedisClient(); redis.failCapacityAcquire = true;
    const task = vi.fn(async () => "unused");
    await expect(createOperations(redis).runOnce("a", task, capacityOptions("a"))).rejects.toThrow("Capacity store unavailable");
    expect(task).not.toHaveBeenCalled();
  });

  it("keeps paid results on cleanup failure and expires orphan permits", async () => {
    const redis = new FakeRedisClient(); redis.failCapacityRelease = true;
    let now = 0;
    const operations = createOperations(redis, { clock: () => now });
    const options = capacityOptions("a", 450_000);
    await expect(operations.runOnce("a", async () => "paid result", options)).resolves.toMatchObject({ value: "paid result" });
    now = 449_999;
    await expect(operations.runOnce("b", async () => "blocked", options)).rejects.toBeInstanceOf(PokePilotCapacityError);
    now = 450_000;
    redis.failCapacityRelease = false;
    await expect(operations.runOnce("c", async () => "recovered", options)).resolves.toMatchObject({ value: "recovered" });
  });

  it("does not shorten a shared key's TTL when a shorter permit joins", async () => {
    const redis = new FakeRedisClient();
    const operations = createOperations(redis, { clock: () => 0 });
    const finish: Array<(value: string) => void> = [];
    const task = () => new Promise<string>((resolve) => finish.push(resolve));
    const long = operations.runOnce("long", task, capacityOptions("a", 450_000));
    await vi.waitFor(() => expect(finish).toHaveLength(1));
    const short = operations.runOnce("short", task, capacityOptions("b", 180_000));
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    expect(redis.capacityExpirations.get("test:pokepilot:active:total")).toBe(450_000);
    const script = redis.evalCalls.find((call) => call.script.includes("local requesterLimit"))!.script;
    expect(script).toContain('"ZREVRANGE"');
    expect(script).toContain('tonumber(latest[2]) - now');
    finish.forEach((resolve) => resolve("done")); await Promise.all([long, short]);
  });

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
