import type { PokePilotAnalysisGateNamespace } from "../server/durablePokePilotOperations.js";

export type WorkerEnvironment = {
  POKEPILOT_ANALYSIS_GATE?: PokePilotAnalysisGateNamespace;
  POKEPILOT_ANALYSIS_GATE_SCOPE?: string;
  POKEPILOT_ANALYSIS_PAUSED?: string;
  ASSETS: Fetcher;
  DB: D1Database;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  OPENAI_API_KEY?: string;
  POKEPILOT_AUTH_REQUIRED?: string;
  POKEPILOT_CLIENT_SECRET?: string;
  POKEPILOT_SESSION_SECRET?: string;
  POKEPILOT_METRICS_ENABLED?: string;
  POKEPILOT_USAGE_METRICS_ENABLED?: string;
};
