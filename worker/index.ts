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
import { handlePersonalApiKey, readPersonalApiKey } from "./personalApiKey.js";
import type { WorkerEnvironment } from "./env.js";
import type { PokePilotOperationalEvent } from "../server/pokepilotApi.js";
import { metricRoute, recordMetric, pruneMetrics } from "./metrics.js";

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

async function handleAnalyze(request: Request, env: WorkerEnvironment, onOperationalEvent?: (event: PokePilotOperationalEvent) => void) {
  let authenticatedAccountId: string | undefined;
  let refreshCookie: string | undefined;
  let accountId: string | undefined;
  if (isEnabled(env.POKEPILOT_AUTH_REQUIRED)) {
    const session = await readAccountSession(request, env);
    if (!session) {
      return jsonResponse(401, {
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED", providerAttempted: false },
      });
    }
    authenticatedAccountId = await accountUsageId(session.account, env);
    accountId = session.account.id;
    refreshCookie = session.refreshCookie;
  }
  const effort = request.headers.get("X-PokePilot-Reasoning-Effort") ?? "low";
  const modelId = request.headers.get("X-PokePilot-Model") ?? "gpt-6-luna";
  if (effort !== "low" && effort !== "medium") {
    return jsonResponse(400, { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid reasoning effort.", providerAttempted: false } });
  }
  if ((modelId !== "gpt-6-luna" && modelId !== "gpt-6-sol") || (modelId === "gpt-6-sol" && effort !== "low")) {
    return jsonResponse(400, { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid model selection.", providerAttempted: false } });
  }
  const personalKey = accountId ? await readPersonalApiKey(accountId, env) : null;
  if ((effort === "medium" || modelId === "gpt-6-sol") && !personalKey) {
    return jsonResponse(403, { ok: false, error: { code: "PERSONAL_KEY_REQUIRED", message: "A personal API key is required for this model.", providerAttempted: false } });
  }
  const response = await handleWebPokePilotApi(request, {
    apiKey: personalKey ?? env.OPENAI_API_KEY,
    reasoningEffort: effort,
    modelId,
    billingSource: personalKey ? "personal" : "site",
    billingIdentity: personalKey ? accountId : undefined,
    onOperationalEvent,
    authenticatedAccountId,
    clientSecret: env.POKEPILOT_CLIENT_SECRET,
    operations: getOperationsRuntime(env).operations,
    requesterIp: request.headers.get("CF-Connecting-IP") ?? undefined,
    ...(personalKey ? { safeguardMode: "ai-fresh" as const } : {}),
  });
  return withSessionRefresh(response, refreshCookie);
}

const router = {
  async fetch(request: Request, env: WorkerEnvironment, onOperationalEvent?: (event: PokePilotOperationalEvent) => void): Promise<Response> {
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
      if (url.pathname === "/api/pokepilot/personal-api-key") return await handlePersonalApiKey(request, env);
      if (url.pathname === "/api/pokepilot/analyze") return await handleAnalyze(request, env, onOperationalEvent);
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
};

export default {
  async fetch(request: Request, env: WorkerEnvironment, ctx?: ExecutionContext): Promise<Response> {
    const started = Date.now();
    let event: PokePilotOperationalEvent | undefined;
    const response = await router.fetch(request, env, (value) => { event = value; });
    const route = metricRoute(new URL(request.url).pathname);
    if (route && ctx && env.POKEPILOT_METRICS_ENABLED === "true") {
      ctx.waitUntil(recordMetric(env, route, response.status, Date.now() - started, event));
    }
    return response;
  },
  async scheduled(_controller: ScheduledController, env: WorkerEnvironment) {
    await pruneMetrics(env);
  },
} satisfies ExportedHandler<WorkerEnvironment>;
