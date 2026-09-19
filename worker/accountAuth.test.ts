import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountUsageId,
  completeGoogleAuthorization,
  createGoogleAuthorizationResponse,
  deleteCurrentAccount,
  readAccountSession,
} from "./accountAuth";
import worker from "./index";
import type { WorkerEnvironment } from "./env";

function createEnvironment(overrides: Partial<WorkerEnvironment> = {}) {
  return {
    ASSETS: { fetch: vi.fn() },
    DB: {
      batch: vi.fn(),
      prepare: vi.fn(),
    },
    GOOGLE_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://preview.example/api/auth/google/callback",
    POKEPILOT_AUTH_REQUIRED: "true",
    POKEPILOT_CLIENT_SECRET: "anonymous-client-secret",
    POKEPILOT_SESSION_SECRET: "session-secret",
    ...overrides,
  } as unknown as WorkerEnvironment;
}

function createSessionEnvironment(row: Record<string, unknown>) {
  const first = vi.fn().mockResolvedValue(row);
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const bindings: unknown[][] = [];
  const prepare = vi.fn((query: string) => ({
    bind: (...values: unknown[]) => {
      bindings.push(values);
      return query.includes("SELECT accounts.id") ? { first } : { run };
    },
  }));
  return {
    bindings,
    environment: createEnvironment({ DB: { batch: vi.fn(), prepare } as unknown as D1Database }),
    run,
  };
}

describe("Cloudflare account boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("creates a Google authorization request with a short-lived HttpOnly state cookie", () => {
    const response = createGoogleAuthorizationResponse(
      new Request("https://preview.example/api/auth/google"),
      createEnvironment(),
    );
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(302);
    expect(location.hostname).toBe("accounts.google.com");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://preview.example/api/auth/google/callback",
    );
    expect(response.headers.get("set-cookie")).toMatch(
      /HttpOnly; SameSite=Lax; Secure/,
    );
  });

  it("rejects a callback with a missing or mismatched state before token exchange", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await completeGoogleAuthorization(
      new Request("https://preview.example/api/auth/google/callback?code=code&state=wrong", {
        headers: { cookie: "pokepilot_google_state=expected" },
      }),
      createEnvironment(),
    );

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location")!).searchParams.get("auth_error")).toBe("google");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("identifies a token exchange failure without exposing Google's response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 401 })));
    const response = await completeGoogleAuthorization(
      new Request("https://preview.example/api/auth/google/callback?code=code&state=expected", {
        headers: { cookie: "pokepilot_google_state=expected" },
      }),
      createEnvironment(),
    );

    expect(new URL(response.headers.get("location")!).searchParams.get("auth_error")).toBe("google-token");
  });

  it("classifies a Worker token-request exception as a token exchange failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("unsupported redirect mode")));
    const response = await completeGoogleAuthorization(
      new Request("https://preview.example/api/auth/google/callback?code=code&state=expected", {
        headers: { cookie: "pokepilot_google_state=expected" },
      }),
      createEnvironment(),
    );

    expect(new URL(response.headers.get("location")!).searchParams.get("auth_error")).toBe("google-token");
  });

  it("uses a stable opaque account key for shared rate limits", async () => {
    const env = createEnvironment();
    const first = await accountUsageId({ id: "account-a" }, env);

    expect(first).toBe(await accountUsageId({ id: "account-a" }, env));
    expect(first).not.toBe(await accountUsageId({ id: "account-b" }, env));
    expect(first).not.toContain("account-a");
  });

  it("rotates a session only inside the renewal window", async () => {
    const now = Date.UTC(2026, 8, 18, 12);
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { environment, run } = createSessionEnvironment({
      id: "account",
      email: "trainer@example.com",
      name: "Trainer",
      picture_url: null,
      expires_at: now + 6 * 24 * 60 * 60 * 1_000,
      session_created_at: now - 20 * 24 * 60 * 60 * 1_000,
    });

    const session = await readAccountSession(
      new Request("https://preview.example/api/pokepilot/account", {
        headers: { cookie: "pokepilot_session=existing" },
      }),
      environment,
    );

    expect(session).toMatchObject({ account: { id: "account", email: "trainer@example.com" } });
    expect(session?.refreshCookie).toMatch(/pokepilot_session=.*Max-Age=2592000/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not renew a session past its 90-day absolute lifetime", async () => {
    const now = Date.UTC(2026, 8, 18, 12);
    const day = 24 * 60 * 60 * 1_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { bindings, environment, run } = createSessionEnvironment({
      id: "account",
      email: null,
      name: null,
      picture_url: null,
      expires_at: now + 3 * day,
      session_created_at: now - 89 * day,
    });

    const session = await readAccountSession(
      new Request("https://preview.example/api/pokepilot/account", {
        headers: { cookie: "pokepilot_session=existing" },
      }),
      environment,
    );

    expect(session?.refreshCookie).toMatch(/Max-Age=86400/);
    expect(run).not.toHaveBeenCalled();
    expect(bindings).toHaveLength(1);
  });

  it("rejects cross-origin account deletion before touching D1", async () => {
    const env = createEnvironment();
    await expect(
      deleteCurrentAccount(
        new Request("https://preview.example/api/pokepilot/account", {
          headers: { origin: "https://attacker.example" },
          method: "DELETE",
        }),
        env,
        { id: "account" },
      ),
    ).rejects.toMatchObject({ status: 403, code: "AUTH_FORBIDDEN" });
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });

  it("blocks unauthenticated analysis before it can reach the paid provider", async () => {
    const response = await worker.fetch!(
      new Request("https://preview.example/api/pokepilot/analyze", {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      createEnvironment(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTH_REQUIRED" } });
  });
});
