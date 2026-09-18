import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  handleAuthCallback: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  onAuthChange: vi.fn(),
  AUTH_EVENTS: { LOGIN: "LOGIN", TOKEN_REFRESH: "TOKEN_REFRESH", LOGOUT: "LOGOUT" },
}));
const persist = vi.hoisted(() => vi.fn());
vi.mock("@netlify/identity", () => sdk);
vi.mock("./accountSession", () => ({ persistAccountCookies: persist }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_ACCOUNT_AUTH_ENABLED", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("account session lifecycle", () => {
  it("subscribes once and retains login and refreshed cookies, not logout", async () => {
    const { initializeAccountAuth } = await import("./accountAuth");
    await Promise.all([initializeAccountAuth(), initializeAccountAuth()]);
    expect(sdk.onAuthChange).toHaveBeenCalledTimes(1);
    const listener = sdk.onAuthChange.mock.calls[0][0];
    listener("LOGIN", { id: "account" });
    listener("TOKEN_REFRESH", { id: "account" });
    listener("LOGOUT", null);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("refreshes before checking the server and retains only a verified session", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ enabled: true, user: { id: "account" } }));
    vi.stubGlobal("fetch", fetch);
    const { readAccount } = await import("./accountAuth");
    expect(await readAccount()).toEqual({ id: "account" });
    expect(sdk.refreshSession.mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[0]);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not accept an expired or revoked session when refresh cannot repair it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const { readAccount } = await import("./accountAuth");
    expect(await readAccount()).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails closed on an account service outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const { readAccount } = await import("./accountAuth");
    await expect(readAccount()).rejects.toThrow("AUTH_UNAVAILABLE");
    expect(persist).not.toHaveBeenCalled();
  });
});
