export const accountAuthEnabled = import.meta.env.VITE_ACCOUNT_AUTH_ENABLED === "true";

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

export async function readAccount() {
  const response = await fetch("/api/pokepilot/account", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("AUTH_UNAVAILABLE");
  const body = await response.json();
  if (body.enabled !== true || typeof body.user?.id !== "string") throw new Error("AUTH_UNAVAILABLE");
  const pictureUrl = getSecurePictureUrl(body.user.pictureUrl);
  return {
    id: body.user.id,
    ...(typeof body.user.email === "string" ? { email: body.user.email } : {}),
    ...(typeof body.user.name === "string" ? { name: body.user.name } : {}),
    ...(pictureUrl ? { pictureUrl } : {}),
  };
}

export async function loginAccount() {
  window.location.assign("/api/auth/google");
}

export async function logoutAccount() {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) throw new Error("AUTH_UNAVAILABLE");
}

export async function deleteAccount() {
  const response = await fetch("/api/pokepilot/account", { method: "DELETE" });
  if (!response.ok) throw new Error("DELETE_FAILED");
}
