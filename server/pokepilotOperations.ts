import { createHash, randomUUID } from "node:crypto";

export const POKEPILOT_ANALYSIS_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
export const POKEPILOT_RATE_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const POKEPILOT_COOLDOWN_TEST_DURATION_MS = 10_000;
export const POKEPILOT_REQUEST_WINDOW_MS = 60_000;
export const POKEPILOT_CLIENT_REQUEST_LIMIT = 20;
export const POKEPILOT_IP_REQUEST_LIMIT = 80;
export const POKEPILOT_MAX_SHARED_WAITERS = 4;
export const POKEPILOT_MAX_TOTAL_SHARED_WAITERS = 64;
export const POKEPILOT_SHARED_WAITER_TIMEOUT_MS = 50_000;

const maxCacheEntries = 500;
const maxTrackedIdentities = 20_000;

type CooldownStep = {
  afterUses: number;
  cooldownMs: number;
};

export type PokePilotRatePolicy = {
  cooldownSteps: CooldownStep[];
  burst?: {
    maxUses: number;
    windowMs: number;
  };
};

export type PokePilotSafeguardMode =
  | "enforced"
  | "ai-test"
  | "ai-fresh"
  | "cooldown-test";

export type PokePilotRateLimitMode = Exclude<
  PokePilotSafeguardMode,
  "ai-test" | "ai-fresh"
>;

export type PokePilotSafeguardConfig = {
  cacheEnabled: boolean;
  providerAttemptLimitEnabled: boolean;
  requestRateLimitEnabled: boolean;
  rateLimitMode: PokePilotRateLimitMode | null;
};

const clientRatePolicy: PokePilotRatePolicy = {
  cooldownSteps: [
    { afterUses: 5, cooldownMs: 60_000 },
    { afterUses: 7, cooldownMs: 5 * 60_000 },
    { afterUses: 9, cooldownMs: 15 * 60_000 },
    { afterUses: 11, cooldownMs: 60 * 60_000 },
  ],
};

const ipRatePolicy: PokePilotRatePolicy = {
  cooldownSteps: [
    { afterUses: 20, cooldownMs: 5 * 60_000 },
    { afterUses: 25, cooldownMs: 15 * 60_000 },
    { afterUses: 30, cooldownMs: 60 * 60_000 },
    { afterUses: 36, cooldownMs: 6 * 60 * 60_000 },
  ],
  burst: {
    maxUses: 8,
    windowMs: 60_000,
  },
};

const cooldownTestClientRatePolicy: PokePilotRatePolicy = {
  cooldownSteps: [
    {
      afterUses: 1,
      cooldownMs: POKEPILOT_COOLDOWN_TEST_DURATION_MS,
    },
  ],
};

const cooldownTestIpRatePolicy: PokePilotRatePolicy = {
  cooldownSteps: [],
};

const ratePolicies: Record<
  PokePilotRateLimitMode,
  { client: PokePilotRatePolicy; ip: PokePilotRatePolicy }
> = {
  enforced: {
    client: clientRatePolicy,
    ip: ipRatePolicy,
  },
  "cooldown-test": {
    client: cooldownTestClientRatePolicy,
    ip: cooldownTestIpRatePolicy,
  },
};

export function getPokePilotRatePolicies(mode: PokePilotRateLimitMode) {
  return ratePolicies[mode];
}

export function getPokePilotSafeguardConfig(
  mode: PokePilotSafeguardMode,
): PokePilotSafeguardConfig {
  if (mode === "ai-test") {
    return {
      cacheEnabled: true,
      providerAttemptLimitEnabled: false,
      requestRateLimitEnabled: false,
      rateLimitMode: null,
    };
  }

  if (mode === "ai-fresh") {
    return {
      cacheEnabled: false,
      providerAttemptLimitEnabled: false,
      requestRateLimitEnabled: false,
      rateLimitMode: null,
    };
  }

  if (mode === "cooldown-test") {
    return {
      cacheEnabled: false,
      providerAttemptLimitEnabled: false,
      requestRateLimitEnabled: false,
      rateLimitMode: "cooldown-test",
    };
  }

  return {
    cacheEnabled: true,
    providerAttemptLimitEnabled: true,
    requestRateLimitEnabled: true,
    rateLimitMode: "enforced",
  };
}

