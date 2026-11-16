import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveOpenAiApiKey } from "./server/openAiEnvironment";
import { resolvePokePilotSafeguardMode } from "./server/pokepilotOperations";
import { createPokePilotOperationsRuntime } from "./server/pokepilotOperationsRuntime";
import { vitePokePilotApiPlugin } from "./server/vitePokePilotApiPlugin";
import { viteBattleUsagePlugin } from "./server/viteBattleUsagePlugin";

export default defineConfig(({ mode }) => {
  const projectRoot = process.cwd();
  const openAiApiKey = resolveOpenAiApiKey(projectRoot, mode);
  const safeguardMode = resolvePokePilotSafeguardMode(mode);
  const operationsRuntime = createPokePilotOperationsRuntime();

  return {
    plugins: [
      react(),
      viteBattleUsagePlugin(),
      vitePokePilotApiPlugin(
        openAiApiKey,
        safeguardMode,
        operationsRuntime.operations,
        operationsRuntime.kind,
      ),
    ],
  };
});
