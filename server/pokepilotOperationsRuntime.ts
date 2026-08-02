import { Redis } from "@upstash/redis";
import {
  InMemoryPokePilotOperations,
  type PokePilotOperations,
} from "./pokepilotOperations";
import {
  UpstashPokePilotOperations,
  type PokePilotRedisClient,
} from "./upstashPokePilotOperations";

export type PokePilotOperationsEnvironment = {
  POKEPILOT_REDIS_PREFIX?: string;
  POKEPILOT_SHARED_STORE_REQUIRED?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
};

type RedisFactory = (configuration: {
  token: string;
  url: string;
}) => PokePilotRedisClient;

export type PokePilotOperationsRuntime = {
  kind: "memory" | "upstash";
  operations: PokePilotOperations;
};

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export function createPokePilotOperationsRuntime(
  environment: PokePilotOperationsEnvironment = process.env,
  createRedis: RedisFactory = (configuration) =>
    new Redis({
      ...configuration,
      enableTelemetry: false,
      signal: () => AbortSignal.timeout(2_000),
    }),
): PokePilotOperationsRuntime {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (Boolean(url) !== Boolean(token)) {
    throw new Error(
      "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required together.",
    );
  }

  if (url && token) {
    return {
      kind: "upstash",
      operations: new UpstashPokePilotOperations({
        keyPrefix: environment.POKEPILOT_REDIS_PREFIX,
        redis: createRedis({ token, url }),
      }),
    };
  }

  if (isEnabled(environment.POKEPILOT_SHARED_STORE_REQUIRED)) {
    throw new Error(
      "PokePilot shared operations storage is required but Redis credentials are missing.",
    );
  }

  return {
    kind: "memory",
    operations: new InMemoryPokePilotOperations(),
  };
}

export function createPokePilotViteOperationsRuntime(
  mode: string,
  environment: PokePilotOperationsEnvironment,
  createRedis?: RedisFactory,
) {
  return createPokePilotOperationsRuntime(
    mode === "shared"
      ? {
          ...environment,
          POKEPILOT_SHARED_STORE_REQUIRED: "true",
        }
      : {},
    createRedis,
  );
}

let defaultRuntime: PokePilotOperationsRuntime | undefined;

export function getDefaultPokePilotOperationsRuntime() {
  if (!defaultRuntime) {
    defaultRuntime = createPokePilotOperationsRuntime();
    console.info(
      `[PokePilot API] Operations storage: ${defaultRuntime.kind}`,
    );
  }
  return defaultRuntime;
}
