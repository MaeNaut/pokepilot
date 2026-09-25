const endpoint = "/api/pokepilot/personal-api-key";

export async function readPersonalApiKeyStatus() {
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("KEY_STATUS_UNAVAILABLE");
  const body = await response.json() as { hasKey?: unknown };
  if (typeof body.hasKey !== "boolean") throw new Error("KEY_STATUS_UNAVAILABLE");
  return body.hasKey;
}

export async function savePersonalApiKey(apiKey: string) {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error("KEY_SAVE_FAILED");
}

export async function removePersonalApiKey() {
  const response = await fetch(endpoint, { method: "DELETE" });
  if (!response.ok) throw new Error("KEY_DELETE_FAILED");
}