export function resolvePokePilotSafeguardMode(
  viteMode: string,
): PokePilotSafeguardMode {
  if (
    viteMode === "ai-test" ||
    viteMode === "ai-fresh" ||
    viteMode === "cooldown-test"
  ) {
    return viteMode;
  }

  return "enforced";
}

export type PokePilotRequester = {
  clientId: string;
  ipHash: string;
};

export type PokePilotRateLimitReservation = {
  id: string;
  mode: PokePilotRateLimitMode;
  requester: PokePilotRequester;
};

export type PokePilotRateLimitDecision =
  | {
      allowed: true;
      reservation: PokePilotRateLimitReservation;
    }
  | {
      allowed: false;
      retryAfterMs: number;
      scope: "client" | "ip";
    };

export type PokePilotPostAnalysisCooldown = {
  retryAfterMs: number;
  scope: "client" | "ip" | null;
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
  admitProviderAttempt(
    requester: PokePilotRequester,
    now: number,
  ): MaybePromise<PokePilotRequestAdmissionDecision>;
  reserve(
    requester: PokePilotRequester,
    now: number,
    mode?: PokePilotRateLimitMode,
  ): MaybePromise<PokePilotRateLimitDecision>;
  completeReservation(
    reservation: PokePilotRateLimitReservation,
    completedAt: number,
  ): MaybePromise<PokePilotPostAnalysisCooldown>;
  cancelReservation(
    reservation: PokePilotRateLimitReservation,
  ): MaybePromise<void>;
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

type RateLimitEvent = {
  id: string;
  timestamp: number;
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

function getCooldownMs(useCount: number, policy: PokePilotRatePolicy) {
  let cooldownMs = 0;

  for (const step of policy.cooldownSteps) {
    if (useCount < step.afterUses) {
      break;
    }
    cooldownMs = step.cooldownMs;
  }

  return cooldownMs;
}

function evaluateRatePolicy(
  events: RateLimitEvent[],
  now: number,
  policy: PokePilotRatePolicy,
) {
  const lastEvent = events.at(-1);
  const cooldownMs = getCooldownMs(events.length, policy);
  let retryAfterMs =
    lastEvent === undefined
      ? 0
      : Math.max(0, lastEvent.timestamp + cooldownMs - now);

  if (policy.burst) {
    const burstEvents = events.filter(
      (event) => event.timestamp > now - policy.burst!.windowMs,
    );

    if (burstEvents.length >= policy.burst.maxUses) {
      retryAfterMs = Math.max(
        retryAfterMs,
        burstEvents[0].timestamp + policy.burst.windowMs - now,
      );
    }
  }

  return Math.max(0, retryAfterMs);
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
  private readonly providerUsage = new Map<string, RateLimitEvent[]>();
  private readonly requestUsage = new Map<string, number[]>();
  private readonly usage = new Map<string, RateLimitEvent[]>();
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

  admitProviderAttempt(
    requester: PokePilotRequester,
    now: number,
  ): PokePilotRequestAdmissionDecision {
    this.pruneUsage(now);
    const clientKey = `provider:client:${requester.clientId}`;
    const ipKey = `provider:ip:${requester.ipHash}`;
    const clientEvents = this.providerUsage.get(clientKey) ?? [];
    const ipEvents = this.providerUsage.get(ipKey) ?? [];
    const clientRetryAfterMs = evaluateRatePolicy(
      clientEvents,
      now,
      clientRatePolicy,
    );
    const ipRetryAfterMs = evaluateRatePolicy(ipEvents, now, ipRatePolicy);

    if (clientRetryAfterMs > 0 || ipRetryAfterMs > 0) {
      return clientRetryAfterMs >= ipRetryAfterMs
        ? { allowed: false, retryAfterMs: clientRetryAfterMs, scope: "client" }
        : { allowed: false, retryAfterMs: ipRetryAfterMs, scope: "ip" };
    }

    const event = { id: randomUUID(), timestamp: now };
    this.providerUsage.set(clientKey, [...clientEvents, event]);
    this.providerUsage.set(ipKey, [...ipEvents, event]);
    this.enforceUsageCapacity();
    return { allowed: true };
  }

  reserve(
    requester: PokePilotRequester,
    now: number,
    mode: PokePilotRateLimitMode = "enforced",
  ): PokePilotRateLimitDecision {
    this.pruneUsage(now);

    const policies = ratePolicies[mode];
    const { clientKey, ipKey } = this.getUsageKeys(requester, mode);
    const clientEvents = this.usage.get(clientKey) ?? [];
    const ipEvents = this.usage.get(ipKey) ?? [];
    const clientRetryAfterMs = evaluateRatePolicy(
      clientEvents,
      now,
      policies.client,
    );
    const ipRetryAfterMs = evaluateRatePolicy(ipEvents, now, policies.ip);

    if (clientRetryAfterMs > 0 || ipRetryAfterMs > 0) {
      return clientRetryAfterMs >= ipRetryAfterMs
        ? {
            allowed: false,
            retryAfterMs: clientRetryAfterMs,
            scope: "client",
          }
        : {
            allowed: false,
            retryAfterMs: ipRetryAfterMs,
            scope: "ip",
          };
    }

    const reservation: PokePilotRateLimitReservation = {
      id: randomUUID(),
      mode,
      requester: { ...requester },
    };
    const event = { id: reservation.id, timestamp: now };
    this.usage.set(clientKey, [...clientEvents, event]);
    this.usage.set(ipKey, [...ipEvents, event]);
    this.enforceUsageCapacity();
    return { allowed: true, reservation };
  }

  completeReservation(
    reservation: PokePilotRateLimitReservation,
    completedAt: number,
  ) {
    this.updateReservation(reservation, (event) => ({
      ...event,
      timestamp: completedAt,
    }));

    const policies = ratePolicies[reservation.mode];
    const { clientKey, ipKey } = this.getUsageKeys(
      reservation.requester,
      reservation.mode,
    );
    const clientRetryAfterMs = evaluateRatePolicy(
      this.usage.get(clientKey) ?? [],
      completedAt,
      policies.client,
    );
    const ipRetryAfterMs = evaluateRatePolicy(
      this.usage.get(ipKey) ?? [],
      completedAt,
      policies.ip,
    );

    if (clientRetryAfterMs <= 0 && ipRetryAfterMs <= 0) {
      return { retryAfterMs: 0, scope: null };
    }

    return clientRetryAfterMs >= ipRetryAfterMs
      ? { retryAfterMs: clientRetryAfterMs, scope: "client" as const }
      : { retryAfterMs: ipRetryAfterMs, scope: "ip" as const };
  }

  cancelReservation(reservation: PokePilotRateLimitReservation) {
    this.updateReservation(reservation, () => null);
  }

  private pruneCache(now: number) {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private pruneUsage(now: number) {
    const cutoff = now - POKEPILOT_RATE_WINDOW_MS;

    for (const usage of [this.usage, this.providerUsage]) {
      for (const [key, events] of usage) {
        const retained = events.filter((event) => event.timestamp > cutoff);
        if (retained.length > 0) {
          usage.set(key, retained);
        } else {
          usage.delete(key);
        }
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
    while (this.usage.size > maxTrackedIdentities) {
      const oldestKey = this.usage.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }
      this.usage.delete(oldestKey);
    }

    while (this.requestUsage.size > maxTrackedIdentities) {
      const oldestKey = this.requestUsage.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) return;
      this.requestUsage.delete(oldestKey);
    }

    while (this.providerUsage.size > maxTrackedIdentities) {
      const oldestKey = this.providerUsage.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) return;
      this.providerUsage.delete(oldestKey);
    }
  }

  private getUsageKeys(
    requester: PokePilotRequester,
    mode: PokePilotRateLimitMode,
  ) {
    return {
      clientKey: `${mode}:client:${requester.clientId}`,
      ipKey: `${mode}:ip:${requester.ipHash}`,
    };
  }

  private updateReservation(
    reservation: PokePilotRateLimitReservation,
    update: (event: RateLimitEvent) => RateLimitEvent | null,
  ) {
    const { clientKey, ipKey } = this.getUsageKeys(
      reservation.requester,
      reservation.mode,
    );

    for (const key of [clientKey, ipKey]) {
      const events = this.usage.get(key);
      if (!events) {
        continue;
      }

      const updated = events.flatMap((event) => {
        if (event.id !== reservation.id) {
          return [event];
        }
        const next = update(event);
        return next ? [next] : [];
      }).sort((left, right) => left.timestamp - right.timestamp);

      if (updated.length > 0) {
        this.usage.set(key, updated);
      } else {
        this.usage.delete(key);
      }
    }
  }
}
