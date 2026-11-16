import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import ts from "typescript";
import type { PokePilotRequester, PokePilotRequestAdmissionDecision } from "../server/pokepilotOperations";

let runtime: Miniflare;

// This entrypoint exists only inside workerd's test runtime, never in a deployed Worker.
const entry = `
import { PokePilotAnalysisGate } from './analysisGate.js';
export class TestGate extends PokePilotAnalysisGate {
  counts() {
    return {
      requests: this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM requests').one().n,
      permits: this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM permits').one().n,
    };
  }
  expire() {
    this.ctx.storage.sql.exec('UPDATE requests SET at = ?', Date.now() - 60001);
    this.ctx.storage.sql.exec('UPDATE permits SET expires = ?', Date.now() - 1);
  }
  cleanup() { return this.alarm(); }
}
export default {
  async fetch(request, env) {
    const { name, method, args } = await request.json();
    const gate = env.GATE.getByName(name);
    try {
      const result = await gate[method](...args);
      return Response.json(result === undefined ? null : result);
    } catch {
      return new Response('Gate rejected request', { status: 500 });
    }
  }
};`;

beforeAll(async () => {
  const modules = await Promise.all(["worker/analysisGate.ts", "server/pokepilotOperations.ts"].map(async (path) => ({
    type: "esm" as const,
    path: path.replace(/\.ts$/, ".js"),
    contents: ts.transpileModule(await readFile(path, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText,
  })));
  const manifest = {
    mainModule: "worker/gate-test-entry.js",
    modules: {
      "worker/gate-test-entry.js": { type: "esm" as const, contents: entry },
      ...Object.fromEntries(modules.map(({ path, ...module }) => [path, module])),
    },
  };
  runtime = new Miniflare({
    workers: [{
      config: {
        name: "gate-test",
        compatibilityDate: "2026-09-18",
        compatibilityFlags: ["nodejs_compat"],
        manifest,
        env: { GATE: { type: "durable-object", worker: "gate-test", exportName: "TestGate" } },
        exports: { TestGate: { type: "durable-object", storage: "sqlite" } },
      },
    }, {
      config: {
        name: "second-edge",
        compatibilityDate: "2026-09-18",
        compatibilityFlags: ["nodejs_compat"],
        manifest,
        env: { GATE: { type: "durable-object", worker: "gate-test", exportName: "TestGate" } },
      },
    }],
  });
  await runtime.ready;
}, 30_000);

afterAll(async () => { await runtime?.dispose(); });

async function send(worker: string, name: string, method: string, ...args: unknown[]) {
  const source = await runtime.getWorker(worker);
  const response = await source.fetch("http://gate.test/", { method: "POST", body: JSON.stringify({ name, method, args }) });
  if (!response.ok) throw new Error("Gate rejected request");
  return response.json();
}

function call(name: string, method: "admit", requester: PokePilotRequester, token: string): Promise<PokePilotRequestAdmissionDecision>;
function call(name: string, method: "acquire", requesterId: string, token: string): Promise<boolean>;
function call(name: string, method: "counts"): Promise<{ requests: number; permits: number }>;
function call(name: string, method: "release" | "expire" | "cleanup", ...args: string[]): Promise<null>;
function call(name: string, method: string, ...args: unknown[]): Promise<unknown> {
  return send("gate-test", name, method, ...args);
}

describe("analysis admission in real Cloudflare workerd / SQLite", () => {
  it("atomically admits only 20 concurrent requests per account", async () => {
    const name = randomUUID();
    const results = await Promise.all(Array.from({ length: 30 }, () => call(name, "admit", { clientId: "same-account", ipHash: "same-ip" }, randomUUID())));
    expect(results.filter((result) => result.allowed)).toHaveLength(20);
    expect(results.filter((result) => !result.allowed)).toEqual(Array.from({ length: 10 }, () => ({ allowed: false, scope: "client", retryAfterMs: expect.any(Number) })));
    expect(await call(name, "counts")).toEqual({ requests: 20, permits: 0 });
  });

  it("shares the 80/minute IP budget across different accounts", async () => {
    const name = randomUUID();
    const results = await Promise.all(Array.from({ length: 85 }, (_, index) => call(name, "admit", { clientId: `account-${index}`, ipHash: "shared-ip" }, randomUUID())));
    expect(results.filter((result) => result.allowed)).toHaveLength(80);
    expect(results.filter((result) => !result.allowed).every((result) => result.scope === "ip")).toBe(true);
  });

  it("makes repeated RPC tokens idempotent and rejects identity substitution", async () => {
    const name = randomUUID();
    const token = randomUUID();
    const identity = { clientId: "a", ipHash: "ip-a" };
    const results = await Promise.all(Array.from({ length: 4 }, () => call(name, "admit", identity, token)));
    expect(results.every((result) => result.allowed)).toBe(true);
    await expect(call(name, "admit", { clientId: "b", ipHash: "ip-a" }, token)).rejects.toThrow();
    expect(await call(name, "acquire", "a", token)).toBe(true);
    expect(await call(name, "acquire", "a", token)).toBe(true);
    await expect(call(name, "acquire", "b", token)).rejects.toThrow();
    expect(await call(name, "counts")).toEqual({ requests: 1, permits: 1 });
  });

  it("limits each account to two running analyses and releases only the matching token", async () => {
    const name = randomUUID();
    const tokens = Array.from({ length: 4 }, () => randomUUID());
    const results = await Promise.all(tokens.slice(0, 3).map((token) => call(name, "acquire", "a", token)));
    expect(results.filter(Boolean)).toHaveLength(2);
    await call(name, "release", randomUUID());
    expect(await call(name, "acquire", "a", tokens[3])).toBe(false);
    const heldToken = tokens[results.findIndex(Boolean)];
    await call(name, "release", heldToken);
    await call(name, "release", heldToken);
    expect(await call(name, "acquire", "a", tokens[3])).toBe(true);
    expect(await call(name, "counts")).toEqual({ requests: 0, permits: 2 });
  });

  it("limits the entire service to 64 concurrent analyses", async () => {
    const name = randomUUID();
    const results = await Promise.all(Array.from({ length: 75 }, (_, index) => call(name, "acquire", `account-${index}`, randomUUID())));
    expect(results.filter(Boolean)).toHaveLength(64);
    expect(await call(name, "counts")).toEqual({ requests: 0, permits: 64 });
  });

  it("enforces a single capacity budget across distinct Worker instances", async () => {
    const name = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) =>
      send(index % 2 ? "second-edge" : "gate-test", name, "acquire", "same-account", randomUUID()),
    ));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await call(name, "counts")).toEqual({ requests: 0, permits: 2 });
  });

  it("preserves rate and capacity state after object eviction and recreation", async () => {
    const name = randomUUID();
    await call(name, "admit", { clientId: "a", ipHash: "ip" }, randomUUID());
    await call(name, "acquire", "a", randomUUID());
    await call(name, "acquire", "a", randomUUID());
    await runtime.unsafeEvictDurableObject("gate-test", "TestGate", { name });
    expect(await call(name, "counts")).toEqual({ requests: 1, permits: 2 });
    expect(await call(name, "acquire", "a", randomUUID())).toBe(false);
  });

  it("recovers expired request budgets and abandoned permits on the next request", async () => {
    const name = randomUUID();
    await Promise.all(Array.from({ length: 20 }, () => call(name, "admit", { clientId: "a", ipHash: "ip" }, randomUUID())));
    await call(name, "acquire", "a", randomUUID());
    await call(name, "acquire", "a", randomUUID());
    await call(name, "expire");
    expect(await call(name, "admit", { clientId: "a", ipHash: "ip" }, randomUUID())).toEqual({ allowed: true });
    expect(await call(name, "acquire", "a", randomUUID())).toBe(true);
    expect(await call(name, "counts")).toEqual({ requests: 1, permits: 1 });
  });

  it("cleans up expired identifiers through the idle alarm without another user request", async () => {
    const name = randomUUID();
    await call(name, "admit", { clientId: "a", ipHash: "ip" }, randomUUID());
    await call(name, "acquire", "a", randomUUID());
    await call(name, "cleanup");
    expect(await call(name, "counts")).toEqual({ requests: 1, permits: 1 });
    await call(name, "expire");
    await call(name, "cleanup");
    expect(await call(name, "counts")).toEqual({ requests: 0, permits: 0 });
  });

  it("isolates namespaces instead of leaking production budgets into QA", async () => {
    const production = randomUUID();
    const qa = randomUUID();
    await call(production, "acquire", "a", randomUUID());
    await call(production, "acquire", "a", randomUUID());
    expect(await call(production, "acquire", "a", randomUUID())).toBe(false);
    expect(await call(qa, "acquire", "a", randomUUID())).toBe(true);
  });

  it("rejects malformed identities and tokens without storing them", async () => {
    const name = randomUUID();
    await expect(call(name, "admit", { clientId: "", ipHash: "ip" }, randomUUID())).rejects.toThrow();
    await expect(call(name, "admit", { clientId: "a", ipHash: "x".repeat(257) }, randomUUID())).rejects.toThrow();
    await expect(call(name, "acquire", "a", "invalid")).rejects.toThrow();
    expect(await call(name, "counts")).toEqual({ requests: 0, permits: 0 });
  });
});
