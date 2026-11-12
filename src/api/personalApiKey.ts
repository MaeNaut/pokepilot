import { rejectChangedAccount } from "./accountSessionBoundary";
import { withUsageMetricsPreference } from "../utils/usageMetrics";

const endpoint = "/api/pokepilot/personal-api-key";

export async function readPersonalApiKeyStatus(accountId?: string) {
  const response = await fetch(endpoint, withUsageMetricsPreference({
    cache: "no-store",
    ...(accountId ? { headers: { "X-PokePilot-Account-Id": accountId } } : {}),
  }));
  await rejectChangedAccount(response);
  if (!response.ok) throw new Error("KEY_STATUS_UNAVAILABLE");
  const body = await response.json() as { hasKey?: unknown };
  if (typeof body.hasKey !== "boolean") throw new Error("KEY_STATUS_UNAVAILABLE");
  return body.hasKey;
}

export async function savePersonalApiKey(apiKey: string, accountId?: string) {
  const response = await fetch(endpoint, withUsageMetricsPreference({
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(accountId ? { "X-PokePilot-Account-Id": accountId } : {}),
    },
    body: JSON.stringify({ apiKey }),
  }));
  await rejectChangedAccount(response);
  if (!response.ok) throw new Error("KEY_SAVE_FAILED");
}

export async function removePersonalApiKey(accountId?: string) {
  const response = await fetch(endpoint, withUsageMetricsPreference({
    method: "DELETE",
    ...(accountId ? { headers: { "X-PokePilot-Account-Id": accountId } } : {}),
  }));
  await rejectChangedAccount(response);
  if (!response.ok) throw new Error("KEY_DELETE_FAILED");
}
