import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types/index";
import {
  POKEPILOT_ANALYSIS_LEASE_MS,
  POKEPILOT_CLIENT_REQUEST_LIMIT,
  POKEPILOT_IP_REQUEST_LIMIT,
  POKEPILOT_MAX_ACCOUNT_ANALYSES,
  POKEPILOT_MAX_ACTIVE_ANALYSES,
  POKEPILOT_REQUEST_WINDOW_MS,
  type PokePilotRequester,
  type PokePilotRequestAdmissionDecision,
} from "../server/pokepilotOperations.js";

function validateIdentity(value: string) {
  if (typeof value !== "string" || !value || value.length > 256) throw new Error("Invalid analysis identity.");
}

function validateToken(value: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) {
    throw new Error("Invalid analysis token.");
  }
}

export class PokePilotAnalysisGate extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS requests (
      token TEXT PRIMARY KEY, client TEXT NOT NULL, ip TEXT NOT NULL, at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS requests_client ON requests(client, at);
    CREATE INDEX IF NOT EXISTS requests_ip ON requests(ip, at);
    CREATE INDEX IF NOT EXISTS requests_at ON requests(at);
    CREATE TABLE IF NOT EXISTS permits (
      token TEXT PRIMARY KEY, client TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS permits_client ON permits(client);
    CREATE INDEX IF NOT EXISTS permits_expires ON permits(expires);`);
  }

  async admit(requester: PokePilotRequester, token: string): Promise<PokePilotRequestAdmissionDecision> {
    validateIdentity(requester.clientId);
    validateIdentity(requester.ipHash);
    validateToken(token);
    const now = Date.now();
    const decision = this.ctx.storage.transactionSync((): PokePilotRequestAdmissionDecision => {
      this.prune(now);
      const existing = this.ctx.storage.sql.exec<{ client: string; ip: string }>(
        "SELECT client, ip FROM requests WHERE token = ?", token,
      ).toArray()[0];
      if (existing) {
        if (existing.client !== requester.clientId || existing.ip !== requester.ipHash) throw new Error("Analysis token owner changed.");
        return { allowed: true };
      }
      const clientRetry = this.retryAfter("client", requester.clientId, POKEPILOT_CLIENT_REQUEST_LIMIT, now);
      const ipRetry = this.retryAfter("ip", requester.ipHash, POKEPILOT_IP_REQUEST_LIMIT, now);
      if (clientRetry || ipRetry) {
        return clientRetry >= ipRetry
          ? { allowed: false, retryAfterMs: clientRetry, scope: "client" }
          : { allowed: false, retryAfterMs: ipRetry, scope: "ip" };
      }
      this.ctx.storage.sql.exec("INSERT INTO requests VALUES (?, ?, ?, ?)", token, requester.clientId, requester.ipHash, now);
      return { allowed: true };
    });
    await this.scheduleCleanup(now);
    return decision;
  }

  async acquire(requesterId: string, token: string): Promise<boolean> {
    validateIdentity(requesterId);
    validateToken(token);
    const now = Date.now();
    const acquired = this.ctx.storage.transactionSync(() => {
      this.prune(now);
      const existing = this.ctx.storage.sql.exec<{ client: string }>("SELECT client FROM permits WHERE token = ?", token).toArray()[0];
      if (existing) {
        if (existing.client !== requesterId) throw new Error("Analysis token owner changed.");
        return true;
      }
      const { total, own } = this.ctx.storage.sql.exec<{ total: number; own: number }>(
        "SELECT COUNT(*) AS total, COALESCE(SUM(client = ?), 0) AS own FROM permits", requesterId,
      ).one();
      if (own >= POKEPILOT_MAX_ACCOUNT_ANALYSES || total >= POKEPILOT_MAX_ACTIVE_ANALYSES) return false;
      this.ctx.storage.sql.exec("INSERT INTO permits VALUES (?, ?, ?)", token, requesterId, now + POKEPILOT_ANALYSIS_LEASE_MS);
      return true;
    });
    await this.scheduleCleanup(now);
    return acquired;
  }

  release(token: string): void {
    validateToken(token);
    this.ctx.storage.sql.exec("DELETE FROM permits WHERE token = ?", token);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    this.prune(now);
    const { next } = this.ctx.storage.sql.exec<{ next: number | null }>(`SELECT MIN(expiry) AS next FROM (
      SELECT MIN(at) + ? AS expiry FROM requests UNION ALL SELECT MIN(expires) FROM permits
    )`, POKEPILOT_REQUEST_WINDOW_MS).one();
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(now + 1_000, next));
  }

  private prune(now: number) {
    this.ctx.storage.sql.exec("DELETE FROM requests WHERE at <= ?", now - POKEPILOT_REQUEST_WINDOW_MS);
    this.ctx.storage.sql.exec("DELETE FROM permits WHERE expires <= ?", now);
  }

  private retryAfter(column: "client" | "ip", identity: string, limit: number, now: number) {
    const { count, oldest } = this.ctx.storage.sql.exec<{ count: number; oldest: number | null }>(
      `SELECT COUNT(*) AS count, MIN(at) AS oldest FROM requests WHERE ${column} = ?`, identity,
    ).one();
    return count < limit ? 0 : Math.max(1, (oldest ?? now) + POKEPILOT_REQUEST_WINDOW_MS - now);
  }

  private async scheduleCleanup(now: number) {
    // Each request prunes first. After traffic stops, an alarm removes the remaining rows.
    await this.ctx.storage.setAlarm(now + POKEPILOT_REQUEST_WINDOW_MS);
  }
}
