import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveOpenAiApiKey } from "./server/openAiEnvironment";
import { resolvePokePilotSafeguardMode } from "./server/pokepilotOperations";
import { createPokePilotViteOperationsRuntime } from "./server/pokepilotOperationsRuntime";
import { vitePokePilotApiPlugin } from "./server/vitePokePilotApiPlugin";

export default defineConfig(({ mode }) => {
  const projectRoot = process.cwd();
  const openAiApiKey = resolveOpenAiApiKey(projectRoot, mode);
  const safeguardMode = resolvePokePilotSafeguardMode(mode);
  const serverEnvironment = {
    ...process.env,
    ...loadEnv(mode, projectRoot, ""),
  };
  const operationsRuntime = createPokePilotViteOperationsRuntime(
    mode,
    serverEnvironment,
  );
  const smogonStatsProxy = {
    "/smogon-stats": {
      target: "https://www.smogon.com",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/smogon-stats/, "/stats"),
    },
  };

  return {
    plugins: [
      react(),
      vitePokePilotApiPlugin(
        openAiApiKey,
        safeguardMode,
        operationsRuntime.operations,
        operationsRuntime.kind,
      ),
    ],
    server: {
      proxy: smogonStatsProxy,
    },
    preview: {
      proxy: smogonStatsProxy,
    },
  };
});
