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

      const cols = Object.keys(row);
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

module.exports = { createModel, nowIso, newId };
