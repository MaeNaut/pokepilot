import { afterEach, describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisRequest } from "../utils/copilotAnalysis";
import {
  ChromeLocalAiError,
  createChromeLocalPromptPayload,
  destroyChromeLocalAiSessions,
  getChromeLocalAiAvailability,
  prepareChromeLocalCopilot,
  requestChromeLocalCopilotAnalysis,
} from "./chromeLocalAi";

const request = {
  version: 14,
  locale: "en",
  scope: "team",
  battleFormat: "doubles",
  teamName: "Local Test",
  selectedSlot: 0,
  typeLabels: [{ id: "fire", displayName: "Fire" }],
  sets: [],
  megaOptions: [],
  candidateFilters: [],
  recommendationCandidates: [],
  mechanics: { moves: [], abilities: [], items: [] },
  diagnostics: {
    filledSlots: 0,
    coverageCount: 0,
    coverageGaps: ["fire"],
    defensiveMatchups: [],
    alerts: [],
    roleCounts: {},
    responsibilityCounts: {},
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
} as unknown as CopilotAnalysisRequest;

const modelOutput = {
  version: 1,
  scope: "team",
  title: "Local Test",
  summary: "A concise local analysis.",
  playstyle: "Flexible",
  strengths: ["Runs on this device."],
  weaknesses: [],
  recommendations: [],
};

function createLanguageModelFactory(outputs: string[]) {
  const prompt = vi.fn(async () => outputs.shift() ?? JSON.stringify(modelOutput));
  const destroyClone = vi.fn();
  const clone = vi.fn(async () => ({
    contextUsage: 0,
    contextWindow: 8_000,
    clone,
    destroy: destroyClone,
    prompt,
  }));
  const destroyBase = vi.fn();
  const create = vi.fn(async (options: {
    monitor?: (monitor: {
      addEventListener: (
        type: "downloadprogress",
        listener: (event: { loaded: number }) => void,
      ) => void;
    }) => void;
  }) => {
    options.monitor?.({
      addEventListener: (_type, listener) => listener({ loaded: 0.5 }),
    });
    return {
      contextUsage: 0,
      contextWindow: 8_000,
      clone,
      destroy: destroyBase,
      prompt,
    };
  });

  return {
    factory: {
      availability: vi.fn(async () => "available"),
      create,
    },
    create,
    clone,
    destroyBase,
    destroyClone,
    prompt,
  };
}

afterEach(async () => {
  await destroyChromeLocalAiSessions();
  vi.unstubAllGlobals();
});

describe("Chrome on-device PokePilot adapter", () => {
  it("reports browser, language, and model availability", async () => {
    await expect(getChromeLocalAiAvailability("en")).resolves.toBe(
      "unsupported-browser",
    );

    const { factory } = createLanguageModelFactory([]);
    vi.stubGlobal("LanguageModel", factory);

    await expect(getChromeLocalAiAvailability("en")).resolves.toBe("available");
    await expect(getChromeLocalAiAvailability("ko")).resolves.toBe(
      "unsupported-language",
    );
  });

  it("creates one baseline session and reports model download progress", async () => {
    const { factory, create } = createLanguageModelFactory([]);
    const onDownloadProgress = vi.fn();
    vi.stubGlobal("LanguageModel", factory);

    await prepareChromeLocalCopilot("team", { onDownloadProgress });
    await prepareChromeLocalCopilot("team", { onDownloadProgress });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        expect.objectContaining({ role: "system" }),
      ],
    });
    expect(onDownloadProgress).toHaveBeenCalledWith(0.5);
  });

  it("clones the baseline, constrains JSON output, and marks it as device AI", async () => {
    const { factory, clone, destroyClone, prompt } =
      createLanguageModelFactory([JSON.stringify(modelOutput)]);
    vi.stubGlobal("LanguageModel", factory);

    await expect(requestChromeLocalCopilotAnalysis(request)).resolves.toEqual({
      ...modelOutput,
      source: "device",
    });

    expect(clone).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith(
      expect.stringContaining('"battleFormat":"doubles"'),
      expect.objectContaining({
        responseConstraint: expect.any(Object),
      }),
    );
    expect(destroyClone).toHaveBeenCalledTimes(1);
  });

  it("retries malformed local output without calling a hosted provider", async () => {
    const { factory, clone, prompt } = createLanguageModelFactory([
      "not-json",
      JSON.stringify(modelOutput),
    ]);
    vi.stubGlobal("LanguageModel", factory);

    await expect(requestChromeLocalCopilotAnalysis(request)).resolves.toMatchObject({
      source: "device",
    });
    expect(clone).toHaveBeenCalledTimes(2);
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported output languages before starting a session", async () => {
    await expect(
      requestChromeLocalCopilotAnalysis({ ...request, locale: "ko" }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ChromeLocalAiError>>({
        code: "UNSUPPORTED_LANGUAGE",
      }),
    );
  });

  it("builds a compact prompt payload with localized type labels", () => {
    expect(createChromeLocalPromptPayload(request)).toMatchObject({
      battleFormat: "doubles",
      diagnostics: { coverageGaps: ["Fire"] },
    });
  });
});
