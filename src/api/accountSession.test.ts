import { afterEach, describe, expect, it, vi } from "vitest";
import { persistAccountCookies } from "./accountSession";

afterEach(() => vi.unstubAllGlobals());

describe("account cookie persistence", () => {
  it("retains only Identity cookies with a bounded lifetime and security attributes", () => {
    const write = vi.fn();
    vi.stubGlobal("document", Object.defineProperty({}, "cookie", {
      get: () => "theme=dark; nf_jwt=access%3Dtoken; nf_refresh=refresh-token",
      set: write,
    }));
    persistAccountCookies();
    expect(write.mock.calls).toEqual([
      ["nf_jwt=access%3Dtoken; Path=/; Secure; SameSite=Lax; Max-Age=2592000"],
      ["nf_refresh=refresh-token; Path=/; Secure; SameSite=Lax; Max-Age=2592000"],
    ]);
  });

  it("never recreates cookies after logout or when no session exists", () => {
    const write = vi.fn();
    vi.stubGlobal("document", Object.defineProperty({}, "cookie", {
      get: () => "theme=dark; nf_jwt=; nf_refresh=",
      set: write,
    }));
    persistAccountCookies();
    expect(write).not.toHaveBeenCalled();
  });

  it("does nothing outside a browser", () => {
    vi.stubGlobal("document", undefined);
    expect(persistAccountCookies).not.toThrow();
  });
});
