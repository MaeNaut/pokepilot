import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountStorageConflictError, readAccountPreferences, readAccountTeams, writeAccountTeams } from "./accountStorage";

afterEach(() => { vi.unstubAllGlobals(); });

describe("account storage transport", () => {
  it("forwards cancellation and reads without cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ teams: null }), { headers: { ETag: '"empty"' } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(readAccountTeams(signal, "account-a")).resolves.toEqual({ value: null, version: '"empty"' });
    expect(fetch).toHaveBeenCalledWith("/api/pokepilot/teams", {
      cache: "no-store", signal, headers: { "X-PokePilot-Account-Id": "account-a" },
    });
  });

  it("writes the existing API envelope with a cancellation signal", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204, headers: { ETag: '"next"' } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(writeAccountTeams([], '"before"', signal, "account-a")).resolves.toBe('"next"');
    expect(fetch).toHaveBeenCalledWith("/api/pokepilot/teams", {
      method: "PUT", headers: {
        "content-type": "application/json", "If-Match": '"before"',
        "X-PokePilot-Account-Id": "account-a",
      }, body: '{"teams":[]}', signal,
    });
  });

  it("identifies a session switch instead of treating it as an ETag conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "ACCOUNT_SESSION_CHANGED" } }), { status: 403 },
    )));
    await expect(readAccountTeams(undefined, "old-account")).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
    await expect(writeAccountTeams([], '"before"', undefined, "old-account"))
      .rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  });

  it.each([401, 503])("rejects failed reads and writes: %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status })));
    const error = status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_STORAGE_UNAVAILABLE";
    await expect(readAccountTeams()).rejects.toThrow(error);
    await expect(writeAccountTeams([], '"before"')).rejects.toThrow(error);
  });

  it("identifies a stale write without treating it as a generic network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 409 })));
    await expect(writeAccountTeams([], '"before"')).rejects.toBeInstanceOf(AccountStorageConflictError);
  });

  it("normalizes preference responses before use", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ preferences: { locale: "unknown" } }), { headers: { ETag: '"v1"' } }),
    ));
    await expect(readAccountPreferences()).resolves.toEqual({ value: null, version: '"v1"' });
  });
});
