import { readAccountSession } from "./accountAuth.js";
import { isSameOrigin, jsonResponse, withSessionRefresh } from "./http.js";
import type { WorkerEnvironment } from "./env.js";

type Row = { storage_key: string; payload: string; updated_at: number };
const marker = "teams-v2";
const orderKey = "team-order";

// This transaction runs once per account. Keep the old payload as a migration backup.
async function migrate(db: D1Database, accountId: string) {
  if (await db.prepare("SELECT 1 FROM account_storage WHERE account_id = ? AND storage_key = ?")
    .bind(accountId, marker).first()) return;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO account_storage (account_id, storage_key, payload, updated_at)
      SELECT s.account_id, 'team:' || json_extract(j.value, '$.id'), j.value, s.updated_at
      FROM account_storage s, json_each(CASE WHEN json_valid(s.payload) THEN s.payload ELSE '[]' END) j
      WHERE s.account_id = ? AND s.storage_key = 'teams' AND j.type = 'object'
        AND json_type(j.value, '$.id') = 'text' AND json_type(j.value, '$.slots') = 'array'
        AND NOT EXISTS (SELECT 1 FROM account_storage WHERE account_id = ? AND storage_key = 'teams-v2')`)
      .bind(accountId, accountId),
    db.prepare(`INSERT OR IGNORE INTO account_storage (account_id, storage_key, payload, updated_at)
      SELECT ?, 'team-order', COALESCE((SELECT json_group_array(json_extract(j.value, '$.id'))
        FROM account_storage s, json_each(CASE WHEN json_valid(s.payload) THEN s.payload ELSE '[]' END) j
        WHERE s.account_id = ? AND s.storage_key = 'teams' AND j.type = 'object'
          AND json_type(j.value, '$.id') = 'text'), '[]'), ?`)
      .bind(accountId, accountId, Date.now()),
    db.prepare("INSERT OR IGNORE INTO account_storage (account_id, storage_key, payload, updated_at) VALUES (?, ?, 'true', ?)")
      .bind(accountId, marker, Date.now()),
  ]);
}

export async function handleTeamLibrary(request: Request, env: WorkerEnvironment) {
  const session = await readAccountSession(request, env);
  if (!session) return jsonResponse(401, { error: { code: "AUTH_REQUIRED" } });
  const id = session.account.id;
  if (request.headers.get("X-PokePilot-Account-Id") !== id) {
    return jsonResponse(403, { error: { code: "ACCOUNT_SESSION_CHANGED" } });
  }
  if (request.method !== "GET" && request.method !== "PUT") return jsonResponse(405, {});
  if (request.method === "PUT" && !isSameOrigin(request)) return jsonResponse(403, {});
  await migrate(env.DB, id);
  const reply = (status: number, body: unknown) => withSessionRefresh(jsonResponse(status, body), session.refreshCookie);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`SELECT storage_key, payload, updated_at FROM account_storage
      WHERE account_id = ? AND (storage_key LIKE 'team:%' OR storage_key = 'team-order')`)
      .bind(id).run<Row>();
    const records = rows.results ?? [];
    const order: string[] = JSON.parse(records.find(r => r.storage_key === orderKey)?.payload ?? "[]");
    const teams = records.filter(r => r.storage_key.startsWith("team:")).map(r => ({
      ...JSON.parse(r.payload) as { id: string; createdAt?: string }, revision: String(r.updated_at),
    }));
    const rank = (teamId: string) => order.indexOf(teamId);
    teams.sort((a, b) => rank(a.id) - rank(b.id) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.id.localeCompare(b.id));
    return reply(200, { teams });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return reply(400, {});
  if (body.operation === "order") {
    if (!Array.isArray(body.ids) || body.ids.length > 30 || body.ids.some(v => typeof v !== "string")) return reply(400, {});
    await env.DB.prepare(`INSERT INTO account_storage (account_id, storage_key, payload, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, storage_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
      .bind(id, orderKey, JSON.stringify(body.ids), Date.now()).run();
    return reply(200, { ok: true });
  }
  if (typeof body.id !== "string" || !body.id || body.id.length > 128 ||
      (body.revision !== null && (typeof body.revision !== "string" || !/^\d+$/.test(body.revision)))) return reply(400, {});
  const key = `team:${body.id}`;
  const revision = body.revision as string | null;
  if (body.operation === "delete") {
    if (revision === null) return reply(400, {});
    const result = await env.DB.prepare("DELETE FROM account_storage WHERE account_id = ? AND storage_key = ? AND updated_at = ?")
      .bind(id, key, Number(revision)).run();
    const changed = (result as { meta?: { changes?: number } }).meta?.changes === 1;
    return reply(changed ? 200 : 409, { ok: changed });
  }
  const team = body.team as Record<string, unknown> | null;
  if (body.operation !== "save" || !team || team.id !== body.id || typeof team.name !== "string" ||
      !team.name.trim() || !Array.isArray(team.slots) || team.slots.length !== 6) return reply(400, {});
  const { revision: _revision, ...payloadTeam } = team;
  void _revision;
  const payload = JSON.stringify(payloadTeam);
  if (new TextEncoder().encode(payload).length > 50_000) return reply(413, {});
  const updatedAt = Math.max(Date.now(), Number(revision ?? 0) + 1);
  const statement = revision === null
    ? env.DB.prepare(`INSERT OR IGNORE INTO account_storage (account_id, storage_key, payload, updated_at)
        SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM account_storage WHERE account_id = ? AND storage_key LIKE 'team:%') < 30`)
        .bind(id, key, payload, updatedAt, id)
    : env.DB.prepare("UPDATE account_storage SET payload = ?, updated_at = ? WHERE account_id = ? AND storage_key = ? AND updated_at = ?")
        .bind(payload, updatedAt, id, key, Number(revision));
  const result = await statement.run();
  if ((result as { meta?: { changes?: number } }).meta?.changes !== 1) return reply(409, { error: { code: "TEAM_CHANGED_OR_LIMIT" } });
  return reply(200, { team: { ...payloadTeam, revision: String(updatedAt) } });
}
