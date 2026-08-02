import { describe, expect, it, vi } from "vitest";
import { POKEPILOT_ANALYSIS_CACHE_TTL_MS } from "./pokepilotOperations";
import {
  UpstashPokePilotOperations,
  type PokePilotRedisClient,
} from "./upstashPokePilotOperations";

class FakeRedisClient {
  readonly values = new Map<string, unknown>();
  readonly setCalls: Array<{
    key: string;
    options: { nx?: true; px: number };
    value: unknown;
  }> = [];
  rateResult: [number, number, number] = [1, 0, 0];

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
    _script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    if (keys.length === 1) {
      if (this.values.get(keys[0]) === args[0]) {
        this.values.delete(keys[0]);
        return 1 as TData;
      }
      return 0 as TData;
    }

    return this.rateResult as TData;
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
      operations.consume(
        { clientId: "client-a", ipHash: "hashed-ip" },
        10_000,
      ),
    ).resolves.toEqual({
      allowed: false,
      retryAfterMs: 5_000,
      scope: "ip",
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
});
