export const USAGE_OPT_OUT_KEY = "pokepilot.usage-opt-out.v1";
export const USAGE_METRICS_CHANGED = "pokepilot:usage-metrics";
let memoryPreference: boolean | undefined;

export function hasUsagePrivacySignal() {
  return typeof navigator !== "undefined" && (navigator.doNotTrack === "1"
    || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);
}

export function usageMetricsAvailable() {
  return typeof window !== "undefined" && window.location.hostname === "pokepilot.app";
}

export function readUsageMetricsEnabled(): boolean {
  if (hasUsagePrivacySignal()) return false;
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(USAGE_OPT_OUT_KEY) !== "1"; }
  catch { return memoryPreference ?? false; }
}

export function setUsageMetricsEnabled(enabled: boolean) {
  memoryPreference = enabled;
  try {
    if (enabled) localStorage.removeItem(USAGE_OPT_OUT_KEY);
    else localStorage.setItem(USAGE_OPT_OUT_KEY, "1");
  } catch { /* Keep only the user's preference in memory if storage is blocked. */ }
  window.dispatchEvent(new Event(USAGE_METRICS_CHANGED));
}

// Attach a refusal to existing functional API calls; never send a telemetry request.
export function withUsageMetricsPreference(init: RequestInit): RequestInit {
  if (readUsageMetricsEnabled()) return init;
  const headers = new Headers(init.headers);
  headers.set("X-PokePilot-Usage-Opt-Out", "1");
  return { ...init, headers };
}
