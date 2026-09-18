import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
import analyze from "./pokepilot-analyze";
import account from "./pokepilot-account";
import { handleWebPokePilotApi } from "../../server/webPokePilotApi";
import { admin } from "@netlify/identity";

vi.mock("../../server/webPokePilotApi", () => ({ handleWebPokePilotApi: vi.fn().mockResolvedValue(new Response(null, { status: 204 })) }));
vi.mock("@netlify/identity", async importOriginal => ({
  ...await importOriginal<typeof import("@netlify/identity")>(),
  admin: { deleteUser: vi.fn().mockResolvedValue(undefined) },
}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const context = { ip: "127.0.0.1" } as Context;
function enable() {
  vi.stubEnv("POKEPILOT_AUTH_REQUIRED", "true");
  vi.stubEnv("POKEPILOT_IDENTITY_URL", "https://identity.example/.netlify/identity");
}

describe("Netlify account boundary", () => {
  it("blocks unauthenticated analysis before operations or paid calls", async () => {
    enable();
    const response = await analyze(new Request("https://app.example/api/pokepilot/analyze", { method: "POST", headers: { origin: "https://app.example" } }), context);
    expect(response.status).toBe(401);
    expect(handleWebPokePilotApi).not.toHaveBeenCalled();
  });
  it("keys limits by the same account despite different browser cookies", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ id: "same-account", confirmed_at: "2026-09-18" })));
    for (const cookie of ["nf_jwt=one", "nf_jwt=two"]) {
      await analyze(new Request("https://app.example/api/pokepilot/analyze", { method: "POST", headers: { cookie, origin: "https://app.example" } }), context);
    }
    const calls = vi.mocked(handleWebPokePilotApi).mock.calls;
    expect(calls[0][1]?.authenticatedAccountId).toMatch(/^account:/);
    expect(calls[0][1]?.authenticatedAccountId).toBe(calls[1][1]?.authenticatedAccountId);
  });
  it("rejects cross-origin deletion", async () => {
    enable();
    const result = await account(new Request("https://app.example/api/pokepilot/account", { method: "DELETE", headers: { origin: "https://evil.example", cookie: "nf_jwt=one" } }));
    expect(result.status).toBe(403);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });
  it("deletes only the verified caller, not a user supplied ID", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "caller", confirmed_at: "2026-09-18" })));
    const result = await account(new Request("https://app.example/api/pokepilot/account?id=victim", { method: "DELETE", headers: { origin: "https://app.example", cookie: "nf_jwt=one" } }));
    expect(result.status).toBe(204);
    expect(admin.deleteUser).toHaveBeenCalledWith("caller");
  });
});
