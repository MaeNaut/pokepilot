import { describe, expect, it } from "vitest";
import { emptyResponse, isEnabled, isSameOrigin, jsonResponse, withSessionRefresh } from "./http";

describe("Worker HTTP responses", () => {
  it("preserves custom headers but always disables caching of private JSON", async () => {
    const response = jsonResponse(405, { ok: false }, { Allow: "GET", "Cache-Control": "public" });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    await expect(response.json()).resolves.toEqual({ ok: false });
  });

  it("keeps 204 responses empty and carries the session cookie", async () => {
    const response = emptyResponse({ "Set-Cookie": "session=expired" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Set-Cookie")).toBe("session=expired");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("Content-Type")).toBe(false);
    await expect(response.text()).resolves.toBe("");
  });

  it("appends refresh cookies without discarding the response or other cookies", async () => {
    const source = jsonResponse(201, { ok: true }, { "Set-Cookie": "other=value" });
    expect(withSessionRefresh(source)).toBe(source);
    const response = withSessionRefresh(source, "session=next");
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual(["other=value", "session=next"]);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it.each([undefined, "null", "https://other.example", "http://pokepilot.app"])("rejects a missing or mismatched origin: %s", (origin) => {
    expect(isSameOrigin(new Request("https://pokepilot.app/api/test", {
      headers: origin ? { origin } : {},
    }))).toBe(false);
  });

  it("allows exact same-origin requests", () => {
    expect(isSameOrigin(new Request("https://pokepilot.app/api/test", {
      headers: { origin: "https://pokepilot.app" },
    }))).toBe(true);
  });

  it.each(["1", "true", " YES ", "on"])("recognizes enabled flag %s", (value) => {
    expect(isEnabled(value)).toBe(true);
  });
  it.each([undefined, "0", "false", "off", ""])("keeps other flags disabled: %s", (value) => {
    expect(isEnabled(value)).toBe(false);
  });
});
