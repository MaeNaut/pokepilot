import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountStorageConflictError, readAccountPreferences, readAccountCopilotHistory, writeAccountCopilotHistory } from "./accountStorage";

afterEach(() => { vi.unstubAllGlobals(); });

describe("account storage transport", () => {
  it("uses the application revision when a CDN weakens the ETag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ "analysis-history": [] }), {
      headers: { ETag: 'W/"rev-123"', "X-PokePilot-Storage-Version": '"rev-123"' },
    })));
    expect((await readAccountCopilotHistory()).version).toBe('"rev-123"');
  });
  it("forwards cancellation and reads without cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ "analysis-history": null }), { headers: { ETag: '"empty"' } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(readAccountCopilotHistory(signal, "account-a")).resolves.toEqual({ value: null, version: '"empty"' });
    expect(fetch).toHaveBeenCalledWith("/api/pokepilot/analysis-history", {
      cache: "no-store", signal, headers: { "X-PokePilot-Account-Id": "account-a" },
    });
  });

  it("writes the existing API envelope with a cancellation signal", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204, headers: { ETag: '"next"' } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(writeAccountCopilotHistory([], '"before"', signal, "account-a")).resolves.toBe('"next"');
    expect(fetch).toHaveBeenCalledWith("/api/pokepilot/analysis-history", {
      method: "PUT", headers: {
        "content-type": "application/json", "If-Match": '"before"',
        "X-PokePilot-Account-Id": "account-a",
      }, body: '{"analysis-history":[]}', signal,
    });
  });

  it("identifies a session switch instead of treating it as an ETag conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "ACCOUNT_SESSION_CHANGED" } }), { status: 403 },
    )));
    await expect(readAccountCopilotHistory(undefined, "old-account")).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
    await expect(writeAccountCopilotHistory([], '"before"', undefined, "old-account"))
      .rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  });

  it.each([401, 503])("rejects failed reads and writes: %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status })));
    const error = status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_STORAGE_UNAVAILABLE";
    await expect(readAccountCopilotHistory()).rejects.toThrow(error);
    await expect(writeAccountCopilotHistory([], '"before"')).rejects.toThrow(error);
  });

  it("identifies a stale write without treating it as a generic network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 409 })));
    await expect(writeAccountCopilotHistory([], '"before"')).rejects.toBeInstanceOf(AccountStorageConflictError);
  });

  it("normalizes preference responses before use", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ preferences: { locale: "unknown" } }), { headers: { ETag: '"v1"' } }),
    ));
    await expect(readAccountPreferences()).resolves.toEqual({ value: null, version: '"v1"' });
  });
});
