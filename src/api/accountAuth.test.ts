import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("account session lifecycle", () => {
  it("uses the server-verified profile instead of browser-readable identity data", async () => {
    vi.stubEnv("VITE_ACCOUNT_AUTH_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      enabled: true,
      user: {
        id: "account",
        email: "trainer@example.com",
        name: "Trainer",
        pictureUrl: "https://lh3.googleusercontent.com/avatar",
      },
    })));
    const { readAccount } = await import("./accountAuth");

    await expect(readAccount()).resolves.toEqual({
      id: "account",
      email: "trainer@example.com",
      name: "Trainer",
      pictureUrl: "https://lh3.googleusercontent.com/avatar",
    });
  });

  it("keeps only secure profile pictures for the header avatar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      enabled: true,
      user: { id: "account", pictureUrl: "http://example.com/avatar" },
    })));
    const { readAccount } = await import("./accountAuth");

    await expect(readAccount()).resolves.toEqual({ id: "account" });
  });

  it("treats an absent, expired, or revoked server session as signed out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const { readAccount } = await import("./accountAuth");

    await expect(readAccount()).resolves.toBeNull();
  });

  it("fails closed on an account service outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const { readAccount } = await import("./accountAuth");

    await expect(readAccount()).rejects.toThrow("AUTH_UNAVAILABLE");
  });

});
