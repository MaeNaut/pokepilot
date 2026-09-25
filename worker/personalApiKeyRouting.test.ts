import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAccountSession } from "./accountAuth";
import { readPersonalApiKey } from "./personalApiKey";
import { handleWebPokePilotApi } from "../server/webPokePilotApi";
import worker from "./index";
import type { WorkerEnvironment } from "./env";

vi.mock("./accountAuth.js", async (original) => ({
  ...await original<typeof import("./accountAuth")>(),
  readAccountSession: vi.fn(),
}));
vi.mock("./personalApiKey.js", async (original) => ({
  ...await original<typeof import("./personalApiKey")>(),
  readPersonalApiKey: vi.fn(),
}));
vi.mock("../server/webPokePilotApi.js", async (original) => ({
  ...await original<typeof import("../server/webPokePilotApi")>(),
  handleWebPokePilotApi: vi.fn(),
}));

const env = {
  OPENAI_API_KEY: "site-key-test",
  POKEPILOT_AUTH_REQUIRED: "true",
  POKEPILOT_SESSION_SECRET: "test-session-secret",
  POKEPILOT_CLIENT_SECRET: "test-client-secret",
  POKEPILOT_SHARED_STORE_REQUIRED: "false",
} as WorkerEnvironment;

function analyzeRequest(effort: string) {
  return new Request("https://pokepilot.app/api/pokepilot/analyze", {
    method: "POST",
    headers: { "X-PokePilot-Reasoning-Effort": effort, Origin: "https://pokepilot.app" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAccountSession).mockResolvedValue({ account: { id: "account-a" } });
  vi.mocked(readPersonalApiKey).mockResolvedValue(null);
  vi.mocked(handleWebPokePilotApi).mockResolvedValue(new Response("ok"));
});

describe("Worker analysis key routing", () => {
  it("uses the site key for low and blocks medium without a personal key", async () => {
    expect((await worker.fetch(analyzeRequest("low"), env)).status).toBe(200);
    expect(vi.mocked(handleWebPokePilotApi).mock.calls[0]?.[1]).toMatchObject({
      apiKey: "site-key-test", reasoningEffort: "low", billingSource: "site",
    });

    const response = await worker.fetch(analyzeRequest("medium"), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "PERSONAL_KEY_REQUIRED" } });
    expect(handleWebPokePilotApi).toHaveBeenCalledOnce();
  });

  it("uses the registered key for both efforts without site-key safeguards", async () => {
    vi.mocked(readPersonalApiKey).mockResolvedValue("personal-key-test");
    await worker.fetch(analyzeRequest("medium"), env);
    await worker.fetch(analyzeRequest("low"), env);
    for (const call of vi.mocked(handleWebPokePilotApi).mock.calls) {
      expect(call[1]).toMatchObject({
        apiKey: "personal-key-test", billingSource: "personal",
        billingIdentity: "account-a", safeguardMode: "ai-fresh",
      });
    }
    expect(vi.mocked(handleWebPokePilotApi).mock.calls.map((call) => call[1]?.reasoningEffort)).toEqual(["medium", "low"]);
  });

  it("rejects unrecognized reasoning levels", async () => {
    expect((await worker.fetch(analyzeRequest("high"), env)).status).toBe(400);
    expect(handleWebPokePilotApi).not.toHaveBeenCalled();
  });
});
