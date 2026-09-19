import { describe, expect, it, vi } from "vitest";
import { handleAccountStorage } from "./accountStorage";
import type { WorkerEnvironment } from "./env";

function createEnvironment(storedPayload: string | null = null) {
  const storageWrites: unknown[][] = [];
  const accountRow = {
    id: "account-a",
    email: null,
    name: null,
    picture_url: null,
    expires_at: Date.now() + 10 * 24 * 60 * 60 * 1_000,
    session_created_at: Date.now(),
  };
  const prepare = vi.fn((query: string) => ({
    bind: (...values: unknown[]) => {
      if (query.includes("SELECT accounts.id")) {
        return { first: vi.fn().mockResolvedValue(accountRow) };
      }
      if (query.includes("SELECT payload")) {
        return { first: vi.fn().mockResolvedValue(storedPayload ? { payload: storedPayload } : null) };
      }
      if (query.includes("INSERT INTO account_storage")) {
        return {
          run: vi.fn().mockImplementation(async () => {
            storageWrites.push(values);
            return { meta: { changes: 1 } };
          }),
        };
      }
      return { run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }) };
    },
  }));
  return {
    environment: {
      ASSETS: { fetch: vi.fn() },
      DB: { prepare, batch: vi.fn() },
      POKEPILOT_SESSION_SECRET: "session-secret",
    } as unknown as WorkerEnvironment,
    prepare,
    storageWrites,
  };
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", "pokepilot_session=session-token");
  return new Request(`https://pokepilot.app${path}`, {
    ...init,
    headers,
  });
}

describe("account storage boundary", () => {
  it("returns only the authenticated account's stored teams", async () => {
    const { environment } = createEnvironment(JSON.stringify([{ id: "team-a" }]));

    const response = await handleAccountStorage(
      request("/api/pokepilot/teams"),
      environment,
      "teams",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ teams: [{ id: "team-a" }] });
  });

  it("returns an explicit empty value before the first account upload", async () => {
    const { environment } = createEnvironment();

    const response = await handleAccountStorage(
      request("/api/pokepilot/teams"),
      environment,
      "teams",
    );

    await expect(response.json()).resolves.toEqual({ teams: null });
  });

  it("rejects cross-origin writes after session validation and before storage mutation", async () => {
    const { environment, storageWrites } = createEnvironment();

    await expect(
      handleAccountStorage(
        request("/api/pokepilot/teams", {
          method: "PUT",
          headers: {
            origin: "https://attacker.example",
            "content-type": "application/json",
          },
          body: JSON.stringify({ teams: [] }),
        }),
        environment,
        "teams",
      ),
    ).rejects.toMatchObject({ status: 403, code: "AUTH_FORBIDDEN" });
    expect(storageWrites).toEqual([]);
  });

  it("writes bounded same-origin history payloads", async () => {
    const { environment, storageWrites } = createEnvironment();
    const response = await handleAccountStorage(
      request("/api/pokepilot/analysis-history", {
        method: "PUT",
        headers: {
          origin: "https://pokepilot.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ "analysis-history": [{ id: "history-a" }] }),
      }),
      environment,
      "analysis-history",
    );

    expect(response.status).toBe(204);
    expect(storageWrites[0]?.slice(0, 3)).toEqual([
      "account-a",
      "analysis-history",
      JSON.stringify([{ id: "history-a" }]),
    ]);
  });

  it("reads and writes validated account preferences", async () => {
    const preferences = {
      locale: "ko",
      themePreference: "dark",
      battleFormat: "doubles",
      tutorialCompleted: true,
    };
    const { environment, storageWrites } = createEnvironment(JSON.stringify(preferences));

    const readResponse = await handleAccountStorage(
      request("/api/pokepilot/preferences"),
      environment,
      "preferences",
    );
    await expect(readResponse.json()).resolves.toEqual({ preferences });

    const writeResponse = await handleAccountStorage(
      request("/api/pokepilot/preferences", {
        method: "PUT",
        headers: {
          origin: "https://pokepilot.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ preferences }),
      }),
      environment,
      "preferences",
    );

    expect(writeResponse.status).toBe(204);
    expect(storageWrites[0]?.slice(0, 3)).toEqual([
      "account-a",
      "preferences",
      JSON.stringify(preferences),
    ]);
  });

  it("rejects malformed preference payloads", async () => {
    const { environment, storageWrites } = createEnvironment();
    const response = await handleAccountStorage(
      request("/api/pokepilot/preferences", {
        method: "PUT",
        headers: {
          origin: "https://pokepilot.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          preferences: {
            locale: "ko",
            themePreference: "dark",
            battleFormat: "doubles",
            tutorialCompleted: true,
            unsupported: true,
          },
        }),
      }),
      environment,
      "preferences",
    );

    expect(response.status).toBe(400);
    expect(storageWrites).toEqual([]);
  });
});
