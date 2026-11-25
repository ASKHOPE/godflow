import { createClient } from "@libsql/client";
import { createInitialSeed } from "../data/seed.js";

const SCHEMA_VERSION = "12";

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
  "broadcasts",
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
  "auditLog",
  "roleHistory"
];

function extractDomainData(rawState) {
  const out = {};
  for (const k of DOMAIN_KEYS) {
    if (k in rawState) out[k] = rawState[k];
  }
  return out;
}

function summarizeCounts(domain) {
  return {
    platformAccounts: (domain.users ?? []).filter((u) => u.userScope === "platform").length,
    tenants: (domain.workspaces ?? []).length,
    channels: (domain.workspaces ?? []).reduce((s, w) => s + (w.channels?.length ?? 0), 0),
    tenantUsers: (domain.users ?? []).filter((u) => u.userScope !== "platform").length,
    workEvents: (domain.workEvents ?? []).length,
    pipelineItems: (domain.pipelineItems ?? []).length,
    suiteModules: (domain.platformData?.suiteModules ?? []).length,
    podcastScripts: domain.workbenchData?.podcastScript ? 1 : 0
  };
}

function getTursoClient() {
  const url = process.env.TURSO_DATABASE_URL || "libsql://gfsql-askhope.aws-ap-south-1.turso.io";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!authToken) return null;
  return createClient({ url, authToken });
}

async function ensureTursoReady(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const existing = await client.execute("SELECT schema_version, state_json FROM app_snapshot WHERE id = 1");
  const row = existing.rows?.[0];
  if (row && row.schema_version === SCHEMA_VERSION && row.state_json) {
    return;
  }

  const now = new Date().toISOString();
  const initial = extractDomainData(createInitialSeed());
  await client.execute({
    sql: `INSERT INTO app_snapshot (id, schema_version, state_json, updated_at)
          VALUES (1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, state_json = excluded.state_json, updated_at = excluded.updated_at`,
    args: [SCHEMA_VERSION, JSON.stringify(initial), now]
  });
  await client.execute({
    sql: `INSERT INTO db_meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [SCHEMA_VERSION]
  });
  await client.execute({
    sql: `INSERT INTO db_meta (key, value) VALUES ('seeded_at', ?) ON CONFLICT(key) DO NOTHING`,
    args: [now]
  });
}

export async function handleDbApi({ action, method, body }) {
  const turso = getTursoClient();

  if (!turso) {
    const { GodFlowSqliteStore } = await import("./sqlite-db.js");
    const store = new GodFlowSqliteStore();
    if (method === "GET" && action === "health") {
      return { status: 200, data: { ok: true, ...store.getHealth() } };
    }
    if (method === "GET" && action === "state") {
      const { state, meta } = store.readState();
      return { status: 200, data: { ok: true, state, ...meta } };
    }
    if ((method === "PUT" || method === "POST") && action === "state") {
      if (!body?.state || typeof body.state !== "object") {
        return { status: 400, data: { ok: false, error: "Missing state payload" } };
      }
      const meta = store.saveState(body.state);
      return { status: 200, data: { ok: true, ...meta } };
    }
    if (method === "POST" && action === "reset") {
      const { state, meta } = store.resetToInitialSeed();
      return { status: 200, data: { ok: true, state, ...meta } };
    }
    return { status: 404, data: { ok: false, error: "Unknown DB route" } };
  }

  await ensureTursoReady(turso);

  if (method === "GET" && action === "health") {
    const snapRes = await turso.execute("SELECT state_json, updated_at FROM app_snapshot WHERE id = 1");
    const row = snapRes.rows?.[0];
    const parsed = row?.state_json ? JSON.parse(String(row.state_json)) : {};
    return {
      status: 200,
      data: {
        ok: true,
        connected: true,
        engine: "Turso libSQL (Cloud SQLite)",
        dbPath: process.env.TURSO_DATABASE_URL || "libsql://gfsql-askhope.aws-ap-south-1.turso.io",
        schemaVersion: SCHEMA_VERSION,
        updatedAt: row?.updated_at || null,
        counts: summarizeCounts(parsed)
      }
    };
  }

  if (method === "GET" && action === "state") {
    const snapRes = await turso.execute("SELECT state_json, updated_at FROM app_snapshot WHERE id = 1");
    const row = snapRes.rows?.[0];
    const parsed = row?.state_json ? JSON.parse(String(row.state_json)) : extractDomainData(createInitialSeed());
    return {
      status: 200,
      data: {
        ok: true,
        connected: true,
        engine: "Turso libSQL (Cloud SQLite)",
        schemaVersion: SCHEMA_VERSION,
        updatedAt: row?.updated_at || null,
        counts: summarizeCounts(parsed),
        state: parsed
      }
    };
  }

  if ((method === "PUT" || method === "POST") && action === "state") {
    if (!body?.state || typeof body.state !== "object") {
      return { status: 400, data: { ok: false, error: "Missing state payload" } };
    }
    const clean = extractDomainData(body.state);
    const now = new Date().toISOString();
    await turso.execute({
      sql: `INSERT INTO app_snapshot (id, schema_version, state_json, updated_at)
            VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, state_json = excluded.state_json, updated_at = excluded.updated_at`,
      args: [SCHEMA_VERSION, JSON.stringify(clean), now]
    });
    return {
      status: 200,
      data: {
        ok: true,
        connected: true,
        engine: "Turso libSQL (Cloud SQLite)",
        schemaVersion: SCHEMA_VERSION,
        updatedAt: now,
        counts: summarizeCounts(clean)
      }
    };
  }

  if (method === "POST" && action === "reset") {
    const initial = extractDomainData(createInitialSeed());
    const now = new Date().toISOString();
    await turso.execute({
      sql: `INSERT INTO app_snapshot (id, schema_version, state_json, updated_at)
            VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, state_json = excluded.state_json, updated_at = excluded.updated_at`,
      args: [SCHEMA_VERSION, JSON.stringify(initial), now]
    });
    return {
      status: 200,
      data: {
        ok: true,
        connected: true,
        engine: "Turso libSQL (Cloud SQLite)",
        schemaVersion: SCHEMA_VERSION,
        updatedAt: now,
        counts: summarizeCounts(initial),
        state: initial
      }
    };
  }

  return { status: 404, data: { ok: false, error: "Unknown DB route" } };
}
