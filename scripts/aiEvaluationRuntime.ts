import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
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

export function installAiEvaluationRuntime(projectRoot: string) {
  const nativeFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  const hadStorage = "localStorage" in globalThis;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
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
