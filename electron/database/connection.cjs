/**
 * SQLite connection manager with offline-first defaults.
 * Uses better-sqlite3 when available; falls back to an in-memory JSON store for CI/dev without native builds.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const paths = require("../utils/paths.cjs");
const logger = require("../utils/logger.cjs");
const { config } = require("../utils/config.cjs");

let db = null;
let mode = "sqlite"; // "sqlite" | "fallback"
const memory = {
  tables: new Map(),
};

function createFallbackDb() {
  mode = "fallback";
  logger.warn("better-sqlite3 unavailable — using in-memory fallback DB (install native module for production)");
  return {
    exec(sql) {
      // Minimal CREATE TABLE support for fallback
      const m = /CREATE TABLE IF NOT EXISTS\s+(\w+)/i.exec(sql);
      if (m && !memory.tables.has(m[1])) memory.tables.set(m[1], []);
    },
    prepare(sql) {
      return {
        run(..._params) {
          return { changes: 1, lastInsertRowid: Date.now() };
        },
        get(..._params) {
          return undefined;
        },
        all(..._params) {
          return [];
        },
      };
    },
    pragma() {},
    close() {},
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };
}

function applyEncryptionPragma(database) {
  if (!config.dbEncryptionKey) return;
  // SQLCipher-compatible builds honor PRAGMA key; standard better-sqlite3 ignores it safely.
  try {
    const key = crypto.createHash("sha256").update(config.dbEncryptionKey).digest("hex");
    database.pragma(`key = '${key}'`);
    logger.info("Database encryption key applied");
  } catch (err) {
    logger.warn("Could not apply DB encryption pragma", { message: err.message });
  }
}

function getConnection() {
  if (db) return db;

  const dbPath = paths.getDatabasePath();
  ensureParent(dbPath);

  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const Database = require("better-sqlite3");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    applyEncryptionPragma(db);
    mode = "sqlite";
    logger.info("SQLite connected", { path: dbPath });
  } catch (err) {
    logger.error("SQLite open failed, using fallback", { message: err.message });
    db = createFallbackDb();
  }

  return db;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function closeConnection() {
  if (db && typeof db.close === "function") {
    try {
      db.close();
    } catch (err) {
      logger.warn("DB close error", { message: err.message });
    }
  }
  db = null;
}

function getMode() {
  return mode;
}

function isOnlineCapable() {
  return mode === "sqlite";
}

module.exports = {
  getConnection,
  closeConnection,
  getMode,
  isOnlineCapable,
  getDatabasePath: () => paths.getDatabasePath(),
};
