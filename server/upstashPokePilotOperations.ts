import { randomUUID } from "node:crypto";
import type { Redis } from "@upstash/redis";
import {
  getPokePilotRatePolicies,
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_RATE_WINDOW_MS,
  type PokePilotOperations,
  type PokePilotRateLimitDecision,
  type PokePilotRateLimitMode,
  type PokePilotRequester,
  type PokePilotRunOnceOptions,
  type PokePilotRunOnceResult,
} from "./pokepilotOperations";

const defaultKeyPrefix = "pokepilot:operations:v1";
const defaultLockTtlMs = 75_000;
const defaultSharedResultTtlMs = 90_000;
const defaultWaitTimeoutMs = 78_000;

const consumeRateLimitScript = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local eventId = ARGV[3]
local clientPolicy = cjson.decode(ARGV[4])
local ipPolicy = cjson.decode(ARGV[5])
local cutoff = now - windowMs

local function retryAfter(key, policy)
  redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)
  local count = redis.call("ZCARD", key)
  local cooldownMs = 0

  for _, step in ipairs(policy.cooldownSteps) do
    if count >= tonumber(step.afterUses) then
      cooldownMs = tonumber(step.cooldownMs)
    end
  end

  local retryMs = 0
  if cooldownMs > 0 and count > 0 then
    local lastEvent = redis.call("ZRANGE", key, -1, -1, "WITHSCORES")
    if #lastEvent >= 2 then
      retryMs = math.max(0, tonumber(lastEvent[2]) + cooldownMs - now)
    end
  end

  if policy.burst then
    local burstWindowMs = tonumber(policy.burst.windowMs)
    local burstEvents = redis.call(
      "ZRANGEBYSCORE",
      key,
      "(" .. tostring(now - burstWindowMs),
      "+inf",
      "WITHSCORES"
    )
    local burstCount = #burstEvents / 2

    if burstCount >= tonumber(policy.burst.maxUses) and #burstEvents >= 2 then
      retryMs = math.max(
        retryMs,
        tonumber(burstEvents[2]) + burstWindowMs - now
      )
    end
  end

  return math.max(0, retryMs)
end

local clientRetryMs = retryAfter(KEYS[1], clientPolicy)
local ipRetryMs = retryAfter(KEYS[2], ipPolicy)

if clientRetryMs > 0 or ipRetryMs > 0 then
  if clientRetryMs >= ipRetryMs then
    return { 0, math.ceil(clientRetryMs), 1 }
  end
  return { 0, math.ceil(ipRetryMs), 2 }
end

