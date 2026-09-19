import { afterEach, describe, expect, it, vi } from "vitest";
import { nextAnimationFrame, runWorkerTask, waitForTask } from "./workerTask";

function createWorker() {
  return {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  } as unknown as Worker;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe("one-shot Worker task", () => {
  it("posts input, returns output and terminates exactly once", async () => {
    const worker = createWorker();
    const controller = new AbortController();
    const result = runWorkerTask<number>(() => worker, { value: 1 }, controller.signal);
    expect(worker.postMessage).toHaveBeenCalledWith({ value: 1 });
    worker.onmessage?.call(worker, new MessageEvent("message", { data: 2 }));
    await expect(result).resolves.toBe(2);
    controller.abort();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.onmessage).toBeNull();
  });

  it("does not start an already cancelled job", async () => {
    const controller = new AbortController();
    controller.abort();
    const factory = vi.fn(createWorker);
    await expect(runWorkerTask(factory, {}, controller.signal)).resolves.toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });

  it("settles cancellation and ignores a late event", async () => {
    const worker = createWorker();
    const controller = new AbortController();
    const result = runWorkerTask(() => worker, {}, controller.signal);
    const late = worker.onmessage;
    controller.abort();
    late?.call(worker, new MessageEvent("message", { data: 2 }));
    await expect(result).resolves.toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it.each(["onerror", "onmessageerror"] as const)("cleans up %s", async (event) => {
    const worker = createWorker();
    const result = runWorkerTask(() => worker, {}, new AbortController().signal);
    const assertion = expect(result).rejects.toThrow();
    if (event === "onerror") worker.onerror?.call(worker, new Event("error") as ErrorEvent);
    else worker.onmessageerror?.call(worker, new MessageEvent("messageerror"));
    await assertion;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("handles startup and structured-clone failures", async () => {
    await expect(runWorkerTask(() => { throw new Error("startup"); }, {}, new AbortController().signal)).rejects.toThrow("startup");
    const worker = createWorker();
    vi.mocked(worker.postMessage).mockImplementation(() => { throw new Error("clone"); });
    await expect(runWorkerTask(() => worker, {}, new AbortController().signal)).rejects.toThrow("clone");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

describe("cancellable frame scheduling", () => {
  it("detaches from a pending shared load on cancellation", async () => {
    const controller = new AbortController();
    let reject!: (reason: Error) => void;
    const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
    const result = waitForTask(pending, controller.signal);
    controller.abort();
    await expect(result).resolves.toBeNull();
    reject(new Error("late shared load failure"));
    await Promise.resolve();
  });

  it("forwards active shared load errors", async () => {
    await expect(waitForTask(Promise.reject(new Error("offline")), new AbortController().signal)).rejects.toThrow("offline");
  });

  it("settles even if the frame is cancelled before it runs", async () => {
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame });
    const controller = new AbortController();
    const result = nextAnimationFrame(controller.signal);
    controller.abort();
    await expect(result).resolves.toBe(false);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("removes cancellation handling after the frame runs", async () => {
    let callback!: FrameRequestCallback;
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("window", { requestAnimationFrame: (next: FrameRequestCallback) => { callback = next; return 1; }, cancelAnimationFrame });
    const controller = new AbortController();
    const result = nextAnimationFrame(controller.signal);
    callback(0);
    await expect(result).resolves.toBe(true);
    controller.abort();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
