/**
 * Neon Postgres sync backend for EduManage Desktop.
 * Replaces the Supabase Edge Function sync path.
 */
const { Pool } = require("pg");
const { config } = require("../utils/config.cjs");
const logger = require("../utils/logger.cjs");

let pool = null;
let schemaReady = false;

function normalizeConnectionString(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    // node-pg often fails with Neon channel_binding=require
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.get("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw.replace(/([&?])channel_binding=require&?/g, "$1").replace(/[?&]$/, "");
  }
}

function getPool() {
  if (pool) return pool;
  const connectionString = normalizeConnectionString(config.neonDatabaseUrl);
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL is not configured");
  }
  pool = new Pool({
    connectionString,
    // Verify TLS certificates (do not set rejectUnauthorized: false).
    ssl: { rejectUnauthorized: true },
    max: 4,
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", (err) => {
    logger.warn("Neon pool error", { message: err.message });
  });
  return pool;
}

async function ensureSchema() {
  if (schemaReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS desktop_sync_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entity text NOT NULL,
        entity_id text NOT NULL,
        school_id text,
        operation text NOT NULL DEFAULT 'upsert',
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        client_updated_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        synced_by text,
        CONSTRAINT desktop_sync_records_entity_id_unique UNIQUE (entity, entity_id)
      );

      CREATE INDEX IF NOT EXISTS idx_desktop_sync_records_school
        ON desktop_sync_records (school_id);

      CREATE INDEX IF NOT EXISTS idx_desktop_sync_records_updated
        ON desktop_sync_records (updated_at DESC);
    `);
    schemaReady = true;
  } finally {
    client.release();
  }
}

function parseTs(value) {
  if (!value) return 0;
  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : 0;
}

function remoteShape(row) {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {};
  return {
    ...payload,
    id: row.entity_id,
    updated_at: row.client_updated_at || row.updated_at,
    deleted_at: row.deleted_at,
    _sync_operation: row.operation,
  };
}

/**
 * Push one queue item to Neon with last-write-wins conflict detection.
 * @returns {{ conflict?: boolean, remote?: object, ok?: boolean }}
 */
async function pushRecord({ entity, entityId, operation, payload, clientUpdatedAt, syncedBy }) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT entity_id, payload, client_updated_at, updated_at, deleted_at, operation
       FROM desktop_sync_records
       WHERE entity = $1 AND entity_id = $2
       LIMIT 1`,
      [entity, entityId],
    );
    const existing = rows[0] || null;
    const clientTs = parseTs(clientUpdatedAt || payload?.updated_at);
    const remoteTs = parseTs(existing?.client_updated_at || existing?.updated_at);

    if (existing && remoteTs > clientTs) {
      return { conflict: true, remote: remoteShape(existing) };
    }

    const isDelete = String(operation || "").toLowerCase() === "delete";
    const schoolId =
      (typeof payload?.school_id === "string" && payload.school_id) || null;
    const nowIso = new Date().toISOString();

    await client.query(
      `INSERT INTO desktop_sync_records
         (entity, entity_id, school_id, operation, payload, client_updated_at, updated_at, deleted_at, synced_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
       ON CONFLICT (entity, entity_id) DO UPDATE SET
         school_id = EXCLUDED.school_id,
         operation = EXCLUDED.operation,
         payload = EXCLUDED.payload,
         client_updated_at = EXCLUDED.client_updated_at,
         updated_at = EXCLUDED.updated_at,
         deleted_at = EXCLUDED.deleted_at,
         synced_by = EXCLUDED.synced_by`,
      [
        entity,
        entityId,
        schoolId,
        isDelete ? "delete" : "upsert",
        JSON.stringify(payload || {}),
        clientUpdatedAt || payload?.updated_at || nowIso,
        nowIso,
        isDelete ? nowIso : null,
        syncedBy || null,
      ],
    );

    return { ok: true, conflict: false };
  } finally {
    client.release();
  }
}

async function ping() {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

async function close() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
    schemaReady = false;
  }
}

module.exports = {
  pushRecord,
  ensureSchema,
  ping,
  close,
  normalizeConnectionString,
};
