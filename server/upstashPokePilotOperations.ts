import { randomUUID } from "node:crypto";
import type { Redis } from "@upstash/redis";
import {
  getPokePilotRatePolicies,
  POKEPILOT_ANALYSIS_CACHE_TTL_MS,
  POKEPILOT_CLIENT_REQUEST_LIMIT,
  POKEPILOT_IP_REQUEST_LIMIT,
  POKEPILOT_RATE_WINDOW_MS,
  POKEPILOT_REQUEST_WINDOW_MS,
  POKEPILOT_SHARED_WAITER_TIMEOUT_MS,
  PokePilotCapacityError,
  type PokePilotOperations,
  type PokePilotPostAnalysisCooldown,
  type PokePilotRateLimitDecision,
  type PokePilotRateLimitMode,
  type PokePilotRateLimitReservation,
  type PokePilotRequestAdmissionDecision,
  type PokePilotRequester,
  type PokePilotRunOnceOptions,
  type PokePilotRunOnceResult,
  waitForPokePilotFollower,
} from "./pokepilotOperations.js";

const defaultKeyPrefix = "pokepilot:operations:v1";
const defaultLockTtlMs = 55_000;
const defaultSharedResultTtlMs = 60_000;
const defaultWaitTimeoutMs = POKEPILOT_SHARED_WAITER_TIMEOUT_MS;

const admitRequestScript = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local eventId = ARGV[3]
local clientLimit = tonumber(ARGV[4])
local ipLimit = tonumber(ARGV[5])
local cutoff = now - windowMs

local function retryAfter(key, limit)
  redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)
  if redis.call("ZCARD", key) < limit then
    return 0
  end
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  if #oldest < 2 then
    return 1
  end
  return math.max(1, tonumber(oldest[2]) + windowMs - now)
end

local clientRetryMs = retryAfter(KEYS[1], clientLimit)
local ipRetryMs = retryAfter(KEYS[2], ipLimit)
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

const reserveRateLimitScript = `
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

const completeRateLimitReservationScript = `
local completedAt = tonumber(ARGV[1])
local eventId = ARGV[2]
local windowMs = tonumber(ARGV[3])
local clientPolicy = cjson.decode(ARGV[4])
local ipPolicy = cjson.decode(ARGV[5])
local cutoff = completedAt - windowMs

local clientUpdated = 0
local ipUpdated = 0

if redis.call("ZSCORE", KEYS[1], eventId) then
  redis.call("ZADD", KEYS[1], "XX", completedAt, eventId)
  clientUpdated = 1
end
if redis.call("ZSCORE", KEYS[2], eventId) then
  redis.call("ZADD", KEYS[2], "XX", completedAt, eventId)
  ipUpdated = 1
end

if clientUpdated > 0 then
  redis.call("PEXPIRE", KEYS[1], windowMs)
end
if ipUpdated > 0 then
  redis.call("PEXPIRE", KEYS[2], windowMs)
end

if clientUpdated == 0 and ipUpdated == 0 then
  return { clientUpdated, ipUpdated, 0, 0 }
end

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
      retryMs = math.max(
        0,
        tonumber(lastEvent[2]) + cooldownMs - completedAt
      )
    end
  end

  if policy.burst then
    local burstWindowMs = tonumber(policy.burst.windowMs)
    local burstEvents = redis.call(
      "ZRANGEBYSCORE",
      key,
      "(" .. tostring(completedAt - burstWindowMs),
      "+inf",
      "WITHSCORES"
    )
    local burstCount = #burstEvents / 2

    if burstCount >= tonumber(policy.burst.maxUses) and #burstEvents >= 2 then
      retryMs = math.max(
        retryMs,
        tonumber(burstEvents[2]) + burstWindowMs - completedAt
      )
    end
  end

  return math.max(0, retryMs)
end

local clientRetryMs = retryAfter(KEYS[1], clientPolicy)
local ipRetryMs = retryAfter(KEYS[2], ipPolicy)

if clientRetryMs <= 0 and ipRetryMs <= 0 then
  return { clientUpdated, ipUpdated, 0, 0 }
end
if clientRetryMs >= ipRetryMs then
  return { clientUpdated, ipUpdated, math.ceil(clientRetryMs), 1 }
end
return { clientUpdated, ipUpdated, math.ceil(ipRetryMs), 2 }
`;

const cancelRateLimitReservationScript = `
return {
  redis.call("ZREM", KEYS[1], ARGV[1]),
  redis.call("ZREM", KEYS[2], ARGV[1])
}
`;

const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const acquireWaiterScript = `
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local token = ARGV[3]
local keyLimit = tonumber(ARGV[4])
local totalLimit = tonumber(ARGV[5])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
redis.call("ZREMRANGEBYSCORE", KEYS[2], "-inf", now)
if redis.call("ZCARD", KEYS[1]) >= keyLimit or
   redis.call("ZCARD", KEYS[2]) >= totalLimit then
  return 0
