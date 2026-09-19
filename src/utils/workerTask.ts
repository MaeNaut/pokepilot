// One request owns one Worker. Every completion path releases the Worker and
// abort listener; a cancelled request settles without publishing a result.
export function runWorkerTask<T>(
  createWorker: () => Worker,
  input: unknown,
  signal: AbortSignal,
): Promise<T | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let settled = false;
    const finish = (result: T | null, error?: Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", cancel);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
      if (error) reject(error);
      else resolve(result);
    };
    const cancel = () => finish(null);
    signal.addEventListener("abort", cancel, { once: true });
    try {
      worker = createWorker();
      worker.onmessage = (event: MessageEvent<T>) => finish(event.data);
      worker.onerror = () => finish(null, new Error("Worker task failed"));
      worker.onmessageerror = () => finish(null, new Error("Worker response could not be decoded"));
      worker.postMessage(input);
    } catch (error) {
      finish(null, error instanceof Error ? error : new Error("Worker task failed"));
    }
  });
}

// Shared catalog loads may outlive a view; detach the caller without cancelling
// the shared fetch or leaving its eventual rejection unhandled.
export function waitForTask<T>(pending: Promise<T>, signal: AbortSignal): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const cancel = () => resolve(null);
    if (signal.aborted) resolve(null);
    else signal.addEventListener("abort", cancel, { once: true });
    pending.then(
      (value) => { signal.removeEventListener("abort", cancel); resolve(value); },
      (error) => { signal.removeEventListener("abort", cancel); reject(error); },
    );
  });
}

export function nextAnimationFrame(signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const frame = window.requestAnimationFrame(() => {
      signal.removeEventListener("abort", cancel);
      resolve(true);
    });
    const cancel = () => {
      window.cancelAnimationFrame(frame);
      resolve(false);
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
}
