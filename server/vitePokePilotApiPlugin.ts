import type { Plugin } from "vite";
import { handleNodePokePilotApi } from "./nodePokepilotApi";

export function vitePokePilotApiPlugin(apiKey?: string): Plugin {
  return {
    name: "pokepilot-local-analysis-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        "/api/pokepilot/analyze",
        (request, response) => {
          void handleNodePokePilotApi(request, response, apiKey);
        },
      );
    },
  };
}
