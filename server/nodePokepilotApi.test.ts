import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisRequest } from "../src/utils/copilotAnalysis";
import { handleNodePokePilotApi } from "./nodePokepilotApi";
import {
  createSignedPokePilotClientToken,
  POKEPILOT_CLIENT_COOKIE,
} from "./pokepilotIdentity";
import { InMemoryPokePilotOperations } from "./pokepilotOperations";

const validRequest = {
  version: 9,
  locale: "ko",
  scope: "team",
  battleFormat: "doubles",
  teamName: "Test Team",
  selectedSlot: 0,
  sets: [],
  megaOptions: [],
  candidateFilters: [],
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

function createRequest(headers: Record<string, string> = {}) {
  return {
    body: validRequest,
    headers,
    method: "POST",
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage & { body: unknown };
}

function createResponse() {
  const headers = new Map<string, string | number | string[]>();
  let serializedBody = "";
  const response = {
    statusCode: 0,
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(
        name.toLowerCase(),
        typeof value === "string" || typeof value === "number"
          ? value
          : [...value],
      );
      return response;
    },
    end(value?: string) {
      serializedBody = value ?? "";
      return response;
    },
  } as unknown as ServerResponse;

  return {
    headers,
    response,
    readBody: () => JSON.parse(serializedBody) as unknown,
  };
}

describe("PokePilot Node HTTP boundary", () => {
  it("issues an HttpOnly signed anonymous-client cookie", async () => {
    const target = createResponse();

    await handleNodePokePilotApi(createRequest(), target.response, {
      apiKey: "",
      clientSecret: "test-secret",
      onOperationalEvent: vi.fn(),
    });

    expect(target.response.statusCode).toBe(503);
    expect(target.headers.get("set-cookie")).toEqual(
      expect.stringContaining(`${POKEPILOT_CLIENT_COOKIE}=`),
    );
    expect(target.headers.get("set-cookie")).toEqual(
      expect.stringContaining("HttpOnly; SameSite=Lax"),
    );
  });

  it("returns Retry-After when the anonymous client enters cooldown", async () => {
    const operations = new InMemoryPokePilotOperations();
    const clientId = "client-a";
    const secret = "test-secret";
    const requester = { clientId, ipHash: "preload-ip" };
    for (let index = 0; index < 5; index += 1) {
      const decision = operations.reserve(requester, 0);
      if (!decision.allowed) {
        throw new Error("Expected a rate-limit reservation.");
      }
      operations.completeReservation(decision.reservation, 0);
    }
    const token = createSignedPokePilotClientToken(clientId, secret);
    const target = createResponse();

    await handleNodePokePilotApi(
      createRequest({ cookie: `${POKEPILOT_CLIENT_COOKIE}=${token}` }),
      target.response,
      {
        apiKey: "unused-test-key",
        clientSecret: secret,
        clock: () => 0,
        onOperationalEvent: vi.fn(),
        operations,
      },
    );

    expect(target.response.statusCode).toBe(429);
    expect(target.headers.get("retry-after")).toBe("60");
    expect(target.readBody()).toMatchObject({
      ok: false,
      error: {
        code: "ANALYSIS_COOLDOWN",
        retryAfterSeconds: 60,
      },
    });
  });
});
