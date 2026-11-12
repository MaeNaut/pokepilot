// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let metrics: typeof import("./usageMetrics");
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  metrics = await import("./usageMetrics");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("server usage preference, without a browser collector", () => {
  it("sends no request and stores no activity on initialization or normal API preparation", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const init = { method: "PUT", body: "functional payload", headers: { "X-PokePilot-Account-Id": "account" } };
    expect(metrics.withUsageMetricsPreference(init)).toBe(init);
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(metrics).not.toHaveProperty("trackUsageEvent");
    expect(metrics).not.toHaveProperty("startUsageMetrics");
  });
  it("stores only refusal and attaches it without replacing functional headers, body or signal", () => {
    const signal = new AbortController().signal;
    metrics.setUsageMetricsEnabled(false);
    const init = { headers: { "Content-Type": "application/json", "X-PokePilot-Account-Id": "account" }, body: "payload", signal };
    const prepared = metrics.withUsageMetricsPreference(init);
    const headers = new Headers(prepared.headers);
    expect(headers.get("X-PokePilot-Usage-Opt-Out")).toBe("1");
    expect(headers.get("X-PokePilot-Account-Id")).toBe("account");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(prepared.body).toBe("payload");
    expect(prepared.signal).toBe(signal);
    expect(init.headers).not.toHaveProperty("X-PokePilot-Usage-Opt-Out");
    expect(Object.keys(localStorage)).toEqual([metrics.USAGE_OPT_OUT_KEY]);
    expect(sessionStorage.length).toBe(0);
    metrics.setUsageMetricsEnabled(true);
    expect(metrics.withUsageMetricsPreference(init)).toBe(init);
    expect(localStorage.length).toBe(0);
  });
  it("reads another tab's refusal without any shared visitor identifier", () => {
    expect(metrics.readUsageMetricsEnabled()).toBe(true);
    localStorage.setItem(metrics.USAGE_OPT_OUT_KEY, "1");
    expect(new Headers(metrics.withUsageMetricsPreference({}).headers).get("X-PokePilot-Usage-Opt-Out")).toBe("1");
  });
  it.each(["doNotTrack", "globalPrivacyControl"] as const)("honors %s independently of the stored preference", (signal) => {
    Object.defineProperty(navigator, signal, { configurable: true, get: vi.fn(() => signal === "doNotTrack" ? "1" : true) });
    try {
      metrics.setUsageMetricsEnabled(true);
      expect(metrics.readUsageMetricsEnabled()).toBe(false);
      expect(new Headers(metrics.withUsageMetricsPreference({}).headers).get("X-PokePilot-Usage-Opt-Out")).toBe("1");
      expect(localStorage.length).toBe(0);
    } finally { Reflect.deleteProperty(navigator, signal); }
  });
  it("fails closed on unavailable preference storage and supports a memory-only explicit choice", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(metrics.readUsageMetricsEnabled()).toBe(false);
    expect(() => metrics.setUsageMetricsEnabled(true)).not.toThrow();
    expect(metrics.readUsageMetricsEnabled()).toBe(true);
    expect(() => metrics.setUsageMetricsEnabled(false)).not.toThrow();
    expect(metrics.readUsageMetricsEnabled()).toBe(false);
  });
});
