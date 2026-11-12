// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PrivacyControl } from "./PrivacyControl";
import { setUsageMetricsEnabled } from "../utils/usageMetrics";

const state = vi.hoisted(() => ({ enabled: true, locale: "en", available: true, signal: false }));
vi.mock("../utils/usageMetrics", () => ({
  USAGE_METRICS_CHANGED: "test:usage-metrics",
  USAGE_OPT_OUT_KEY: "test:usage-opt-out",
  readUsageMetricsEnabled: () => state.enabled,
  hasUsagePrivacySignal: () => state.signal,
  usageMetricsAvailable: () => state.available,
  setUsageMetricsEnabled: vi.fn((enabled: boolean) => {
    state.enabled = enabled;
    window.dispatchEvent(new Event("test:usage-metrics"));
  }),
}));
vi.mock("../i18n/useLocalization", () => ({ useLocalization: () => ({ locale: state.locale, t: (key: string) => key }) }));
vi.mock("./TouchSelectionDialog", () => ({ TouchSelectionDialog: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div> }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  Object.assign(state, { enabled: true, locale: "en", available: true, signal: false });
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => '<article lang="en"><h1>Privacy</h1><p>Notice</p></article><article lang="ko"><h1>개인정보</h1><p>안내</p></article>' }));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(<PrivacyControl />); });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function openPrivacy() {
  await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
}

it("does not show a consent prompt or extra footer actions", () => {
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(container.querySelector('[role="group"]')).toBeNull();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).toBe("footer.privacy");
});
it("allows disabling aggregate statistics in the privacy dialog", async () => {
  await openPrivacy();
  const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(checkbox.checked).toBe(true);
  expect(container.textContent).toContain("Notice");
  await act(async () => checkbox.click());
  expect(setUsageMetricsEnabled).toHaveBeenLastCalledWith(false);
  expect(checkbox.checked).toBe(false);
});
it("shows Korean copy and respects a browser privacy signal", async () => {
  Object.assign(state, { locale: "ko", signal: true, enabled: false });
  await act(async () => root.render(<PrivacyControl />));
  await openPrivacy();
  const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(container.textContent).toContain("익명 API 사용 통계");
  expect(checkbox.checked).toBe(false);
  expect(checkbox.disabled).toBe(true);
});
it("does not offer inactive collection controls on local/QA hosts", async () => {
  state.available = false;
  await openPrivacy();
  expect(container.querySelector('input[type="checkbox"]')).toBeNull();
});
