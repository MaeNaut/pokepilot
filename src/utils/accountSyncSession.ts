export type AccountSyncSession<T> = ReturnType<typeof createAccountSyncSession<T>>;

// Each hydration owns one session. Closing it cancels requests and invalidates
// queued writes, including when the same account signs in again later.
export function createAccountSyncSession<T>(
  write: (value: T, signal: AbortSignal) => Promise<void>,
) {
  const controller = new AbortController();
  let tail = Promise.resolve(false);

  return {
    signal: controller.signal,
    close() {
      controller.abort();
    },
    write(value: T): Promise<boolean> {
      tail = tail.then(async () => {
        if (controller.signal.aborted) return false;
        try {
          await write(value, controller.signal);
          return !controller.signal.aborted;
        } catch {
          // Preserve local data and keep the queue usable after a failed write.
          return false;
        }
      });
      return tail;
    },
  };
}
