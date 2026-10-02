import type { Plugin, ViteDevServer } from "vite";
import { BATTLE_USAGE_PATH, createBattleUsageApi } from "./battleUsageApi";

export function viteBattleUsagePlugin(): Plugin {
  const handle = createBattleUsageApi();
  const configure = (server: Pick<ViteDevServer, "middlewares">) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith(BATTLE_USAGE_PATH)) return next();
      const response = await handle(new Request(new URL(req.url, "http://localhost"), { method: req.method }));
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.end(await response.text());
    });
  };
  return { name: "battle-usage", configureServer: configure, configurePreviewServer: configure };
}