end
redis.call("ZADD", KEYS[1], expiresAt, token)
redis.call("ZADD", KEYS[2], expiresAt, token)
redis.call("PEXPIRE", KEYS[1], expiresAt - now)
redis.call("PEXPIRE", KEYS[2], expiresAt - now)
return 1
`;

const releaseWaiterScript = `
return {
  redis.call("ZREM", KEYS[1], ARGV[1]),
  redis.call("ZREM", KEYS[2], ARGV[1])
}
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
  private totalWaiters = 0;
  private readonly waiters = new Map<string, number>();

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

  async reserve(
    requester: PokePilotRequester,
    now: number,
    mode: PokePilotRateLimitMode = "enforced",
  ): Promise<PokePilotRateLimitDecision> {
    const policies = getPokePilotRatePolicies(mode);
    const reservationId = `${now}:${randomUUID()}`;
    const result = await this.redis.eval<
      [string, string, string, string, string],
      [number, number, number]
    >(
      reserveRateLimitScript,
      this.usageKeys(requester, mode),
      [
        String(now),
        String(POKEPILOT_RATE_WINDOW_MS),
        reservationId,
        JSON.stringify(policies.client),
        JSON.stringify(policies.ip),
      ],
    );
    const allowed = Number(result[0]) === 1;

    if (allowed) {
      return {
        allowed: true,
        reservation: {
          id: reservationId,
          mode,
          requester: { ...requester },
        },
      };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(1, Number(result[1]) || 1),
      scope: Number(result[2]) === 2 ? "ip" : "client",
    };
  }

  async admitRequest(
    requester: PokePilotRequester,
    now: number,
  ): Promise<PokePilotRequestAdmissionDecision> {
    return this.admitWithFixedWindow(
      this.requestKeys(requester),
      now,
      POKEPILOT_REQUEST_WINDOW_MS,
      POKEPILOT_CLIENT_REQUEST_LIMIT,
      POKEPILOT_IP_REQUEST_LIMIT,
    );
  }

  async admitProviderAttempt(
    requester: PokePilotRequester,
    now: number,
  ): Promise<PokePilotRequestAdmissionDecision> {
    const policies = getPokePilotRatePolicies("enforced");
    const eventId = `${now}:${randomUUID()}`;
    const result = await this.redis.eval<
      [string, string, string, string, string],
      [number, number, number]
    >(
      reserveRateLimitScript,
      this.providerKeys(requester),
      [
        String(now),
        String(POKEPILOT_RATE_WINDOW_MS),
        eventId,
        JSON.stringify(policies.client),
        JSON.stringify(policies.ip),
      ],
    );

    return this.toAdmissionDecision(result);
  }

  async completeReservation(
    reservation: PokePilotRateLimitReservation,
    completedAt: number,
  ): Promise<PokePilotPostAnalysisCooldown> {
    const policies = getPokePilotRatePolicies(reservation.mode);
    const result = await this.redis.eval<
      [string, string, string, string, string],
      [number, number, number, number]
    >(
      completeRateLimitReservationScript,
      this.usageKeys(reservation.requester, reservation.mode),
      [
        String(completedAt),
        reservation.id,
        String(POKEPILOT_RATE_WINDOW_MS),
        JSON.stringify(policies.client),
        JSON.stringify(policies.ip),
      ],
    );

    const retryAfterMs = Math.max(0, Number(result[2]) || 0);
    return {
      retryAfterMs,
      scope:
        retryAfterMs <= 0
          ? null
          : Number(result[3]) === 2
            ? "ip"
            : "client",
    };
  }

  async cancelReservation(reservation: PokePilotRateLimitReservation) {
    await this.redis.eval<[string], [number, number]>(
      cancelRateLimitReservationScript,
      this.usageKeys(reservation.requester, reservation.mode),
      [reservation.id],
    );
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
      const waiterCount = this.waiters.get(key) ?? 0;
      if (
        options.maxWaiters !== undefined &&
        waiterCount >= options.maxWaiters
      ) {
        throw new PokePilotCapacityError();
      }
      if (
        options.maxTotalWaiters !== undefined &&
        this.totalWaiters >= options.maxTotalWaiters
      ) {
        throw new PokePilotCapacityError();
      }

      this.waiters.set(key, waiterCount + 1);
      this.totalWaiters += 1;
      try {
        const completed = await waitForPokePilotFollower(
          existing,
          options.waitTimeoutMs ?? this.waitTimeoutMs,
        );
        return { value: completed.value, shared: true };
      } finally {
        const remaining = (this.waiters.get(key) ?? 1) - 1;
        if (remaining > 0) this.waiters.set(key, remaining);
        else this.waiters.delete(key);
        this.totalWaiters = Math.max(0, this.totalWaiters - 1);
      }
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

  private usageKeys(
    requester: PokePilotRequester,
    mode: PokePilotRateLimitMode,
  ): [string, string] {
    return [
      this.key(`usage:${mode}:client:${requester.clientId}`),
      this.key(`usage:${mode}:ip:${requester.ipHash}`),
    ];
  }

  private requestKeys(requester: PokePilotRequester): [string, string] {
    return [
      this.key(`request:client:${requester.clientId}`),
      this.key(`request:ip:${requester.ipHash}`),
    ];
  }

  private providerKeys(requester: PokePilotRequester): [string, string] {
    return [
      this.key(`provider:client:${requester.clientId}`),
      this.key(`provider:ip:${requester.ipHash}`),
    ];
  }

  private async admitWithFixedWindow(
    keys: [string, string],
    now: number,
    windowMs: number,
    clientLimit: number,
    ipLimit: number,
  ): Promise<PokePilotRequestAdmissionDecision> {
    const result = await this.redis.eval<
      [string, string, string, string, string],
      [number, number, number]
    >(
      admitRequestScript,
      keys,
      [
        String(now),
        String(windowMs),
        `${now}:${randomUUID()}`,
        String(clientLimit),
        String(ipLimit),
      ],
    );
    return this.toAdmissionDecision(result);
  }

  private toAdmissionDecision(
    result: [number, number, number],
  ): PokePilotRequestAdmissionDecision {
    if (Number(result[0]) === 1) return { allowed: true };
    return {
      allowed: false,
      retryAfterMs: Math.max(1, Number(result[1]) || 1),
      scope: Number(result[2]) === 2 ? "ip" : "client",
    };
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
    const waiterKey = this.key(`waiters:${key}`);
    const totalWaiterKey = this.key("waiters:total");
    const deadline = this.clock() + this.waitTimeoutMs;
    let waiterToken: string | null = null;

    try {
      for (
        let attempt = 0;
        attempt < 3 && this.clock() < deadline;
        attempt += 1
      ) {
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
          if (waiterToken) {
            await this.releaseWaiter(
              waiterKey,
              totalWaiterKey,
              waiterToken,
            );
            waiterToken = null;
          }
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

        if (
          !waiterToken &&
          (options.maxWaiters !== undefined ||
            options.maxTotalWaiters !== undefined)
        ) {
          waiterToken = await this.acquireWaiter(
            waiterKey,
            totalWaiterKey,
            options.maxWaiters ?? Number.MAX_SAFE_INTEGER,
            options.maxTotalWaiters ?? Number.MAX_SAFE_INTEGER,
          );
          if (!waiterToken) throw new PokePilotCapacityError();
        }

        const shared = await this.waitForSharedResult<T>(
          lockKey,
          resultKey,
          deadline,
        );
        if (shared !== null) {
          return { value: shared, shared: true };
        }
      }
    } finally {
      if (waiterToken) {
        await this.releaseWaiter(
          waiterKey,
          totalWaiterKey,
          waiterToken,
        );
      }
    }

    throw new Error("PokePilot shared request coordination timed out.");
  }

  private async acquireWaiter(
    waiterKey: string,
    totalWaiterKey: string,
    maxWaiters: number,
    maxTotalWaiters: number,
  ) {
    const now = this.clock();
    const token = randomUUID();
    const result = await this.redis.eval<
      [string, string, string, string, string],
      number
    >(
      acquireWaiterScript,
      [waiterKey, totalWaiterKey],
      [
        String(now),
        String(now + this.waitTimeoutMs + 5_000),
        token,
        String(maxWaiters),
        String(maxTotalWaiters),
      ],
    );
    return Number(result) === 1 ? token : null;
  }

  private async releaseWaiter(
    waiterKey: string,
    totalWaiterKey: string,
    token: string,
  ) {
    await this.redis.eval<[string], [number, number]>(
      releaseWaiterScript,
      [waiterKey, totalWaiterKey],
      [token],
    );
  }

  private async waitForSharedResult<T>(
    lockKey: string,
    resultKey: string,
    deadline: number,
  ) {
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
