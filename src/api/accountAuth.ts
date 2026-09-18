export const accountAuthEnabled = import.meta.env.VITE_ACCOUNT_AUTH_ENABLED === "true";
let initialization: Promise<void> | undefined;

export function initializeAccountAuth() {
  if (!accountAuthEnabled) return Promise.resolve();
  return initialization ??= import("@netlify/identity").then(async sdk => {
    await sdk.handleAuthCallback();
    await sdk.getUser();
  }).catch(error => {
    initialization = undefined;
    throw error;
  });
}

export async function readAccount() {
  await initializeAccountAuth();
  const sdk = await import("@netlify/identity");
  await sdk.getUser();
  await sdk.refreshSession();
  const response = await fetch("/api/pokepilot/account", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("AUTH_UNAVAILABLE");
  const body = await response.json();
  if (body.enabled !== true || typeof body.user?.id !== "string") throw new Error("AUTH_UNAVAILABLE");
  return body.user as { id: string };
}

export async function loginAccount() {
  const sdk = await import("@netlify/identity");
  const settings = await sdk.getSettings();
  if (!settings.providers.google) throw new Error("AUTH_UNAVAILABLE");
  sdk.oauthLogin("google");
}

export async function logoutAccount() {
  await (await import("@netlify/identity")).logout();
}

export async function deleteAccount() {
  const response = await fetch("/api/pokepilot/account", { method: "DELETE" });
  if (!response.ok) throw new Error("DELETE_FAILED");
  await logoutAccount();
}
