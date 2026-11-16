import { describe, expect, it, vi } from "vitest";
import { DurablePokePilotOperations, type PokePilotAnalysisGateClient } from "./durablePokePilotOperations";
import { PokePilotCapacityError } from "./pokepilotOperations";

const capacity = { requesterId: "opaque-account", maxPerRequester: 2, maxTotal: 64, leaseMs: 450_000 };

function setup() {
  const gate = {
    admit: vi.fn<PokePilotAnalysisGateClient["admit"]>(async () => ({ allowed: true })),
    acquire: vi.fn<PokePilotAnalysisGateClient["acquire"]>(async () => true),
    release: vi.fn<PokePilotAnalysisGateClient["release"]>(async () => {}),
  };
  const namespace = { getByName: vi.fn(() => gate) };
  return { gate, namespace, operations: new DurablePokePilotOperations(namespace) };
}

describe("Cloudflare PokePilot operations", () => {
  it("sends only opaque identity and a unique token for admission, not a caller-controlled clock", async () => {
    const { gate, namespace, operations } = setup();
    const requester = { clientId: "opaque-account", ipHash: "opaque-ip" };
    await operations.admitRequest(requester, -1);
    await operations.admitRequest(requester, Infinity);
    expect(namespace.getByName).toHaveBeenCalledWith("analysis-v1");
    expect(gate.admit.mock.calls[0]).toEqual([requester, expect.any(String)]);
    expect(gate.admit.mock.calls[0][1]).not.toBe(gate.admit.mock.calls[1][1]);
  });

  it("propagates admission failure instead of silently allowing local-only traffic", async () => {
    const { gate, operations } = setup();
    gate.admit.mockRejectedValue(new Error("gate unavailable"));
    await expect(operations.admitRequest({ clientId: "a", ipHash: "ip" }, 0)).rejects.toThrow("gate unavailable");
    expect(gate.acquire).not.toHaveBeenCalled();
  });

  it("releases only its own permit after the leader completes and shares locally", async () => {
    const { gate, operations } = setup();
    let finish!: (result: string) => void;
    const task = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const leader = operations.runOnce("same", task, { capacity });
    await vi.waitFor(() => expect(task).toHaveBeenCalledOnce());
    const follower = operations.runOnce("same", task, { capacity });
    expect(gate.acquire).toHaveBeenCalledOnce();
    expect(gate.release).not.toHaveBeenCalled();
    finish("private analysis text");
    await expect(leader).resolves.toEqual({ shared: false, value: "private analysis text" });
    await expect(follower).resolves.toEqual({ shared: true, value: "private analysis text" });
    expect(gate.acquire).toHaveBeenCalledWith(capacity.requesterId, expect.any(String));
    expect(gate.release).toHaveBeenCalledExactlyOnceWith(gate.acquire.mock.calls[0][1]);
    expect(JSON.stringify(gate.acquire.mock.calls)).not.toContain("private analysis text");
  });

  it.each([false, "unavailable"])("never starts the provider when acquisition fails: %s", async (failure) => {
    const { gate, operations } = setup();
    if (failure === false) gate.acquire.mockResolvedValue(false);
    else gate.acquire.mockRejectedValue(new Error("gate unavailable"));
    const task = vi.fn(async () => "must not run");
    const result = operations.runOnce("blocked", task, { capacity });
    await expect(result).rejects.toThrow(failure === false ? PokePilotCapacityError : "gate unavailable");
    expect(task).not.toHaveBeenCalled();
    expect(gate.release).not.toHaveBeenCalled();
  });

  it("preserves provider errors while releasing the permit", async () => {
    const { gate, operations } = setup();
    const error = new Error("provider failed after billing may have started");
    await expect(operations.runOnce("failed", async () => { throw error; }, { capacity })).rejects.toBe(error);
    expect(gate.release).toHaveBeenCalledOnce();
  });

  it("preserves paid results and error classification when cleanup is unavailable", async () => {
    const { gate, operations } = setup();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      gate.release.mockRejectedValue(new Error("internal identifier must not be logged"));
      await expect(operations.runOnce("completed", async () => "paid result", { capacity })).resolves.toMatchObject({ value: "paid result" });
      const providerError = new Error("original provider error");
      await expect(operations.runOnce("failed", async () => { throw providerError; }, { capacity })).rejects.toBe(providerError);
      expect(warning).toHaveBeenCalledWith("[PokePilot API] Analysis permit cleanup failed.");
      expect(JSON.stringify(warning.mock.calls)).not.toContain("internal identifier");
    } finally {
      warning.mockRestore();
    }
  });

  it("keeps local-only tasks on the local path", async () => {
    const { namespace, operations } = setup();
    await expect(operations.runOnce("local", async () => "ok")).resolves.toMatchObject({ value: "ok" });
    expect(namespace.getByName).not.toHaveBeenCalled();
  });

  it("selects different object identities within a shared class namespace", async () => {
    const { gate, namespace } = setup();
    const production = new DurablePokePilotOperations(namespace, "analysis-v1:production");
    const qa = new DurablePokePilotOperations(namespace, "analysis-v1:qa");
    const requester = { clientId: "a", ipHash: "ip" };
    await production.admitRequest(requester, 0);
    await qa.admitRequest(requester, 0);
    expect(namespace.getByName.mock.calls).toEqual([["analysis-v1:production"], ["analysis-v1:qa"]]);
    expect(gate.admit).toHaveBeenCalledTimes(2);
  });
});
