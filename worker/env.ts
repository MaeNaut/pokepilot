import type { PokePilotOperationsEnvironment } from "../server/pokepilotOperationsRuntime.js";

export type WorkerEnvironment = PokePilotOperationsEnvironment & {
  ASSETS: Fetcher;
  DB: D1Database;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  OPENAI_API_KEY?: string;
  POKEPILOT_AUTH_REQUIRED?: string;
  POKEPILOT_CLIENT_SECRET?: string;
  POKEPILOT_SESSION_SECRET?: string;
};
