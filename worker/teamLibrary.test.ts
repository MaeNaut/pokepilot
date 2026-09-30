import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { handleTeamLibrary } from "./teamLibrary";
import { handleAccountStorage } from "./accountStorage";
import { readAccountSession } from "./accountAuth";
import type { WorkerEnvironment } from "./env";

vi.mock("./accountAuth", async importOriginal => ({
  ...await importOriginal<typeof import("./accountAuth")>(),
  readAccountSession: vi.fn(async () => ({ account: { id: "a" }, refreshCookie: null })),
}));
const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.clearAllMocks(); });

function environment() {
  const sqlite = new DatabaseSync(":memory:");
  databases.push(sqlite);
  sqlite.exec("CREATE TABLE account_storage (account_id TEXT, storage_key TEXT, payload TEXT, updated_at INTEGER, PRIMARY KEY(account_id,storage_key))");
  function statement(sql: string, values: SQLInputValue[] = []): D1PreparedStatement {
    return {
      bind: (...args) => statement(sql, args as SQLInputValue[]),
      first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
      run: async <T>() => {
        const query = sqlite.prepare(sql);
        if (query.columns().length) return { success: true, results: query.all(...values) as T[] };
        const result = query.run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  }
  const DB: D1Database = {
    prepare: statement,
    batch: async statements => {
      sqlite.exec("BEGIN");
      try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec("COMMIT"); return results as never; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return { env: { DB } as WorkerEnvironment, sqlite };
}
const team = (id: string, name = id) => ({ id, name, slots: Array(6).fill(null), bench: [], version: 1,
  battleFormat: "singles", createdAt: "2026-09-29", updatedAt: "2026-09-29" });
function request(body?: unknown, accountId = "a") {
  return new Request("https://pokepilot.app/api/pokepilot/team-library", {
    method: body ? "PUT" : "GET", headers: { "X-PokePilot-Account-Id": accountId, origin: "https://pokepilot.app" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const save = (id: string, revision: string | null, name = id) => ({ operation: "save", id, revision, team: team(id, name) });

describe("per-team D1 library", () => {
  it("migrates once, keeps the backup, and blocks legacy writers after migration", async () => {
    const { env, sqlite } = environment();
    sqlite.prepare("INSERT INTO account_storage VALUES ('a', 'teams', ?, 7)").run(JSON.stringify([team("b"), team("a")]));
    const first = await (await handleTeamLibrary(request(), env)).json() as { teams: Array<{ id: string; revision: string }> };
    expect(first.teams.map(t => t.id)).toEqual(["b", "a"]);
    expect(first.teams[0].revision).toBe("7");
    await handleTeamLibrary(request({ operation: "delete", id: "b", revision: "7" }), env);
    const next = await (await handleTeamLibrary(request(), env)).json() as { teams: unknown[] };
    expect(next.teams).toHaveLength(1);
    expect(sqlite.prepare("SELECT payload FROM account_storage WHERE storage_key='teams'").get()).toBeTruthy();
    const legacy = await handleAccountStorage(request({ teams: [] }), env, "teams");
    expect(legacy.status).toBe(409);
  });

  it("allows independent team saves but rejects stale updates and deleted-team resurrection", async () => {
    const { env } = environment();
    const a = await (await handleTeamLibrary(request(save("a", null)), env)).json() as { team: { revision: string } };
    const b = await (await handleTeamLibrary(request(save("b", null)), env)).json() as { team: { revision: string } };
    expect((await handleTeamLibrary(request(save("a", a.team.revision, "edited A")), env)).status).toBe(200);
    expect((await handleTeamLibrary(request(save("b", b.team.revision, "edited B")), env)).status).toBe(200);
    expect((await handleTeamLibrary(request(save("a", a.team.revision, "stale")), env)).status).toBe(409);
    const list = await (await handleTeamLibrary(request(), env)).json() as { teams: Array<{ id: string; revision: string; name: string }> };
    expect(list.teams.map(t => t.name).sort()).toEqual(["edited A", "edited B"]);
    const latest = list.teams.find(t => t.id === "a")!;
    expect((await handleTeamLibrary(request({ operation: "delete", id: "a", revision: latest.revision }), env)).status).toBe(200);
    expect((await handleTeamLibrary(request(save("a", latest.revision)), env)).status).toBe(409);
  });

  it("enforces ownership before migration and checks origin before mutations", async () => {
    const { env, sqlite } = environment();
    expect((await handleTeamLibrary(request(undefined, "b"), env)).status).toBe(403);
    expect(sqlite.prepare("SELECT count(*) AS n FROM account_storage").get()?.n).toBe(0);
    const otherOrigin = request(save("a", null));
    otherOrigin.headers.set("origin", "https://example.com");
    expect((await handleTeamLibrary(otherOrigin, env)).status).toBe(403);
    vi.mocked(readAccountSession).mockResolvedValueOnce(null);
    expect((await handleTeamLibrary(request(), env)).status).toBe(401);
  });

  it("enforces capacity atomically and preserves explicit ordering", async () => {
    const { env } = environment();
    for (let i = 0; i < 30; i++) expect((await handleTeamLibrary(request(save(String(i), null)), env)).status).toBe(200);
    expect((await handleTeamLibrary(request(save("overflow", null)), env)).status).toBe(409);
    const ids = Array.from({ length: 30 }, (_, i) => String(29 - i));
    expect((await handleTeamLibrary(request({ operation: "order", ids }), env)).status).toBe(200);
    const result = await (await handleTeamLibrary(request(), env)).json() as { teams: Array<{ id: string }> };
    expect(result.teams.map(t => t.id)).toEqual(ids);
  });
});
