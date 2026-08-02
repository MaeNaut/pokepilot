import { afterEach, describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisRequest } from "../utils/copilotAnalysis";
import {
  CopilotApiError,
  requestHostedCopilotAnalysis,
} from "./copilotApi";

const request = {
  scope: "team",
} as CopilotAnalysisRequest;

const modelOutput = {
  version: 1,
  scope: "team",
  title: "Test Team",
  summary: "Summary",
  playstyle: "Balanced",
  strengths: [],
  weaknesses: [],
  recommendations: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hosted PokePilot client", () => {
  it("posts the request and marks validated analysis as hosted", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          analysis: modelOutput,
          metadata: { model: "gpt-5.6-luna", promptVersion: 25 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestHostedCopilotAnalysis(request)).resolves.toEqual({
      ...modelOutput,
      source: "hosted",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pokepilot/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  });

  it("throws a typed error for server failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "AI_NOT_CONFIGURED",
              message: "Hosted analysis is not configured.",
            },
          }),
          { status: 503 },
        ),
      ),
    );

    await expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({
      name: "CopilotApiError",
      code: "AI_NOT_CONFIGURED",
      status: 503,
    } satisfies Partial<CopilotApiError>);
  });

  it("preserves server cooldown duration for the analysis UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "ANALYSIS_COOLDOWN",
              message: "Analysis cooldown is active.",
              retryAfterSeconds: 75,
            },
          }),
          { status: 429 },
        ),
      ),
    );

    await expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({
      code: "ANALYSIS_COOLDOWN",
      retryAfterSeconds: 75,
      status: 429,
    } satisfies Partial<CopilotApiError>);
  });

  it("rejects malformed success payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, analysis: { version: 1 } }), {
          status: 200,
        }),
      ),
    );

    await expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
