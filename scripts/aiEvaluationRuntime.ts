import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const smogonStatsProxyPrefix = "/smogon-stats";
const smogonStatsOrigin = "https://www.smogon.com/stats";

class MemoryStorage implements Storage {
  private readonly values: Map<string, string>;

  constructor(
    initialValues: Iterable<readonly [string, string]> = [],
    private readonly onChange?: (values: ReadonlyMap<string, string>) => void,
  ) {
    this.values = new Map(initialValues);
  }

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
    this.onChange?.(this.values);
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
    this.onChange?.(this.values);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
    this.onChange?.(this.values);
  }
}

interface AiEvaluationRuntimeOptions {
  persistStorage?: boolean;
  storagePath?: string;
}

function loadPersistedStorage(storagePath: string) {
  try {
    const parsed = JSON.parse(readFileSync(storagePath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
  } catch {
    return [];
  }
}

function createEvaluationStorage(
  projectRoot: string,
  options: AiEvaluationRuntimeOptions,
) {
  if (options.persistStorage === false) {
    return new MemoryStorage();
  }

  const storagePath =
    options.storagePath ??
    resolve(
      projectRoot,
      "node_modules",
      ".cache",
      "pokepilot-ai",
      "evaluation-local-storage.json",
    );

  return new MemoryStorage(loadPersistedStorage(storagePath), (values) => {
    mkdirSync(dirname(storagePath), { recursive: true });
    writeFileSync(
      storagePath,
      JSON.stringify(Object.fromEntries(values), null, 2),
      "utf8",
    );
  });
}

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

export function installAiEvaluationRuntime(
  projectRoot: string,
  options: AiEvaluationRuntimeOptions = {},
) {
  const nativeFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  const hadStorage = "localStorage" in globalThis;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createEvaluationStorage(projectRoot, options),
  });

  globalThis.fetch = (async (input, init) => {
    const url = getFetchUrl(input);

    if (url.startsWith("/data/")) {
      const filePath = resolve(projectRoot, "public", url.slice(1));

      try {
        const body = await readFile(filePath);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }

    if (url.startsWith(smogonStatsProxyPrefix)) {
      return nativeFetch(
        `${smogonStatsOrigin}${url.slice(smogonStatsProxyPrefix.length)}`,
        init,
      );
    }

    return nativeFetch(input, init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = nativeFetch;

    if (hadStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: previousStorage,
      });
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  };
}
