import { persistAccountCookies } from "./accountSession";

export const accountAuthEnabled = import.meta.env.VITE_ACCOUNT_AUTH_ENABLED === "true";
let initialization: Promise<void> | undefined;
let subscribed = false;

export type AccountProfile = {
  id: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
};

function getSecurePictureUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function getAccountProfile(
  id: string,
  identityUser: {
    email?: string;
    name?: string;
    pictureUrl?: string;
  } | null,
): AccountProfile {
  const pictureUrl = getSecurePictureUrl(identityUser?.pictureUrl);

  return {
    id,
    ...(identityUser?.email ? { email: identityUser.email } : {}),
    ...(identityUser?.name ? { name: identityUser.name } : {}),
    ...(pictureUrl ? { pictureUrl } : {}),
  };
}

export function initializeAccountAuth() {
  if (!accountAuthEnabled) return Promise.resolve();
  return initialization ??= import("@netlify/identity").then(async sdk => {
    if (!subscribed) {
      sdk.onAuthChange((event, user) => {
        if (user && (event === sdk.AUTH_EVENTS.LOGIN || event === sdk.AUTH_EVENTS.TOKEN_REFRESH)) {
          persistAccountCookies();
        }
      });
      subscribed = true;
    }
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
  const currentUser = await sdk.getUser();
  await sdk.refreshSession();
  const identityUser = (await sdk.getUser()) ?? currentUser;
  const response = await fetch("/api/pokepilot/account", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("AUTH_UNAVAILABLE");
  const body = await response.json();
  if (body.enabled !== true || typeof body.user?.id !== "string") throw new Error("AUTH_UNAVAILABLE");
  persistAccountCookies();
  return getAccountProfile(body.user.id, identityUser);
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
