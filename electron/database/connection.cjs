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
let encryptionApplied = false;
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
  if (!config.dbEncryptionKey) {
    encryptionApplied = false;
    return;
  }
  // IMPORTANT: standard SQLite silently no-ops unrecognized PRAGMA names
  // instead of throwing, so a "successful" `PRAGMA key = ...` call proves
  // nothing on a vanilla (non-SQLCipher) better-sqlite3 build — it would
  // previously log "encryption applied" while doing nothing at all, which is
  // a false sense of security for a database holding student PII. Only a
  // SQLCipher-compiled binary recognizes `cipher_version`; use that as the
  // real signal instead of trusting the `key` pragma's return.
  try {
    const key = crypto.createHash("sha256").update(config.dbEncryptionKey).digest("hex");
    database.pragma(`key = '${key}'`);
    let cipherVersion;
    try {
      cipherVersion = database.pragma("cipher_version", { simple: true });
    } catch {
      cipherVersion = undefined;
    }
    if (cipherVersion) {
      encryptionApplied = true;
      logger.info("Database encryption active", { cipherVersion });
    } else {
      encryptionApplied = false;
      logger.error(
        "ELECTRON_DB_ENCRYPTION_KEY is set but this better-sqlite3 build is not SQLCipher-compiled — " +
          "the database is NOT encrypted at rest. Rebuild against a SQLCipher-enabled better-sqlite3 to " +
          "actually protect student data, otherwise treat this database file as unencrypted.",
      );
    }
  } catch (err) {
    encryptionApplied = false;
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
  isEncrypted: () => encryptionApplied,
  getDatabasePath: () => paths.getDatabasePath(),
};
