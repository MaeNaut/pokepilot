import {
  BATTLE_USAGE_MAX_AGE, BATTLE_USAGE_PATH, BATTLE_USAGE_TTL,
  parseBattleUsageDetail, parseBattleUsageIndex,
  type BattleUsageSet, type BattleUsageSnapshot,
} from "../src/api/battleUsageData";
import type { BattleFormat } from "../src/battleFormat/battleFormat";
import { normalizeShowdownId } from "../src/api/showdownIds";

const ORIGIN = "https://championsbattledata.com";
export function createBattleUsageApi() {
  const index = new Map<BattleFormat, { value: BattleUsageSnapshot; fetchedAt: number }>();
  let pendingIndex: Promise<void> | undefined;
  const retryAfter = new Map<BattleFormat, number>();
  const details = new Map<string, BattleUsageSet>();
  const pendingDetails = new Map<string, Promise<BattleUsageSet>>();

  async function readJson(path: string) {
    const response = await fetch(new Request(`${ORIGIN}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    }));
    if (!response.ok) throw new Error("Battle usage upstream unavailable");
    return response.json() as Promise<unknown>;
  }

  async function loadIndex(format: BattleFormat) {
    const cached = index.get(format);
    if (cached && Date.now() - cached.fetchedAt < BATTLE_USAGE_TTL &&
      Date.now() - Date.parse(cached.value.sourceDate) < BATTLE_USAGE_MAX_AGE) return cached.value;
    if (Date.now() < (retryAfter.get(format) ?? 0)) throw new Error("Usage refresh deferred");
    if (!pendingIndex) {
      pendingIndex = (async () => {
        const raw = await readJson("/api");
        for (const key of ["singles", "doubles"] as const) {
          try {
            const value = parseBattleUsageIndex(raw, key);
            index.set(key, { value, fetchedAt: Date.now() });
            retryAfter.delete(key);
          } catch {
            retryAfter.set(key, Date.now() + 60_000);
          }
        }
        details.clear();
      })().catch((error: unknown) => {
        for (const key of ["singles", "doubles"] as const) retryAfter.set(key, Date.now() + 60_000);
        throw error;
      }).finally(() => { pendingIndex = undefined; });
    }
    await pendingIndex;
    const updated = index.get(format);
    if (!updated || retryAfter.has(format)) throw new Error("Battle usage format is unavailable");
    return updated.value;
  }

  return async function handleBattleUsage(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/battle-usage\/(singles|doubles)(?:\/([a-z0-9-]{1,80}))?$/);
    const error = (status: number, message: string) => new Response(request.method === "HEAD" ? null : JSON.stringify({ error: message }), {
      status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(status === 405 ? { Allow: "GET, HEAD" } : {}) },
    });
    if (!match || url.search) return error(400, "Invalid usage request");
    if (request.method !== "GET" && request.method !== "HEAD") return error(405, "Method not allowed");
    const format = match[1] as BattleFormat;
    try {
      const snapshot = await loadIndex(format);
      let value: BattleUsageSnapshot | BattleUsageSet = snapshot;
      if (match[2]) {
        const id = normalizeShowdownId(match[2]);
        const base = snapshot.sets.find((set) => normalizeShowdownId(set.pokemonId) === id);
        if (!base) return error(404, "No usage data for this Pokemon");
        const key = `${format}:${snapshot.generatedAt}:${snapshot.sourceDate}:${id}`;
        if (!details.has(key)) {
          if (!pendingDetails.has(key)) {
            const apiFormat = format === "singles" ? "Singles" : "Doubles";
            pendingDetails.set(key, readJson(`/api/battle/${apiFormat}/${id}?season=${snapshot.season}&days=2`)
              .then((raw) => {
                const set = parseBattleUsageDetail(raw, base, format);
                if (details.size >= 600) details.clear();
                details.set(key, set);
                return set;
              }).finally(() => { pendingDetails.delete(key); }));
          }
          value = await pendingDetails.get(key)!;
        } else value = details.get(key)!;
      }
      return new Response(request.method === "HEAD" ? null : JSON.stringify(value), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300, s-maxage=3600" },
      });
    } catch {
      const previous = index.get(format)?.value;
      if (!match[2] && previous && Date.now() - Date.parse(previous.sourceDate) < BATTLE_USAGE_MAX_AGE) {
        return new Response(request.method === "HEAD" ? null : JSON.stringify({ ...previous, stale: true }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      return error(503, "Battle usage data is temporarily unavailable");
    }
  };
}

export { BATTLE_USAGE_PATH };
