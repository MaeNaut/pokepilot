import { createHash } from "node:crypto";

export const POKEPILOT_ANALYSIS_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
export const POKEPILOT_REQUEST_WINDOW_MS = 60_000;
export const POKEPILOT_CLIENT_REQUEST_LIMIT = 20;
export const POKEPILOT_IP_REQUEST_LIMIT = 80;
export const POKEPILOT_MAX_SHARED_WAITERS = 4;
export const POKEPILOT_MAX_TOTAL_SHARED_WAITERS = 64;
export const POKEPILOT_SHARED_WAITER_TIMEOUT_MS = 50_000;

const maxCacheEntries = 500;
const maxTrackedIdentities = 20_000;

export type PokePilotSafeguardMode = "enforced" | "ai-test" | "ai-fresh";
export type PokePilotSafeguardConfig = {
  cacheEnabled: boolean;
  requestRateLimitEnabled: boolean;
};
export function getPokePilotSafeguardConfig(mode: PokePilotSafeguardMode): PokePilotSafeguardConfig {
  return { cacheEnabled: mode !== "ai-fresh", requestRateLimitEnabled: mode === "enforced" };
}
export function resolvePokePilotSafeguardMode(viteMode: string): PokePilotSafeguardMode {
  return viteMode === "ai-test" || viteMode === "ai-fresh" ? viteMode : "enforced";
}

export type PokePilotRequester = {
  clientId: string;
  ipHash: string;
};

export type PokePilotRequestAdmissionDecision =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterMs: number;
      scope: "client" | "ip";
    };

export type PokePilotRunOnceResult<T> = {
  shared: boolean;
  value: T;
};

export type PokePilotRunOnceOptions<T> = {
  distributed?: boolean;
  maxTotalWaiters?: number;
  maxWaiters?: number;
  shouldShare?: (value: T) => boolean;
  waitTimeoutMs?: number;
};

export class PokePilotCapacityError extends Error {
  readonly code = "TOO_MANY_WAITERS";

  constructor() {
    super("Too many requests are waiting for the same analysis.");
    this.name = "PokePilotCapacityError";
  }
}

export async function waitForPokePilotFollower<T>(
  promise: Promise<T>,
  timeoutMs = POKEPILOT_SHARED_WAITER_TIMEOUT_MS,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new PokePilotCapacityError()), timeoutMs);
  });

  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

type MaybePromise<T> = T | Promise<T>;

export interface PokePilotOperations {
  admitRequest(
    requester: PokePilotRequester,
    now: number,
  ): MaybePromise<PokePilotRequestAdmissionDecision>;
  getCached<T>(key: string, now: number): MaybePromise<T | null>;
  runOnce<T>(
    key: string,
    task: () => Promise<T>,
    options?: PokePilotRunOnceOptions<T>,
  ): Promise<PokePilotRunOnceResult<T>>;
  setCached<T>(key: string, value: T, now: number): MaybePromise<void>;
}

type CacheEntry = {
  expiresAt: number;
  lastAccessedAt: number;
  value: unknown;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export function createPokePilotAnalysisCacheKey(
  request: unknown,
  model: string,
  promptVersion: number,
  reasoningEffort: string,
) {
  return createHash("sha256")
    .update(
      `${model}\n${promptVersion}\n${reasoningEffort}\n${stableSerialize(request)}`,
    )
    .digest("hex");
}

function getRequestRetryAfter(
  timestamps: number[],
  now: number,
  limit: number,
) {
  if (timestamps.length < limit) return 0;
  return Math.max(1, timestamps[0] + POKEPILOT_REQUEST_WINDOW_MS - now);
}

export class InMemoryPokePilotOperations implements PokePilotOperations {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<PokePilotRunOnceResult<unknown>>
  >();
  private readonly requestUsage = new Map<string, number[]>();
  private totalWaiters = 0;
  private readonly waiters = new Map<string, number>();

  getCached<T>(key: string, now: number): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= now) {
      this.cache.delete(key);
      return null;
    }

    entry.lastAccessedAt = now;
    return entry.value as T;
  }

  setCached<T>(key: string, value: T, now: number) {
    this.pruneCache(now);
    this.cache.set(key, {
      expiresAt: now + POKEPILOT_ANALYSIS_CACHE_TTL_MS,
      lastAccessedAt: now,
      value,
    });

    if (this.cache.size > maxCacheEntries) {
      const oldest = [...this.cache.entries()].sort(
        (left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt,
      )[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }
  }

  async runOnce<T>(
    key: string,
    task: () => Promise<T>,
    options: PokePilotRunOnceOptions<T> = {},
  ) {
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
          options.waitTimeoutMs,
        );
        return { value: completed.value, shared: true };
      } finally {
        const remaining = (this.waiters.get(key) ?? 1) - 1;
        if (remaining > 0) this.waiters.set(key, remaining);
        else this.waiters.delete(key);
        this.totalWaiters = Math.max(0, this.totalWaiters - 1);
      }
    }

    const promise = task().then((value) => ({ value, shared: false }));
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

  admitRequest(
    requester: PokePilotRequester,
    now: number,
  ): PokePilotRequestAdmissionDecision {
    this.pruneRequestUsage(now);
    const clientKey = `request:client:${requester.clientId}`;
    const ipKey = `request:ip:${requester.ipHash}`;
    const clientEvents = this.requestUsage.get(clientKey) ?? [];
    const ipEvents = this.requestUsage.get(ipKey) ?? [];
    const clientRetryAfterMs = getRequestRetryAfter(
      clientEvents,
      now,
      POKEPILOT_CLIENT_REQUEST_LIMIT,
    );
    const ipRetryAfterMs = getRequestRetryAfter(
      ipEvents,
      now,
      POKEPILOT_IP_REQUEST_LIMIT,
    );

    if (clientRetryAfterMs > 0 || ipRetryAfterMs > 0) {
      return clientRetryAfterMs >= ipRetryAfterMs
        ? { allowed: false, retryAfterMs: clientRetryAfterMs, scope: "client" }
        : { allowed: false, retryAfterMs: ipRetryAfterMs, scope: "ip" };
    }

    this.requestUsage.set(clientKey, [...clientEvents, now]);
    this.requestUsage.set(ipKey, [...ipEvents, now]);
    this.enforceUsageCapacity();
    return { allowed: true };
  }

  private pruneCache(now: number) {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private pruneRequestUsage(now: number) {
    const cutoff = now - POKEPILOT_REQUEST_WINDOW_MS;

    for (const [key, events] of this.requestUsage) {
      const retained = events.filter((timestamp) => timestamp > cutoff);
      if (retained.length > 0) this.requestUsage.set(key, retained);
      else this.requestUsage.delete(key);
    }
  }

  private enforceUsageCapacity() {
    while (this.requestUsage.size > maxTrackedIdentities) {
      const oldestKey = this.requestUsage.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) return;
      this.requestUsage.delete(oldestKey);
    }

  }
}
