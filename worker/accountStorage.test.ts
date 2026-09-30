import { describe, expect, it, vi } from "vitest";
import { handleAccountStorage } from "./accountStorage";
import type { WorkerEnvironment } from "./env";

function createEnvironment(storedPayload: string | null = null) {
  let payload = storedPayload;
  let updatedAt = storedPayload === null ? null : Date.now();
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
        if (query.includes("'teams-v2'")) return { first: vi.fn().mockResolvedValue(null) };
        return { first: vi.fn().mockImplementation(async () => payload === null ? null : { payload, updated_at: updatedAt }) };
      }
      if (query.includes("INSERT INTO account_storage") || query.includes("UPDATE account_storage")) {
        return {
          run: vi.fn().mockImplementation(async () => {
            if (query.includes("UPDATE") &&
                (payload === null || payload !== values[4] || updatedAt !== values[5])) {
              return { meta: { changes: 0 } };
            }
            if (query.includes("INSERT") && payload !== null) return { meta: { changes: 0 } };
            storageWrites.push(values);
            payload = query.includes("UPDATE") ? values[0] as string : values[2] as string;
            updatedAt = (query.includes("UPDATE") ? values[1] : values[3]) as number;
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
    getPayload: () => payload,
  };
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", "pokepilot_session=session-token");
  if (!headers.has("X-PokePilot-Account-Id")) headers.set("X-PokePilot-Account-Id", "account-a");
  return new Request(`https://pokepilot.app${path}`, {
    ...init,
    headers,
  });
}

describe("account storage boundary", () => {
  it("rejects a stale tab before reading or writing another account's storage", async () => {
    const { environment, prepare, storageWrites } = createEnvironment();
    const staleHeaders = { "X-PokePilot-Account-Id": "previous-account" };
    const read = await handleAccountStorage(
      request("/api/pokepilot/teams", { headers: staleHeaders }), environment, "teams",
    );
    const write = await handleAccountStorage(
      request("/api/pokepilot/teams", {
        method: "PUT",
        headers: { ...staleHeaders, origin: "https://pokepilot.app", "If-Match": '"empty"' },
        body: JSON.stringify({ teams: [] }),
      }), environment, "teams",
    );
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    const missing = await handleAccountStorage(new Request("https://pokepilot.app/api/pokepilot/teams", {
      headers: { cookie: "pokepilot_session=session-token" },
    }), environment, "teams");
    expect(missing.status).toBe(403);
    expect(storageWrites).toEqual([]);
    expect(prepare.mock.calls.some(([query]) => String(query).includes("account_storage"))).toBe(false);
  });

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
          "If-Match": '"empty"',
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
      analysis: { scope: "pokemon", modelId: "gpt-6-luna", reasoningEffort: "low" },
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
    const version = readResponse.headers.get("ETag")!;

    const writeResponse = await handleAccountStorage(
      request("/api/pokepilot/preferences", {
        method: "PUT",
        headers: {
          origin: "https://pokepilot.app",
          "content-type": "application/json",
          "If-Match": version,
        },
        body: JSON.stringify({ preferences }),
      }),
      environment,
      "preferences",
    );

    expect(writeResponse.status).toBe(204);
    expect(storageWrites[0]?.[0]).toEqual(JSON.stringify(preferences));
    expect(writeResponse.headers.get("ETag")).not.toBe(version);
  });

  it("rejects an old version instead of overwriting another device's team", async () => {
    const { environment, getPayload } = createEnvironment(JSON.stringify([{ id: "original" }]));
    const initial = await handleAccountStorage(request("/api/pokepilot/teams"), environment, "teams");
    const version = initial.headers.get("ETag")!;
    const write = (id: string) => handleAccountStorage(request("/api/pokepilot/teams", {
      method: "PUT",
      headers: { origin: "https://pokepilot.app", "content-type": "application/json", "If-Match": version },
      body: JSON.stringify({ teams: [{ id: "original" }, { id }] }),
    }), environment, "teams");
    expect((await write("desktop")).status).toBe(204);
    const stale = await write("mobile");
    expect(stale.status).toBe(409);
    expect(JSON.parse(getPayload()!)).toEqual([{ id: "original" }, { id: "desktop" }]);
  });

  it("rejects a stale version even after the payload returns to its original value", async () => {
    const original = [{ id: "original" }];
    const { environment, getPayload } = createEnvironment(JSON.stringify(original));
    const readVersion = async () => (await handleAccountStorage(
      request("/api/pokepilot/teams"), environment, "teams",
    )).headers.get("ETag")!;
    const write = (teams: unknown[], version: string) => handleAccountStorage(
      request("/api/pokepilot/teams", {
        method: "PUT",
        headers: { origin: "https://pokepilot.app", "content-type": "application/json", "If-Match": version },
        body: JSON.stringify({ teams }),
      }), environment, "teams",
    );

    const staleVersion = await readVersion();
    expect((await write([{ id: "intermediate" }], staleVersion)).status).toBe(204);
    expect((await write(original, await readVersion())).status).toBe(204);
    expect((await write([{ id: "stale-device" }], staleVersion)).status).toBe(409);
    expect(JSON.parse(getPayload()!)).toEqual(original);
  });

  it("advances the version for consecutive writes in the same millisecond", async () => {
    const { environment } = createEnvironment(JSON.stringify([]));
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    try {
      let version = (await handleAccountStorage(
        request("/api/pokepilot/teams"), environment, "teams",
      )).headers.get("ETag")!;
      const seen = new Set([version]);
      for (const id of ["first", "second"]) {
        const response = await handleAccountStorage(request("/api/pokepilot/teams", {
          method: "PUT",
          headers: { origin: "https://pokepilot.app", "content-type": "application/json", "If-Match": version },
          body: JSON.stringify({ teams: [{ id }] }),
        }), environment, "teams");
        expect(response.status).toBe(204);
        version = response.headers.get("ETag")!;
        expect(seen.has(version)).toBe(false);
        seen.add(version);
      }
    } finally {
      clock.mockRestore();
    }
  });

  it("requires a version before any account storage write", async () => {
    const { environment, storageWrites } = createEnvironment();
    const response = await handleAccountStorage(request("/api/pokepilot/teams", {
      method: "PUT",
      headers: { origin: "https://pokepilot.app", "content-type": "application/json" },
      body: JSON.stringify({ teams: [] }),
    }), environment, "teams");
    expect(response.status).toBe(428);
    expect(storageWrites).toHaveLength(0);
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
