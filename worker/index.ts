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
import { emptyResponse, jsonResponse, withSessionRefresh } from "./http.js";
import { handleAccountStorage } from "./accountStorage.js";
import { handleTeamLibrary } from "./teamLibrary.js";
import { handlePersonalApiKey, readPersonalApiKey } from "./personalApiKey.js";
import type { WorkerEnvironment } from "./env.js";
import type { PokePilotOperationalEvent } from "../server/pokepilotApi.js";
import { metricRoute, recordMetric, pruneMetrics } from "./metrics.js";
import { handleCachedBattleUsage } from "./battleUsage.js";
import { allowsUsageMetrics, serviceOperation, recordUsageMetric, pruneUsageMetrics, type TeamUsageOperation } from "./usageMetrics.js";

const operationsRuntimes = new WeakMap<object, Map<string, PokePilotOperationsRuntime>>();

function accountErrorResponse(error: unknown) {
  const status = error instanceof AccountAuthError ? error.status : 503;
  const code = error instanceof AccountAuthError ? error.code : "AUTH_UNAVAILABLE";
  return jsonResponse(status, { ok: false, error: { code, message: code } });
}

function getOperationsRuntime(env: WorkerEnvironment) {
  const namespace = env.POKEPILOT_ANALYSIS_GATE;
  if (!namespace) throw new Error("PokePilot analysis gate binding is missing.");
  const scope = env.POKEPILOT_ANALYSIS_GATE_SCOPE;
  if (scope !== "production" && scope !== "qa") throw new Error("PokePilot analysis gate scope is missing or invalid.");
  let scoped = operationsRuntimes.get(namespace);
  if (!scoped) {
    scoped = new Map();
    operationsRuntimes.set(namespace, scoped);
  }
  let runtime = scoped.get(scope);
  if (!runtime) {
    runtime = createPokePilotOperationsRuntime(namespace, `analysis-v1:${scope}`);
    scoped.set(scope, runtime);
  }
  return runtime;
}

async function handleAnalyze(request: Request, env: WorkerEnvironment, onOperationalEvent?: (event: PokePilotOperationalEvent) => void) {
  if (env.POKEPILOT_ANALYSIS_PAUSED === "true") {
    const response = jsonResponse(503, {
      ok: false,
      error: { code: "AI_UPSTREAM_ERROR", message: "Analysis is temporarily paused for maintenance.", providerAttempted: false },
    });
    response.headers.set("Retry-After", "30");
    return response;
  }
  const session = await readAccountSession(request, env);
  if (!session) {
    return jsonResponse(401, {
      ok: false,
      error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED", providerAttempted: false },
    });
  }
  const expectedAccountId = request.headers.get("X-PokePilot-Account-Id");
  if (expectedAccountId !== session.account.id) {
    return jsonResponse(403, {
      ok: false,
      error: { code: "ACCOUNT_SESSION_CHANGED", message: "Account session changed.", providerAttempted: false },
    });
  }
  const authenticatedAccountId = await accountUsageId(session.account, env);
  const accountId = session.account.id;
  const refreshCookie = session.refreshCookie;
  const effort = request.headers.get("X-PokePilot-Reasoning-Effort") ?? "low";
  const modelId = request.headers.get("X-PokePilot-Model") ?? "gpt-6-luna";
  if (effort !== "low" && effort !== "medium") {
    return jsonResponse(400, { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid reasoning effort.", providerAttempted: false } });
  }
  if (modelId !== "gpt-6-luna") {
    return jsonResponse(400, { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid model selection.", providerAttempted: false } });
  }
  const personalKey = await readPersonalApiKey(accountId, env);
  if (!personalKey) {
    return withSessionRefresh(jsonResponse(403, { ok: false, error: { code: "PERSONAL_KEY_REQUIRED", message: "A personal API key is required for PokePilot analysis.", providerAttempted: false } }), refreshCookie);
  }
  let operations: PokePilotOperationsRuntime["operations"];
  try {
    operations = getOperationsRuntime(env).operations;
  } catch {
    return withSessionRefresh(jsonResponse(503, {
      ok: false,
      error: { code: "AI_UPSTREAM_ERROR", message: "Analysis service is temporarily unavailable.", providerAttempted: false },
    }), refreshCookie);
  }
  const response = await handleWebPokePilotApi(request, {
    apiKey: personalKey,
    reasoningEffort: effort,
    modelId,
    billingSource: "personal",
    billingIdentity: accountId,
    onOperationalEvent,
    authenticatedAccountId,
    clientSecret: env.POKEPILOT_CLIENT_SECRET?.trim() || env.POKEPILOT_SESSION_SECRET,
    operations,
    requesterIp: request.headers.get("CF-Connecting-IP") ?? undefined,
    safeguardMode: "personal",
  });
  return withSessionRefresh(response, refreshCookie);
}

const router = {
  async fetch(request: Request, env: WorkerEnvironment, onOperationalEvent?: (event: PokePilotOperationalEvent) => void,
    onTeamOperation?: (operation: TeamUsageOperation) => void): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/auth/google" && request.method === "GET") {
        return await createGoogleAuthorizationResponse(request, env);
      }
      if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
        return await completeGoogleAuthorization(request, env);
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const expectedAccountId = request.headers.get("X-PokePilot-Account-Id");
        const session = await readAccountSession(request, env, { refresh: false });
        if (!session) return jsonResponse(401, { ok: false, error: { code: "AUTH_REQUIRED" } });
        if (session.account.id !== expectedAccountId) {
          return jsonResponse(403, { ok: false, error: { code: "ACCOUNT_SESSION_CHANGED" } });
        }
        const setCookie = await logoutCurrentAccount(request, env);
        return emptyResponse({ "Set-Cookie": setCookie });
      }
      if (url.pathname === "/api/pokepilot/account") return await handleAccount(request, env);
      if (url.pathname === "/api/pokepilot/team-library") {
        return await handleTeamLibrary(request, env, onTeamOperation);
      }
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
      if (url.pathname.startsWith("/api/battle-usage/")) return await handleCachedBattleUsage(request);
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
    let teamOperation: TeamUsageOperation | undefined;
    const response = await router.fetch(request, env, (value) => { event = value; }, (value) => { teamOperation = value; });
    const elapsed = Date.now() - started;
    const route = metricRoute(new URL(request.url).pathname);
    if (route && ctx && env.POKEPILOT_METRICS_ENABLED === "true") {
      ctx.waitUntil(recordMetric(env, route, response.status, elapsed, event));
    }
    if (ctx && env.POKEPILOT_USAGE_METRICS_ENABLED === "true" && allowsUsageMetrics(request)) {
      const operation = teamOperation ?? serviceOperation(request);
      if (operation) ctx.waitUntil(recordUsageMetric(env, operation, response.status, elapsed));
    }
    return response;
  },
  async scheduled(_controller: ScheduledController, env: WorkerEnvironment) {
    await pruneMetrics(env);
    await pruneUsageMetrics(env);
  },
} satisfies ExportedHandler<WorkerEnvironment>;
