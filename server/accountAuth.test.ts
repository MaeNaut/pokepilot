import { afterEach, describe, expect, it, vi } from "vitest";
import { accountUsageId, verifyAccount } from "./accountAuth";

const endpoint = "https://identity.example/.netlify/identity";
const request = (cookie = "nf_jwt=valid") => new Request("https://app.example/api/pokepilot/analyze", { headers: { cookie } });
afterEach(() => vi.unstubAllGlobals());

describe("account authorization", () => {
  it("rejects anonymous cookies without contacting Identity", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(verifyAccount(request("pokepilot_client=anything"), endpoint)).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses only the trusted endpoint and verified user ID", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "account-a", confirmed_at: "2026-09-18" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await verifyAccount(request(), endpoint)).toEqual({ id: "account-a" });
    expect(fetcher).toHaveBeenCalledWith(`${endpoint}/user`, expect.objectContaining({ headers: { Authorization: "Bearer valid" }, redirect: "error" }));
    expect(accountUsageId({ id: "account-a" })).toBe(accountUsageId({ id: "account-a" }));
    expect(accountUsageId({ id: "account-a" })).not.toBe(accountUsageId({ id: "account-b" }));
    expect(accountUsageId({ id: "account-a" })).not.toContain("account-a");
  });
  it.each([401, 403, 500])("rejects expired/revoked tokens and upstream errors (%s)", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(verifyAccount(request(), endpoint)).rejects.toMatchObject({ status: status === 500 ? 503 : 401 });
  });
  it("fails closed on network errors and unconfirmed accounts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(verifyAccount(request(), endpoint)).rejects.toMatchObject({ status: 503 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "account-a" })));
    await expect(verifyAccount(request(), endpoint)).rejects.toMatchObject({ status: 401 });
  });
  it("rejects absent configuration and malformed cookies", async () => {
    await expect(verifyAccount(request(), undefined)).rejects.toMatchObject({ status: 503 });
    await expect(verifyAccount(request("nf_jwt=%invalid"), endpoint)).rejects.toMatchObject({ status: 401 });
  });
});
