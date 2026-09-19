import { describe, expect, it, vi } from "vitest";
import { createAccountSyncSession } from "./accountSyncSession";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("account sync session", () => {
  it("serializes writes without dropping intermediate mutations", async () => {
    const first = deferred();
    const write = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const session = createAccountSyncSession<number>(write);
    const one = session.write(1);
    const two = session.write(2);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    first.resolve();
    await expect(one).resolves.toBe(true);
    await expect(two).resolves.toBe(true);
    expect(write.mock.calls.map(([value]) => value)).toEqual([1, 2]);
  });

  it("handles the final rejection and allows later writes", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const session = createAccountSyncSession<number>(write);
    await expect(session.write(1)).resolves.toBe(false);
    await expect(session.write(2)).resolves.toBe(true);
  });

  it("aborts in-flight requests and skips queued writes after logout", async () => {
    const first = deferred();
    const write = vi.fn(() => first.promise);
    const session = createAccountSyncSession<number>(write);
    const one = session.write(1);
    const two = session.write(2);
    await Promise.resolve();
    session.close();
    expect(session.signal.aborted).toBe(true);
    first.resolve();
    await expect(one).resolves.toBe(false);
    await expect(two).resolves.toBe(false);
    await expect(session.write(3)).resolves.toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not let an old session block or resume in a new session", async () => {
    const first = deferred();
    const oldWrite = vi.fn(() => first.promise);
    const old = createAccountSyncSession<number>(oldWrite);
    const pending = old.write(1);
    const queued = old.write(2);
    await Promise.resolve();
    old.close();
    const nextWrite = vi.fn().mockResolvedValue(undefined);
    const next = createAccountSyncSession<number>(nextWrite);
    await expect(next.write(3)).resolves.toBe(true);
    first.resolve();
    await Promise.all([pending, queued]);
    expect(oldWrite).toHaveBeenCalledTimes(1);
    expect(nextWrite).toHaveBeenCalledWith(3, next.signal);
  });
});
