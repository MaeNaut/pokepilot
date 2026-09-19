import { afterEach, describe, expect, it, vi } from "vitest";
import { readAccountPreferences, readAccountTeams, writeAccountTeams } from "./accountStorage";

afterEach(() => { vi.unstubAllGlobals(); });

describe("account storage transport", () => {
  it("forwards cancellation and reads without cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ teams: null })));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(readAccountTeams(signal)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/pokepilot/teams", { cache: "no-store", signal });
  });

  it("writes the existing API envelope with a cancellation signal", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await writeAccountTeams([], signal);
    expect(fetch).toHaveBeenCalledWith("/api/pokepilot/teams", {
      method: "PUT", headers: { "content-type": "application/json" }, body: '{"teams":[]}', signal,
    });
  });

  it.each([401, 503])("rejects failed reads and writes: %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status })));
    const error = status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_STORAGE_UNAVAILABLE";
    await expect(readAccountTeams()).rejects.toThrow(error);
    await expect(writeAccountTeams([])).rejects.toThrow(error);
  });

  it("normalizes preference responses before use", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ preferences: { locale: "unknown" } }))));
    await expect(readAccountPreferences()).resolves.toBeNull();
  });
});
