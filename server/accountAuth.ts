import { createHash } from "node:crypto";

export class AccountAuthError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

export type VerifiedAccount = { id: string };

// Verify with Identity on every request: decoded claims alone must never authorize billing.
export async function verifyAccount(request: Request, identityUrl: string | undefined): Promise<VerifiedAccount> {
  if (!identityUrl) throw new AccountAuthError(503, "AUTH_UNAVAILABLE");
  const endpoint = new URL(identityUrl);
  if (endpoint.protocol !== "https:") throw new AccountAuthError(503, "AUTH_UNAVAILABLE");
  const raw = request.headers.get("cookie")?.split(";")
    .map(part => part.trim()).find(part => part.startsWith("nf_jwt="))?.slice(7);
  if (!raw || raw.length > 8192) throw new AccountAuthError(401, "AUTH_REQUIRED");
  let token: string;
  try { token = decodeURIComponent(raw); }
  catch { throw new AccountAuthError(401, "AUTH_REQUIRED"); }
  let response: Response;
  try {
    response = await fetch(`${identityUrl.replace(/\/$/, "")}/user`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
  } catch { throw new AccountAuthError(503, "AUTH_UNAVAILABLE"); }
  if (response.status === 401 || response.status === 403) {
    throw new AccountAuthError(401, "AUTH_REQUIRED");
  }
  if (!response.ok) throw new AccountAuthError(503, "AUTH_UNAVAILABLE");
  const user = await response.json().catch(() => null);
  if (typeof user?.id !== "string" || !user.id || !user.confirmed_at) {
    throw new AccountAuthError(401, "AUTH_REQUIRED");
  }
  return { id: user.id };
}

export function accountUsageId(account: VerifiedAccount) {
  return `account:${createHash("sha256").update(account.id).digest("hex")}`;
}

export function accountErrorResponse(error: unknown) {
  const forbidden = error instanceof Error && "status" in error && error.status === 403;
  const status = error instanceof AccountAuthError ? error.status : forbidden ? 403 : 503;
  const code = error instanceof AccountAuthError ? error.code : forbidden ? "AUTH_FORBIDDEN" : "AUTH_UNAVAILABLE";
  return Response.json({ ok: false, error: { code, message: code } }, {
    status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
