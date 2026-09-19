import { handleWebPokePilotApi } from "../server/webPokePilotApi.js";
import {
  createPokePilotOperationsRuntime,
  type PokePilotOperationsRuntime,
} from "../server/pokepilotOperationsRuntime.js";
import {
  AccountAuthError,
  accountUsageId,
  completeGoogleAuthorization,
  createGoogleAuthorizationResponse,
  logoutCurrentAccount,
  readAccountSession,
} from "./accountAuth.js";
import { handleAccount } from "./accountEndpoint.js";
import { emptyResponse, isEnabled, jsonResponse, withSessionRefresh } from "./http.js";
import { handleAccountStorage } from "./accountStorage.js";
import type { WorkerEnvironment } from "./env.js";

let operationsRuntime: PokePilotOperationsRuntime | undefined;

function accountErrorResponse(error: unknown) {
  const status = error instanceof AccountAuthError ? error.status : 503;
  const code = error instanceof AccountAuthError ? error.code : "AUTH_UNAVAILABLE";
  return jsonResponse(status, { ok: false, error: { code, message: code } });
}

function getOperationsRuntime(env: WorkerEnvironment) {
  return operationsRuntime ??= createPokePilotOperationsRuntime(env);
}

function proxySmogonStats(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/smogon-stats/, "/stats");
  const upstream = new URL(path, "https://www.smogon.com");
  upstream.search = url.search;
  return fetch(new Request(upstream, request));
}

async function handleAnalyze(request: Request, env: WorkerEnvironment) {
  let authenticatedAccountId: string | undefined;
  let refreshCookie: string | undefined;
  if (isEnabled(env.POKEPILOT_AUTH_REQUIRED)) {
    const session = await readAccountSession(request, env);
    if (!session) {
      return jsonResponse(401, {
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" },
      });
    }
    authenticatedAccountId = await accountUsageId(session.account, env);
    refreshCookie = session.refreshCookie;
  }
  const response = await handleWebPokePilotApi(request, {
    apiKey: env.OPENAI_API_KEY,
    authenticatedAccountId,
    clientSecret: env.POKEPILOT_CLIENT_SECRET,
    operations: getOperationsRuntime(env).operations,
    requesterIp: request.headers.get("CF-Connecting-IP") ?? undefined,
  });
  return withSessionRefresh(response, refreshCookie);
}

export default {
  async fetch(request, env: WorkerEnvironment): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/auth/google" && request.method === "GET") {
        return await createGoogleAuthorizationResponse(request, env);
      }
      if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
        return await completeGoogleAuthorization(request, env);
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const setCookie = await logoutCurrentAccount(request, env);
        return emptyResponse({ "Set-Cookie": setCookie });
      }
      if (url.pathname === "/api/pokepilot/account") return await handleAccount(request, env);
      if (url.pathname === "/api/pokepilot/teams") {
        return await handleAccountStorage(request, env, "teams");
      }
      if (url.pathname === "/api/pokepilot/analysis-history") {
        return await handleAccountStorage(request, env, "analysis-history");
      }
      if (url.pathname === "/api/pokepilot/preferences") {
        return await handleAccountStorage(request, env, "preferences");
      }
      if (url.pathname === "/api/pokepilot/analyze") return await handleAnalyze(request, env);
      if (url.pathname.startsWith("/smogon-stats/")) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonResponse(
            405,
            { ok: false, error: { code: "METHOD_NOT_ALLOWED" } },
            { Allow: "GET, HEAD" },
          );
        }
        return await proxySmogonStats(request);
      }
      if (url.pathname.startsWith("/api/")) {
        return jsonResponse(404, { ok: false, error: { code: "NOT_FOUND" } });
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return accountErrorResponse(error);
    }
  },
} satisfies ExportedHandler<WorkerEnvironment>;
