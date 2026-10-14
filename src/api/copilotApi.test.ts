import { afterEach, describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisRequest } from "../utils/copilotAnalysis";
import { requestAccountRefresh } from "./accountSessionBoundary";
import {
  CopilotApiError,
  requestHostedCopilotAnalysis,
} from "./copilotApi";

const request = {
  scope: "team",
} as CopilotAnalysisRequest;

const modelOutput = {
  version: 2,
  scope: "team",
  title: "Test Team",
  paragraphs: ["This is a complete analysis paragraph."],
  recommendations: [],
};

vi.mock("./accountSessionBoundary", () => ({ requestAccountRefresh: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("hosted PokePilot client", () => {
  it.each([ ["low", 150_000], ["medium", 390_000] ] as const)(
    "bounds a stalled %s request without retrying or asserting no charge", async (effort, timeoutMs) => {
      vi.useFakeTimers();
      const fetchMock = vi.fn<typeof fetch>(() => new Promise(() => {}));
      vi.stubGlobal("fetch", fetchMock);
      const pending = requestHostedCopilotAnalysis(request, undefined, effort);
      const failed = expect(pending).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", providerAttempted: undefined });
      await vi.advanceTimersByTimeAsync(timeoutMs - 1);
      expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await failed;
      expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("also bounds a response whose headers arrived but whose body never finishes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: () => new Promise(() => {}) }) as Response));
    const failed = expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(150_000);
    await failed;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores late responses and account-refresh signals after timing out", async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = requestHostedCopilotAnalysis(request);
    const failed = expect(pending).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(150_000); await failed;
    finish(new Response(JSON.stringify({ ok: false, error: { code: "ACCOUNT_SESSION_CHANGED" } }), { status: 409 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(requestAccountRefresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(pending).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });

  it("cleans up the deadline and abort listener when the response succeeds", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, analysis: modelOutput })));
    vi.stubGlobal("fetch", fetchMock);
    await requestHostedCopilotAnalysis(request, controller.signal);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    await vi.advanceTimersByTimeAsync(150_000);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
  });

  it("respects cancellation before sending and while waiting", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const cancelled = new AbortController(); cancelled.abort();
    await expect(requestHostedCopilotAnalysis(request, cancelled.signal)).rejects.toMatchObject({
      code: "REQUEST_CANCELLED", providerAttempted: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const active = new AbortController();
    const failed = expect(requestHostedCopilotAnalysis(request, active.signal)).rejects.toMatchObject({
      code: "REQUEST_CANCELLED", providerAttempted: undefined,
    });
    active.abort(); await failed;
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["null", "[]", "broken JSON"])("classifies an unreadable envelope as a product error: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
    await expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("posts the request and marks validated analysis as hosted", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
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
      analysis: {
        ...modelOutput,
        source: "hosted",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pokepilot/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "X-PokePilot-Model": "gpt-6-luna",
      "X-PokePilot-Reasoning-Effort": "low",
    });
  });

  it("binds a signed-in analysis to the account shown in its tab", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ok: true, analysis: modelOutput }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await requestHostedCopilotAnalysis(request, undefined, "low", "gpt-6-luna", "account-a");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "X-PokePilot-Account-Id": "account-a",
    });
  });

  it("sends Sol low as an explicit model selection", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, analysis: modelOutput }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await requestHostedCopilotAnalysis(request, undefined, "low", "gpt-6-sol");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "X-PokePilot-Model": "gpt-6-sol",
      "X-PokePilot-Reasoning-Effort": "low",
    });
  });

  it("accepts measured execution data but ignores malformed metrics", async () => {
    const execution = { durationMs: 12_400, totalTokens: 1_840, estimatedCostUsd: 0.0018 };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, analysis: modelOutput, metadata: { execution },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, analysis: modelOutput,
        metadata: { execution: { ...execution, totalTokens: "1840" } },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestHostedCopilotAnalysis(request)).resolves.toMatchObject({ execution });
    await expect(requestHostedCopilotAnalysis(request)).resolves.not.toHaveProperty("execution");
  });


  it("preserves supported quality warnings from a successful analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            analysis: modelOutput,
            metadata: {
              qualityWarnings: [
                "grounding-incomplete",
                "grounding-incomplete",
                "unknown-warning",
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(requestHostedCopilotAnalysis(request)).resolves.toMatchObject({
      analysis: { source: "hosted" },
      qualityWarnings: ["grounding-incomplete"],
    });
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
              providerAttempted: false,
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
      providerAttempted: false,
    } satisfies Partial<CopilotApiError>);
  });

  it("distinguishes an unreachable analysis server from an API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({
      name: "CopilotApiError",
      code: "NETWORK_ERROR",
      status: 0,
    } satisfies Partial<CopilotApiError>);
  });

  it("preserves provider retry metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "AI_RATE_LIMITED",
              message: "Provider rate limit is active.",
              retryAfterSeconds: 75,
            },
          }),
          { status: 429 },
        ),
      ),
    );

    await expect(requestHostedCopilotAnalysis(request)).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
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