redis.call("ZADD", KEYS[1], now, eventId)
redis.call("ZADD", KEYS[2], now, eventId)
redis.call("PEXPIRE", KEYS[1], windowMs)
redis.call("PEXPIRE", KEYS[2], windowMs)
return { 1, 0, 0 }
`;

const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

type RedisSetOptions =
  | { nx: true; px: number }
  | { nx?: never; px: number };

export type PokePilotRedisClient = Pick<Redis, "del" | "get" | "mget"> & {
  eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData>;
  set<T>(
    key: string,
    value: T,
    options: RedisSetOptions,
  ): Promise<"OK" | T | null>;
};

type UpstashPokePilotOperationsOptions = {
  clock?: () => number;
  keyPrefix?: string;
  lockTtlMs?: number;
  redis: PokePilotRedisClient;
  sharedResultTtlMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  waitTimeoutMs?: number;
};

type SharedResult<T> = {
  value: T;
  version: 1;
};

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeKeyPrefix(value: string | undefined) {
  return value?.trim().replace(/:+$/, "") || defaultKeyPrefix;
}

function isSharedResult<T>(value: unknown): value is SharedResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    "version" in value &&
    value.version === 1
  );
}

export class UpstashPokePilotOperations implements PokePilotOperations {
  private readonly clock: () => number;
  private readonly inFlight = new Map<
    string,
    Promise<PokePilotRunOnceResult<unknown>>
  >();
  private readonly keyPrefix: string;
  private readonly lockTtlMs: number;
  private readonly redis: PokePilotRedisClient;
  private readonly sharedResultTtlMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly waitTimeoutMs: number;

  constructor({
    clock = Date.now,
    keyPrefix,
    lockTtlMs = defaultLockTtlMs,
    redis,
    sharedResultTtlMs = defaultSharedResultTtlMs,
    sleep = defaultSleep,
    waitTimeoutMs = defaultWaitTimeoutMs,
  }: UpstashPokePilotOperationsOptions) {
    this.clock = clock;
    this.keyPrefix = normalizeKeyPrefix(keyPrefix);
    this.lockTtlMs = lockTtlMs;
    this.redis = redis;
    this.sharedResultTtlMs = sharedResultTtlMs;
    this.sleep = sleep;
    this.waitTimeoutMs = waitTimeoutMs;
  }

  async consume(
    requester: PokePilotRequester,
    now: number,
    mode: PokePilotRateLimitMode = "enforced",
  ): Promise<PokePilotRateLimitDecision> {
    const policies = getPokePilotRatePolicies(mode);
    const result = await this.redis.eval<
      [string, string, string, string, string],
      [number, number, number]
    >(
      consumeRateLimitScript,
      [
        this.key(`usage:${mode}:client:${requester.clientId}`),
        this.key(`usage:${mode}:ip:${requester.ipHash}`),
      ],
      [
        String(now),
        String(POKEPILOT_RATE_WINDOW_MS),
        `${now}:${randomUUID()}`,
        JSON.stringify(policies.client),
        JSON.stringify(policies.ip),
      ],
    );
    const allowed = Number(result[0]) === 1;

    if (allowed) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(1, Number(result[1]) || 1),
      scope: Number(result[2]) === 2 ? "ip" : "client",
    };
  }

  getCached<T>(key: string, _now: number) {
    void _now;
    return this.redis.get<T>(this.cacheKey(key));
  }

  async runOnce<T>(
    key: string,
    task: () => Promise<T>,
    options: PokePilotRunOnceOptions<T> = {},
  ): Promise<PokePilotRunOnceResult<T>> {
    const existing = this.inFlight.get(key) as
      | Promise<PokePilotRunOnceResult<T>>
      | undefined;

    if (existing) {
      const completed = await existing;
      return { value: completed.value, shared: true };
    }

    const promise =
      options.distributed === false
        ? task().then((value) => ({ value, shared: false }))
        : this.runDistributed(key, task, options);
    this.inFlight.set(
      key,
      promise as Promise<PokePilotRunOnceResult<unknown>>,
    );

    try {
      return await promise;
    } finally {
      if (this.inFlight.get(key) === promise) {
        this.inFlight.delete(key);
      }
    }
  }

  async setCached<T>(key: string, value: T, _now: number) {
    void _now;
    await this.redis.set(this.cacheKey(key), value, {
      px: POKEPILOT_ANALYSIS_CACHE_TTL_MS,
    });
  }

  private cacheKey(key: string) {
    return this.key(`cache:${key}`);
  }

  private key(value: string) {
    return `${this.keyPrefix}:${value}`;
  }

  private async readSharedResult<T>(resultKey: string) {
    const value = await this.redis.get<SharedResult<T>>(resultKey);
    return isSharedResult<T>(value) ? value.value : null;
  }

  private async releaseLock(lockKey: string, token: string) {
    await this.redis.eval<[string], number>(
      releaseLockScript,
      [lockKey],
      [token],
    );
  }

  private async runDistributed<T>(
    key: string,
    task: () => Promise<T>,
    options: PokePilotRunOnceOptions<T>,
  ): Promise<PokePilotRunOnceResult<T>> {
    const lockKey = this.key(`lock:${key}`);
    const resultKey = this.key(`result:${key}`);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const completed = await this.readSharedResult<T>(resultKey);
      if (completed !== null) {
        return { value: completed, shared: true };
      }

      const token = randomUUID();
      const acquired =
        (await this.redis.set(lockKey, token, {
          nx: true,
          px: this.lockTtlMs,
        })) === "OK";

      if (acquired) {
        try {
          const value = await task();
          if (options.shouldShare?.(value) !== false) {
            await this.redis.set<SharedResult<T>>(
              resultKey,
              { value, version: 1 },
              { px: this.sharedResultTtlMs },
            );
          }
          return { value, shared: false };
        } finally {
          await this.releaseLock(lockKey, token);
        }
      }

      const shared = await this.waitForSharedResult<T>(lockKey, resultKey);
      if (shared !== null) {
        return { value: shared, shared: true };
      }
    }

    throw new Error("PokePilot shared request coordination timed out.");
  }

  private async waitForSharedResult<T>(lockKey: string, resultKey: string) {
    const deadline = this.clock() + this.waitTimeoutMs;
    let delayMs = 200;

    while (this.clock() < deadline) {
      const [result, lock] = await this.redis.mget<
        [SharedResult<T> | null, string | null]
      >(resultKey, lockKey);

      if (isSharedResult<T>(result)) {
        return result.value;
      }
      if (lock === null) {
        return null;
      }

      await this.sleep(delayMs);
      delayMs = Math.min(2_000, Math.ceil(delayMs * 1.6));
    }

    return null;
  }
}
