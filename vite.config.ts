import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveOpenAiApiKey } from "./server/openAiEnvironment";
import { vitePokePilotApiPlugin } from "./server/vitePokePilotApiPlugin";

export default defineConfig(({ mode }) => {
  const openAiApiKey = resolveOpenAiApiKey(process.cwd(), mode);

  return {
    plugins: [react(), vitePokePilotApiPlugin(openAiApiKey)],
    server: {
      proxy: {
        "/smogon-stats": {
          target: "https://www.smogon.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/smogon-stats/, "/stats"),
        },
      },
    },
  };
});
