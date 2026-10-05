import { describe, expect, it, vi } from "vitest";
import {
  createCopilotTypeLabels,
  type CopilotAnalysisRequest,
} from "../src/utils/copilotAnalysis";
import { createCopilotResponsibilityCounts } from "../src/utils/copilotResponsibilities";
import { handleWebPokePilotApi } from "./webPokePilotApi";
import {
  createSignedPokePilotClientToken,
  POKEPILOT_CLIENT_COOKIE,
} from "./pokepilotIdentity";
import { InMemoryPokePilotOperations } from "./pokepilotOperations";
import { POKEPILOT_API_MAX_BODY_BYTES } from "./pokepilotApi";

const validRequest = {
  version: 34,
  locale: "ko",
  scope: "team",
  battleFormat: "doubles",
  teamName: "Test Team",
  selectedSlot: 0,
  typeLabels: createCopilotTypeLabels("ko"),
  sets: [],
  megaOptions: [],
  candidateFilters: [],
  recommendationCandidates: [],
  mechanics: { moves: [], abilities: [], items: [] },
  diagnostics: {
    filledSlots: 0,
    coverageCount: 0,
    coverageGaps: [],
    defensiveMatchups: [],
    alerts: [],
    roleCounts: {
      "physical-attacker": 0,
      "special-attacker": 0,
      "physical-wall": 0,
      "special-wall": 0,
      supporter: 0,
      setter: 0,
    },
    responsibilityCounts: createCopilotResponsibilityCounts([]),
    moveSources: {},
    defensiveProfile: { weakTo: {}, resists: {}, immuneTo: {} },
    offensiveProfile: {
      physicalMoveCount: 0,
      specialMoveCount: 0,
      spreadMoveCount: 0,
      physicalSources: {},
      specialSources: {},
      spreadSources: {},
    },
    concepts: [],
    validity: { status: "valid", errorCount: 0, unavailableCount: 0 },
  },
} satisfies CopilotAnalysisRequest;

function createRequest(
  headers: Record<string, string> = {},
  body: unknown = validRequest,
) {
  return new Request("https://pokepilot.example/api/pokepilot/analyze", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });
}

describe("PokePilot web API boundary", () => {
  it.each([true, false])("rejects expanded payload overflow with content-length=%s", async (withLength) => {
    const body = JSON.stringify({ padding: "x".repeat(POKEPILOT_API_MAX_BODY_BYTES) });
    const response = await handleWebPokePilotApi(new Request("https://pokepilot.example/api/pokepilot/analyze", {
      method: "POST", body,
      headers: { "content-type": "application/json", ...(withLength ? { "content-length": String(body.length) } : {}) },
    }));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { providerAttempted: false } });
  });

  it("accepts transport payloads above the previous cap without calling the provider", async () => {
    const body = JSON.stringify(validRequest) + " ".repeat(300_000);
    const response = await handleWebPokePilotApi(new Request("https://pokepilot.example/api/pokepilot/analyze", {
      method: "POST", body, headers: { "content-type": "application/json" },
    }), { apiKey: "", clientSecret: "test-secret", onOperationalEvent: vi.fn() });
    expect(response.status).toBe(503);
  });
  it("rejects cross-origin browser requests before resolving a requester", async () => {
    const response = await handleWebPokePilotApi(
      createRequest({ origin: "https://attacker.example" }),
      { apiKey: "unused-test-key", clientSecret: "test-secret" },
    );

    expect(response.status).toBe(403);
    expect(response.headers.has("set-cookie")).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("requires JSON requests", async () => {
    const response = await handleWebPokePilotApi(
      createRequest({ "content-type": "text/plain" }),
      { apiKey: "unused-test-key", clientSecret: "test-secret" },
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("issues an HttpOnly secure signed anonymous-client cookie", async () => {
    const response = await handleWebPokePilotApi(createRequest(), {
      apiKey: "",
      clientSecret: "test-secret",
      onOperationalEvent: vi.fn(),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining(`${POKEPILOT_CLIENT_COOKIE}=`),
    );
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("HttpOnly; SameSite=Lax; Secure"),
    );
  });

  it("returns Retry-After when the request admission limit is reached", async () => {
    const operations = new InMemoryPokePilotOperations();
    const clientId = "client-a";
    const secret = "test-secret";
    const requester = { clientId, ipHash: "preload-ip" };
    for (let index = 0; index < 20; index += 1) {
      operations.admitRequest(requester, 0);
    }
    const token = createSignedPokePilotClientToken(clientId, secret);
    const response = await handleWebPokePilotApi(
      createRequest({ cookie: `${POKEPILOT_CLIENT_COOKIE}=${token}` }),
      {
        apiKey: "unused-test-key",
        clientSecret: secret,
        clock: () => 0,
        onOperationalEvent: vi.fn(),
        operations,
        requesterIp: "127.0.0.1",
      },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "AI_RATE_LIMITED",
        retryAfterSeconds: 60,
      },
    });
  });
});
