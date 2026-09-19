import { deleteCurrentAccount, readAccountSession } from "./accountAuth.js";
import { emptyResponse, isEnabled, jsonResponse } from "./http.js";
import type { WorkerEnvironment } from "./env.js";

export async function handleAccount(request: Request, env: WorkerEnvironment) {
  const authRequired = isEnabled(env.POKEPILOT_AUTH_REQUIRED);
  if (request.method === "GET") {
    if (!authRequired) return jsonResponse(200, { enabled: false });
    const session = await readAccountSession(request, env);
    if (!session) return jsonResponse(401, { ok: false, error: { code: "AUTH_REQUIRED" } });
    return jsonResponse(
      200,
      { enabled: true, user: session.account },
      session.refreshCookie ? { "Set-Cookie": session.refreshCookie } : {},
    );
  }
  if (request.method === "DELETE") {
    if (!authRequired) return jsonResponse(404, { ok: false, error: { code: "AUTH_DISABLED" } });
    const session = await readAccountSession(request, env, { refresh: false });
    if (!session) return jsonResponse(401, { ok: false, error: { code: "AUTH_REQUIRED" } });
    const setCookie = await deleteCurrentAccount(request, env, session.account);
    return emptyResponse({ "Set-Cookie": setCookie });
  }
  return jsonResponse(
    405,
    { ok: false, error: { code: "METHOD_NOT_ALLOWED" } },
    { Allow: "GET, DELETE" },
  );
}
