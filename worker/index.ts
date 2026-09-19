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
  deleteCurrentAccount,
  logoutCurrentAccount,
  readAccountSession,
} from "./accountAuth.js";
import { handleAccountStorage } from "./accountStorage.js";
import type { WorkerEnvironment } from "./env.js";

let operationsRuntime: PokePilotOperationsRuntime | undefined;

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { headers: responseHeaders, status });
}

function withSessionRefresh(response: Response, refreshCookie?: string) {
  if (!refreshCookie) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", refreshCookie);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

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

async function handleAccount(request: Request, env: WorkerEnvironment) {
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
    return new Response(null, {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": setCookie,
        "X-Content-Type-Options": "nosniff",
      },
      status: 204,
    });
  }
  return jsonResponse(
    405,
    { ok: false, error: { code: "METHOD_NOT_ALLOWED" } },
    { Allow: "GET, DELETE" },
  );
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
        return createGoogleAuthorizationResponse(request, env);
      }
      if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
        return completeGoogleAuthorization(request, env);
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const setCookie = await logoutCurrentAccount(request, env);
        return new Response(null, {
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": setCookie,
            "X-Content-Type-Options": "nosniff",
          },
          status: 204,
        });
      }
      if (url.pathname === "/api/pokepilot/account") return handleAccount(request, env);
      if (url.pathname === "/api/pokepilot/teams") {
        return handleAccountStorage(request, env, "teams");
      }
      if (url.pathname === "/api/pokepilot/analysis-history") {
        return handleAccountStorage(request, env, "analysis-history");
      }
      if (url.pathname === "/api/pokepilot/preferences") {
        return handleAccountStorage(request, env, "preferences");
      }
      if (url.pathname === "/api/pokepilot/analyze") return handleAnalyze(request, env);
      if (url.pathname.startsWith("/smogon-stats/")) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonResponse(
            405,
            { ok: false, error: { code: "METHOD_NOT_ALLOWED" } },
            { Allow: "GET, HEAD" },
          );
        }
        return proxySmogonStats(request);
      }
      if (url.pathname.startsWith("/api/")) {
        return jsonResponse(404, { ok: false, error: { code: "NOT_FOUND" } });
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return accountErrorResponse(error);
    }
  },
} satisfies ExportedHandler<WorkerEnvironment>;
