import { describe, expect, it, vi } from "vitest";
import { InMemoryPokePilotOperations } from "./pokepilotOperations";
import { createPokePilotOperationsRuntime } from "./pokepilotOperationsRuntime";
import { UpstashPokePilotOperations } from "./upstashPokePilotOperations";

const fakeRedis = {
  del: vi.fn(),
  eval: vi.fn(),
  get: vi.fn(),
  mget: vi.fn(),
  set: vi.fn(),
};

describe("PokePilot operations runtime", () => {
  it("uses process-local memory when shared credentials are absent", () => {
    const runtime = createPokePilotOperationsRuntime({});

    expect(runtime.kind).toBe("memory");
    expect(runtime.operations).toBeInstanceOf(InMemoryPokePilotOperations);
  });

  it("uses Upstash when both REST credentials are configured", () => {
    const createRedis = vi.fn(() => fakeRedis);
    const runtime = createPokePilotOperationsRuntime(
      {
        POKEPILOT_REDIS_PREFIX: "pokepilot:test",
        UPSTASH_REDIS_REST_TOKEN: "token",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      },
      createRedis,
    );

    expect(runtime.kind).toBe("upstash");
    expect(runtime.operations).toBeInstanceOf(UpstashPokePilotOperations);
    expect(createRedis).toHaveBeenCalledWith({
      token: "token",
      url: "https://redis.example.com",
    });
  });

  it("rejects partial shared-store configuration", () => {
    expect(() =>
      createPokePilotOperationsRuntime({
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      }),
    ).toThrow(/required together/i);
  });

  it("can fail closed when production requires shared storage", () => {
    expect(() =>
      createPokePilotOperationsRuntime({
        POKEPILOT_SHARED_STORE_REQUIRED: "true",
      }),
    ).toThrow(/required but Redis credentials are missing/i);
  });
});
