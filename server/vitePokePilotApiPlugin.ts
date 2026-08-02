import type { Plugin } from "vite";
import { handleNodePokePilotApi } from "./nodePokepilotApi";
import type {
  PokePilotOperations,
  PokePilotSafeguardMode,
} from "./pokepilotOperations";

export function vitePokePilotApiPlugin(
  apiKey?: string,
  safeguardMode: PokePilotSafeguardMode = "enforced",
  operations?: PokePilotOperations,
  operationsKind: "memory" | "upstash" = "memory",
): Plugin {
  return {
    name: "pokepilot-local-analysis-api",
    apply: "serve",
    configureServer(server) {
      server.config.logger.info(
        `[PokePilot API] Safeguards: ${safeguardMode}; operations: ${operationsKind}`,
      );
      server.middlewares.use(
        "/api/pokepilot/analyze",
        (request, response) => {
          void handleNodePokePilotApi(request, response, {
            apiKey,
            operations,
            safeguardMode,
          });
        },
      );
    },
  };
}
