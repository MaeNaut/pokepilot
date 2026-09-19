// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPopularSmogonSet } from "../api/smogonUsage";
import { deferred, renderHook } from "../test/renderHook";
import { useSetOptimizationPlan } from "./useSetOptimizationPlan";

vi.mock("../api/smogonUsage", () => ({ loadPopularSmogonSet: vi.fn() }));
const context = { member: { id: "garchomp" } } as NonNullable<Parameters<typeof useSetOptimizationPlan>[0]>;
const items: Parameters<typeof useSetOptimizationPlan>[2] = [];
const workers: FakeWorker[] = [];
const cleanups: Array<() => Promise<void>> = [];
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { workers.push(this); }
}
beforeEach(() => {
  workers.length = 0;
  vi.mocked(loadPopularSmogonSet).mockReset().mockResolvedValue(null);
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
});
async function mount() {
  const hook = await renderHook((enabled: boolean) => useSetOptimizationPlan(context, "singles", items, enabled), true as boolean);
  cleanups.push(hook.unmount);
  return hook;
}

describe("set optimization task lifecycle", () => {
  it("publishes the Worker result and releases it", async () => {
    const hook = await mount();
    let result!: ReturnType<typeof hook.current.run>;
    await act(async () => { result = hook.current.run(); });
    expect(hook.current.loading).toBe(true);
    const plan = { candidates: [] };
    await act(async () => {
      workers[0].onmessage?.(new MessageEvent("message", { data: { plan } }));
      await result;
    });
    expect(hook.current.plan).toEqual(plan);
    expect(hook.current.loading).toBe(false);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it("settles cancellation before a shared usage fetch completes", async () => {
    const read = deferred<Awaited<ReturnType<typeof loadPopularSmogonSet>>>();
    vi.mocked(loadPopularSmogonSet).mockReturnValue(read.promise);
    const hook = await mount();
    let result!: ReturnType<typeof hook.current.run>;
    await act(async () => { result = hook.current.run(); });
    await hook.rerender(false);
    await expect(result).resolves.toBeNull();
    await act(async () => { read.resolve(null); });
    await hook.rerender(true);
    expect(workers).toHaveLength(0);
    expect(hook.current.loading).toBe(false);
  });

  it("terminates the previous Worker when a new run starts", async () => {
    const hook = await mount();
    let first!: ReturnType<typeof hook.current.run>;
    await act(async () => { first = hook.current.run(); });
    await act(async () => { void hook.current.run(); });
    await expect(first).resolves.toBeNull();
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(workers).toHaveLength(2);
  });

  it("reports Worker errors but tolerates unavailable usage data", async () => {
    vi.mocked(loadPopularSmogonSet).mockRejectedValue(new Error("offline"));
    const hook = await mount();
    let result!: ReturnType<typeof hook.current.run>;
    await act(async () => { result = hook.current.run(); });
    expect(workers[0].postMessage).toHaveBeenCalledWith({ generalContext: { ...context, usageSet: null, usageItems: [] } });
    await act(async () => { workers[0].onerror?.(); await result; });
    expect(hook.current.error).toBe(true);
    expect(hook.current.loading).toBe(false);
  });
});
