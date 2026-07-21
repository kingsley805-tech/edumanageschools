/**
 * Scheduled and on-demand SQLite backups with restore + compression.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const paths = require("../utils/paths.cjs");
const logger = require("../utils/logger.cjs");
const notifications = require("../utils/notifications.cjs");
const { getDatabasePath, getConnection, closeConnection } = require("./connection.cjs");
const { config } = require("../utils/config.cjs");

let backupTimer = null;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function createBackup({ compress = true, notify = true } = {}) {
  const src = getDatabasePath();
  if (!fs.existsSync(src)) {
    // Touch empty DB path directory; connection may be fallback
    getConnection();
  }

  const backupDir = paths.getBackupDir();
  const baseName = `school-hub-backup-${timestamp()}`;
  const rawDest = path.join(backupDir, `${baseName}.sqlite`);

  // Checkpoint WAL before copy when using sqlite
  try {
    const db = getConnection();
    if (typeof db.pragma === "function") db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* ignore */
  }

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, rawDest);
  } else {
    fs.writeFileSync(rawDest, "");
  }

  let finalPath = rawDest;
  if (compress) {
    finalPath = `${rawDest}.gz`;
    await pipeline(fs.createReadStream(rawDest), zlib.createGzip(), fs.createWriteStream(finalPath));
    fs.unlinkSync(rawDest);
  }

  logger.info("Backup created", { path: finalPath });
  if (notify) notifications.presets.backupCompleted();
  pruneOldBackups(20);
  return { path: finalPath, createdAt: new Date().toISOString() };
}

function pruneOldBackups(keep = 20) {
  const dir = paths.getBackupDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("school-hub-backup-"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(path.join(dir, file.name));
    } catch (err) {
      logger.warn("Failed pruning backup", { file: file.name, message: err.message });
    }
  }
}

async function restoreBackup(backupPath) {
  if (!backupPath || !fs.existsSync(backupPath)) {
    throw new Error("Backup file not found");
  }

  closeConnection();
  const dest = getDatabasePath();
  const tmp = `${dest}.restore-tmp`;

  if (backupPath.endsWith(".gz")) {
    await pipeline(fs.createReadStream(backupPath), zlib.createGunzip(), fs.createWriteStream(tmp));
    fs.renameSync(tmp, dest);
  } else {
    fs.copyFileSync(backupPath, dest);
  }

  getConnection();
  logger.info("Backup restored", { from: backupPath });
  return { restored: true, path: dest };
}

function listBackups() {
  const dir = paths.getBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("school-hub-backup-"))
    .map((f) => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { name: f, path: full, size: st.size, modifiedAt: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

function startScheduler() {
  stopScheduler();
  backupTimer = setInterval(() => {
    createBackup().catch((err) => logger.error("Scheduled backup failed", { message: err.message }));
  }, config.backupIntervalMs);
  if (backupTimer.unref) backupTimer.unref();
  logger.info("Backup scheduler started", { intervalMs: config.backupIntervalMs });
}

function stopScheduler() {
  if (backupTimer) clearInterval(backupTimer);
  backupTimer = null;
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  startScheduler,
  stopScheduler,
};
