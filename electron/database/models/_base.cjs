/**
 * Generic local entity repository with sync-queue enqueueing.
 */
const crypto = require("crypto");
const { getConnection } = require("../connection.cjs");

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

// Column names arrive as Object.keys(record) straight from renderer IPC
// payloads (e.g. bulk CSV import), then get string-joined into SQL. Without
// whitelisting against the real schema, a crafted object key becomes a raw
// SQL injection vector. Cache each table's real columns via PRAGMA and drop
// anything that isn't one.
const columnCache = new Map();

function getValidColumns(db, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = new Set(rows.map((r) => r.name));
  columnCache.set(tableName, cols);
  return cols;
}

function createModel(tableName, entityName) {
  return {
    tableName,
    entityName,

    list({ schoolId, limit = 500, offset = 0 } = {}) {
      const db = getConnection();
      if (schoolId) {
        return db
          .prepare(
            `SELECT * FROM ${tableName} WHERE deleted_at IS NULL AND school_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
          )
          .all(schoolId, limit, offset);
      }
      return db
        .prepare(
          `SELECT * FROM ${tableName} WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
        )
        .all(limit, offset);
    },

    getById(id) {
      const db = getConnection();
      return db
        .prepare(`SELECT * FROM ${tableName} WHERE id = ? AND deleted_at IS NULL`)
        .get(id);
    },

    upsert(record, { enqueueSync = true, operation = "upsert" } = {}) {
      const db = getConnection();
      const id = record.id || newId();
      const updatedAt = record.updated_at || nowIso();
      const row = { ...record, id, updated_at: updatedAt, synced_at: record.synced_at || null };

      // Whitelist against the real table schema — see getValidColumns() above.
      // Silently dropping unknown keys (rather than failing the whole write)
      // keeps this tolerant of extra fields callers stash on `record` for
      // their own bookkeeping (e.g. UI-only flags) while closing the
      // injection vector.
      const validColumns = getValidColumns(db, tableName);
      const cols = Object.keys(row).filter((c) => validColumns.has(c));
      if (!cols.includes("id")) cols.push("id");

      const placeholders = cols.map(() => "?").join(", ");
      const updates = cols
        .filter((c) => c !== "id")
        .map((c) => `${c} = excluded.${c}`)
        .join(", ");

      db.prepare(
        `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
      ).run(...cols.map((c) => row[c]));

      if (enqueueSync) {
        this.enqueue(operation, id, row);
      }
      return this.getById(id);
    },

    softDelete(id, { enqueueSync = true } = {}) {
      const db = getConnection();
      db.prepare(
        `UPDATE ${tableName} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      ).run(nowIso(), nowIso(), id);
      if (enqueueSync) this.enqueue("delete", id, { id });
      return { id };
    },

    enqueue(operation, entityId, payload) {
      const db = getConnection();
      db.prepare(
        `INSERT INTO sync_queue (entity, entity_id, operation, payload) VALUES (?, ?, ?, ?)`,
      ).run(entityName, String(entityId), operation, JSON.stringify(payload || {}));
    },

    markSynced(id) {
      const db = getConnection();
      db.prepare(`UPDATE ${tableName} SET synced_at = ? WHERE id = ?`).run(nowIso(), id);
    },
  };
}

/**
 * Writes a server-authoritative record straight into a local table without
 * enqueueing it back onto the sync_queue (it already IS synced — it just
 * came from the server). Used by database/sync.cjs when conflict resolution
 * picks the remote copy, so the local row actually reflects the resolution
 * instead of the conflict being silently discarded while the queue item
 * still gets marked "synced".
 */
function applyRemoteRecord(tableName, remoteRecord) {
  if (!remoteRecord || !remoteRecord.id) return null;
  const db = getConnection();
  const validColumns = getValidColumns(db, tableName);
  const row = { ...remoteRecord, synced_at: nowIso() };
  const cols = Object.keys(row).filter((c) => validColumns.has(c));
  if (!cols.includes("id")) cols.push("id");

  const placeholders = cols.map(() => "?").join(", ");
  const updates = cols
    .filter((c) => c !== "id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");

  db.prepare(
    `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  ).run(...cols.map((c) => row[c]));

  return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(remoteRecord.id);
}

module.exports = { createModel, nowIso, newId, applyRemoteRecord };
