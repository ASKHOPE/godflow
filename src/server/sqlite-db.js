import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInitialSeed } from "../data/seed.js";

export const SCHEMA_VERSION = "14";
export const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "godflow.sqlite");

const DOMAIN_KEYS = [
  "platformData",
  "workspaces",
  "users",
  "infraServices",
  "bullQueues",
  "failedJobs",
  "workflowsToday",
  "pipelineItems",
  "content",
  "socialQueue",
  "channelStatuses",
  "shortLinks",
  "sponsors",
  "invoices",
  "ledgerEntries",
  "automationEvents",
  "workEvents",
  "activeWatchers",
  "watcherConfig",
  "workbenchData",
  "auditLog"
];

export function extractDomainData(fullState) {
  const out = {};
  for (const key of DOMAIN_KEYS) {
    if (key in fullState) {
      out[key] = fullState[key];
    }
  }
  return out;
}

/**
 * Embedded SQLite (node:sqlite DatabaseSync) repository for persistent multi-tenant state.
 * Seeds ONCE when empty or older than SCHEMA_VERSION; reuses saved DB across reloads & restarts.
 */
export class GodFlowSqliteStore {
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
    this.ensureSeeded();
  }

  initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS db_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version TEXT NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS platform_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        default_role_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        plan TEXT NOT NULL,
        monthly_price_usd INTEGER NOT NULL,
        status TEXT NOT NULL,
        seat_limit INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        capabilities_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_users (
        id TEXT PRIMARY KEY,
        workspace_ids_json TEXT NOT NULL,
        channel_ids_json TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        title TEXT NOT NULL,
        default_role_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS work_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        scenario TEXT NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        start_hour REAL NOT NULL,
        duration_hours REAL NOT NULL,
        tracked_seconds INTEGER NOT NULL,
        status TEXT NOT NULL,
        tool TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pipeline_items (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        channel_id TEXT,
        owner_user_id TEXT,
        title TEXT NOT NULL,
        scenario TEXT NOT NULL,
        stage TEXT NOT NULL,
        due_date TEXT
      );

      CREATE TABLE IF NOT EXISTS suite_modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        exp_version TEXT NOT NULL,
        cur_version TEXT NOT NULL,
        lts_version TEXT NOT NULL,
        globally_enabled INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS podcast_scripts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        channel_id TEXT,
        title TEXT NOT NULL,
        episode_number INTEGER,
        html TEXT NOT NULL,
        segments_json TEXT NOT NULL,
        live_config_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS team_assignments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        scenario TEXT,
        user_id TEXT NOT NULL,
        unit TEXT NOT NULL,
        sub_role TEXT,
        is_lead INTEGER NOT NULL
      );
    `);
  }

  _getMeta(key) {
    const row = this.db.prepare("SELECT value FROM db_meta WHERE key = ?").get(key);
    return row ? row.value : null;
  }

  _setMeta(key, value, now) {
    this.db
      .prepare(
        "INSERT INTO db_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      )
      .run(key, String(value), now);
  }

  ensureSeeded() {
    const existingVer = this._getMeta("schema_version");
    const snap = this.db.prepare("SELECT state_json FROM app_snapshot WHERE id = 1").get();
    if (existingVer === SCHEMA_VERSION && snap?.state_json) {
      return false; // Already seeded & up to date — do NOT seed again!
    }
    const seedCountPrev = Number(this._getMeta("seed_count") || "0");
    const seed = extractDomainData(createInitialSeed());
    this._writeSnapshotTransaction(seed, { markSeeded: true, seedCount: seedCountPrev + 1 });
    return true;
  }

  _writeSnapshotTransaction(domainState, { markSeeded = false, seedCount = null } = {}) {
    const now = new Date().toISOString();
    const json = JSON.stringify(domainState);

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO app_snapshot (id, schema_version, state_json, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, state_json = excluded.state_json, updated_at = excluded.updated_at"
        )
        .run(SCHEMA_VERSION, json, now);

      this._syncRelationalTables(domainState, now);

      this._setMeta("schema_version", SCHEMA_VERSION, now);
      if (markSeeded) {
        this._setMeta("seeded_at", now, now);
        this._setMeta("seed_count", String(seedCount ?? 1), now);
      }
      const prevSaves = Number(this._getMeta("save_count") || "0");
      this._setMeta("save_count", String(markSeeded ? prevSaves : prevSaves + 1), now);
      this._setMeta("last_saved_at", now, now);

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  _syncRelationalTables(st, now) {
    this.db.exec(`
      DELETE FROM platform_accounts;
      DELETE FROM tenants;
      DELETE FROM channels;
      DELETE FROM tenant_users;
      DELETE FROM work_events;
      DELETE FROM pipeline_items;
      DELETE FROM suite_modules;
      DELETE FROM podcast_scripts;
      DELETE FROM team_assignments;
    `);

    const insPlat = this.db.prepare(
      "INSERT INTO platform_accounts (id, name, email, default_role_id) VALUES (?, ?, ?, ?)"
    );
    const insUser = this.db.prepare(
      "INSERT INTO tenant_users (id, workspace_ids_json, channel_ids_json, name, email, title, default_role_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const u of st.users ?? []) {
      if (u.userScope === "platform") {
        insPlat.run(u.id, u.name, u.email || "", u.defaultRoleId || "ultimate_maintenance");
      } else {
        insUser.run(
          u.id,
          JSON.stringify(u.workspaceIds ?? []),
          JSON.stringify(u.channelIds ?? []),
          u.name,
          u.email || "",
          u.title || "",
          u.defaultRoleId || "editor_newsletter"
        );
      }
    }

    const insTenant = this.db.prepare(
      "INSERT INTO tenants (id, name, domain, plan, monthly_price_usd, status, seat_limit) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const insChan = this.db.prepare(
      "INSERT INTO channels (id, workspace_id, name, domain, capabilities_json) VALUES (?, ?, ?, ?, ?)"
    );
    for (const ws of st.workspaces ?? []) {
      insTenant.run(
        ws.id,
        ws.name,
        ws.domain,
        ws.plan || "Growth",
        Number(ws.monthlyPriceUsd || 0),
        ws.subscriptionStatus || "Active",
        Number(ws.seatLimit || 10)
      );
      for (const ch of ws.channels ?? []) {
        insChan.run(ch.id, ws.id, ch.name, ch.domain || "", JSON.stringify(ch.capabilities ?? []));
      }
    }

    const insEvent = this.db.prepare(
      "INSERT INTO work_events (id, workspace_id, user_id, scenario, title, date, start_hour, duration_hours, tracked_seconds, status, tool) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const ev of st.workEvents ?? []) {
      insEvent.run(
        ev.id,
        ev.workspaceId || "",
        ev.userId || "",
        ev.scenario || "article",
        ev.title || "",
        ev.date || "",
        Number(ev.startHour || 9),
        Number(ev.durationHours || 1),
        Number(ev.trackedSeconds || 0),
        ev.status || "Completed",
        ev.tool || ""
      );
    }

    const insPipe = this.db.prepare(
      "INSERT INTO pipeline_items (id, workspace_id, channel_id, owner_user_id, title, scenario, stage, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const p of st.pipelineItems ?? []) {
      insPipe.run(
        p.id,
        p.workspaceId || "",
        p.channelId || null,
        p.ownerUserId || null,
        p.title || "",
        p.scenario || "article",
        p.stage || "idea",
        p.dueDate || null
      );
    }

    const insMod = this.db.prepare(
      "INSERT INTO suite_modules (id, name, exp_version, cur_version, lts_version, globally_enabled) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const m of st.platformData?.suiteModules ?? []) {
      insMod.run(
        m.id,
        m.name,
        m.versions?.experimental?.version || "0.0.0",
        m.versions?.current?.version || "0.0.0",
        m.versions?.lts?.version || "0.0.0",
        m.enabledGlobally !== false ? 1 : 0
      );
    }

    const ps = st.workbenchData?.podcastScript;
    const pl = st.workbenchData?.podcastLiveConfig;
    if (ps) {
      this.db
        .prepare(
          "INSERT INTO podcast_scripts (id, workspace_id, channel_id, title, episode_number, html, segments_json, live_config_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          "active-podcast-script",
          st.workspaces?.[0]?.id || "ws-godflow",
          ps.channelId || null,
          ps.episodeTitle || ps.title || "",
          Number(ps.episodeNumber || 1),
          ps.html || "",
          JSON.stringify(ps.segments ?? []),
          JSON.stringify(pl ?? {}),
          now
        );
    }

    const insTeamAssign = this.db.prepare(
      "INSERT INTO team_assignments (id, workspace_id, team_id, team_name, scenario, user_id, unit, sub_role, is_lead) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const ws of st.workspaces ?? []) {
      for (const tm of ws.teams ?? []) {
        const list = Array.isArray(tm.assignments) && tm.assignments.length
          ? tm.assignments
          : (tm.memberIds ?? []).map((uid) => ({ userId: uid, unit: uid === tm.leadUserId ? "Team Lead" : "Content Team", subRole: "" }));
        for (const a of list) {
          const isLead = a.userId === tm.leadUserId || a.unit === "Team Lead" ? 1 : 0;
          insTeamAssign.run(
            `${tm.id}:${a.userId}`,
            ws.id,
            tm.id,
            tm.name || tm.id,
            tm.scenario || "article",
            a.userId,
            a.unit || "Content Team",
            a.subRole || "",
            isLead
          );
        }
      }
    }
  }

  readState() {
    this.ensureSeeded();
    const row = this.db.prepare("SELECT state_json, updated_at FROM app_snapshot WHERE id = 1").get();
    const parsed = JSON.parse(row.state_json);
    return {
      state: parsed,
      meta: this.getHealth()
    };
  }

  saveState(nextDomainState) {
    if (!nextDomainState || !Array.isArray(nextDomainState.workspaces) || !Array.isArray(nextDomainState.users)) {
      throw new Error("Invalid domain state payload for SQLite persistence.");
    }
    const clean = extractDomainData(nextDomainState);
    this._writeSnapshotTransaction(clean, { markSeeded: false });
    return this.getHealth();
  }

  resetToSeed() {
    const seedCountPrev = Number(this._getMeta("seed_count") || "0");
    const fresh = extractDomainData(createInitialSeed());
    this._writeSnapshotTransaction(fresh, { markSeeded: true, seedCount: seedCountPrev + 1 });
    return {
      state: fresh,
      meta: this.getHealth()
    };
  }

  getHealth() {
    const countOf = (table) => this.db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
    let dbSizeBytes = 0;
    if (this.dbPath !== ":memory:" && fs.existsSync(this.dbPath)) {
      dbSizeBytes = fs.statSync(this.dbPath).size;
    }
    return {
      connected: true,
      engine: "node:sqlite (DatabaseSync WAL)",
      dbPath: this.dbPath === ":memory:" ? ":memory:" : path.relative(process.cwd(), this.dbPath),
      schemaVersion: this._getMeta("schema_version") || SCHEMA_VERSION,
      seededAt: this._getMeta("seeded_at"),
      seedCount: Number(this._getMeta("seed_count") || "1"),
      saveCount: Number(this._getMeta("save_count") || "0"),
      updatedAt: this._getMeta("last_saved_at"),
      dbSizeBytes,
      counts: {
        platformAccounts: countOf("platform_accounts"),
        tenants: countOf("tenants"),
        channels: countOf("channels"),
        tenantUsers: countOf("tenant_users"),
        workEvents: countOf("work_events"),
        pipelineItems: countOf("pipeline_items"),
        suiteModules: countOf("suite_modules"),
        podcastScripts: countOf("podcast_scripts"),
        teamAssignments: countOf("team_assignments")
      }
    };
  }

  close() {
    this.db.close();
  }
}

let singletonStore = null;

export function getSqliteStore() {
  if (!singletonStore) {
    singletonStore = new GodFlowSqliteStore();
  }
  return singletonStore;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Payload too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function handleSqliteApiRequest(req, res) {
  const pathname = (req.url || "").split("?")[0];
  try {
    const db = getSqliteStore();

    if (pathname === "/api/db/health" && req.method === "GET") {
      sendJson(res, 200, { ok: true, ...db.getHealth() });
      return;
    }

    if (pathname === "/api/db/state" && req.method === "GET") {
      const { state, meta } = db.readState();
      sendJson(res, 200, { ok: true, ...meta, state });
      return;
    }

    if (pathname === "/api/db/state" && (req.method === "PUT" || req.method === "POST")) {
      const raw = await readRequestBody(req);
      const parsed = JSON.parse(raw || "{}");
      const nextState = parsed.state ?? parsed;
      const meta = db.saveState(nextState);
      sendJson(res, 200, { ok: true, ...meta });
      return;
    }

    if (pathname === "/api/db/reset" && req.method === "POST") {
      const { state, meta } = db.resetToSeed();
      sendJson(res, 200, { ok: true, ...meta, state });
      return;
    }

    sendJson(res, 404, { ok: false, error: `Unknown DB endpoint: ${req.method} ${pathname}` });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err?.message || "SQLite persistence error" });
  }
}
