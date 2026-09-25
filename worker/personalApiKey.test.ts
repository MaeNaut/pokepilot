import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAccountSession } from "./accountAuth";
import { handlePersonalApiKey, readPersonalApiKey } from "./personalApiKey";
import type { WorkerEnvironment } from "./env";

vi.mock("./accountAuth.js", async (original) => ({
  ...await original<typeof import("./accountAuth")>(),
  readAccountSession: vi.fn(),
}));

const rows = new Map<string, { ciphertext: string; iv: string }>();
const env = {
  POKEPILOT_SESSION_SECRET: "test-only-session-secret",
  DB: {
    prepare: (statement: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          const row = rows.get(String(args[0]));
          if (statement.includes("SELECT 1 AS present")) return row ? { present: 1 } : null;
          return row ?? null;
        },
        run: async () => {
          if (statement.startsWith("DELETE")) rows.delete(String(args[0]));
          else rows.set(String(args[0]), { ciphertext: String(args[1]), iv: String(args[2]) });
          return { success: true };
        },
      }),
    }),
  },
} as unknown as WorkerEnvironment;

const endpoint = "https://pokepilot.app/api/pokepilot/personal-api-key";
const testKey = "sk-proj-test-user-key-1234567890";

function request(method: string, body?: unknown, origin = "https://pokepilot.app") {
  return new Request(endpoint, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  rows.clear();
  vi.mocked(readAccountSession).mockReset();
  vi.mocked(readAccountSession).mockResolvedValue({ account: { id: "account-a" } });
});

describe("personal API key storage", () => {
  it("encrypts the key for one account and never returns plaintext to the browser", async () => {
    const save = await handlePersonalApiKey(request("PUT", { apiKey: testKey }), env);
    expect(save.status).toBe(204);
    expect(rows.get("account-a")?.ciphertext).not.toContain(testKey);
    expect(await readPersonalApiKey("account-a", env)).toBe(testKey);
    expect(await readPersonalApiKey("account-b", env)).toBeNull();

    const status = await handlePersonalApiKey(request("GET"), env);
    const statusText = await status.clone().text();
    expect(await status.json()).toEqual({ hasKey: true });
    expect(statusText).not.toContain(testKey);

    rows.set("account-b", rows.get("account-a")!);
    await expect(readPersonalApiKey("account-b", env)).rejects.toThrow();

    expect((await handlePersonalApiKey(request("DELETE"), env)).status).toBe(204);
    expect(await readPersonalApiKey("account-a", env)).toBeNull();

    const replacementKey = "sk-proj-replacement-user-key-1234567890";
    expect((await handlePersonalApiKey(request("PUT", { apiKey: replacementKey }), env)).status).toBe(204);
    expect(await readPersonalApiKey("account-a", env)).toBe(replacementKey);
    await expect(readPersonalApiKey("account-b", env)).rejects.toThrow();
  });

  it("requires a session and same-origin writes", async () => {
    vi.mocked(readAccountSession).mockResolvedValueOnce(null);
    expect((await handlePersonalApiKey(request("GET"), env)).status).toBe(401);
    await expect(handlePersonalApiKey(request("PUT", { apiKey: testKey }, "https://evil.example"), env)).rejects.toMatchObject({ status: 403 });
    expect((await handlePersonalApiKey(request("PUT", { apiKey: "invalid" }), env)).status).toBe(400);
    expect(rows.size).toBe(0);
  });
});
