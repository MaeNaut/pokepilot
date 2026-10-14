import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAccountSession } from "./accountAuth";
import { handleAccountStorage } from "./accountStorage";
import { handlePersonalApiKey } from "./personalApiKey";
import { handleTeamLibrary } from "./teamLibrary";
import type { WorkerEnvironment } from "./env";

vi.mock("./accountAuth.js", async (original) => ({
  ...await original<typeof import("./accountAuth")>(),
  readAccountSession: vi.fn(),
}));

const run = vi.fn(async () => ({ meta: { changes: 1 } }));
const batch = vi.fn();
const env = {
  POKEPILOT_SESSION_SECRET: "test-only-secret",
  DB: { prepare: () => ({ bind: () => ({ first: async () => ({ present: 1 }), run }) }), batch },
} as unknown as WorkerEnvironment;

function streamedRequest(path: string, payload: string, contentLength?: string) {
  const chunks = [new TextEncoder().encode(payload), new TextEncoder().encode(" ")];
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel,
  }, { highWaterMark: 0 });
  const request = new Request(`https://pokepilot.app/api/pokepilot/${path}`, {
    method: "PUT", body, duplex: "half",
    headers: {
      "Content-Type": "application/json", Origin: "https://pokepilot.app",
      "X-PokePilot-Account-Id": "a", "If-Match": '"empty"',
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
  } as RequestInit);
  return { request, cancel, chunks };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAccountSession).mockResolvedValue({ account: { id: "a" } });
});

describe("storage request body limits", () => {
  it.each([undefined, "1"])("stops oversized key streams before reading the tail (length=%s)", async (length) => {
    const { request, cancel, chunks } = streamedRequest("personal-api-key",
      JSON.stringify({ apiKey: `sk-${"a".repeat(30)}`, padding: "a".repeat(4_000) }), length);
    const response = await handlePersonalApiKey(request, env);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toHaveLength(1);
    expect(run).not.toHaveBeenCalled();
  });

  it.each(["preferences", "analysis-history", "teams"] as const)("bounds the entire %s envelope, not only selected fields", async (key) => {
    const bytes = key === "preferences" ? 30_000 : key === "teams" ? 9_100_000 : 6_100_000;
    const payload = key === "preferences"
      ? { locale: "ko", themePreference: "dark", battleFormat: "singles", tutorialCompleted: true }
      : [];
    const { request, cancel } = streamedRequest(key, JSON.stringify({ [key]: payload, padding: "a".repeat(bytes) }));
    const response = await handleAccountStorage(request, env, key);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });

  it.each(["save", "order", "delete"])("bounds team-library %s bodies before migration or writes", async (operation) => {
    const { request, cancel } = streamedRequest("team-library", JSON.stringify({
      operation, id: "team-a", revision: "1", ids: [], padding: "a".repeat(310_000),
    }));
    const response = await handleTeamLibrary(request, env);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});
