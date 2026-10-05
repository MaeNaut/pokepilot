import { createBattleUsageApi } from "../server/battleUsageApi";

const handle = createBattleUsageApi();
export async function handleCachedBattleUsage(request: Request) {
  const url = new URL(request.url);
  const cacheable = request.method === "GET" && !url.search &&
    /^\/api\/battle-usage\/(singles|doubles)(?:\/[a-z0-9-]{1,80})?$/.test(url.pathname);
  let cache: Cache | undefined;
  const key = new Request(`${url.origin}${url.pathname}`);
  if (cacheable && typeof caches !== "undefined") {
    try {
      cache = await caches.open("battle-usage-v2");
      const cached = await cache.match(key);
      if (cached) return cached;
    } catch { /* Cache availability must not block public data. */ }
  }
  const response = await handle(request);
  if (cache && response.ok && !response.headers.get("Cache-Control")?.includes("no-store")) {
    try { await cache.put(key, response.clone()); } catch { /* Use the uncached response. */ }
  }
  return response;
}
