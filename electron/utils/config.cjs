/**
 * Desktop runtime configuration (env + defaults).
 * Neon Postgres sync is available but currently disabled (comment NEON_DATABASE_URL).
 */
const fs = require("fs");
const path = require("path");

/**
 * Load project `.env` into process.env without requiring the dotenv package.
 * Existing process.env values win (so CLI / CI overrides still work).
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const projectRoot = path.join(__dirname, "..", "..");
loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"));

// Neon sync currently unused — leave NEON_DATABASE_URL commented in .env.
const neonDatabaseUrl = (
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  ""
).trim();

/** Legacy HTTP sync gateway (unused when Neon is configured). */
const syncApiUrl = (
  process.env.ELECTRON_SYNC_API_URL ||
  process.env.VITE_SYNC_API_URL ||
  ""
).trim();

const forceOffline =
  process.env.ELECTRON_FORCE_OFFLINE === "1" ||
  String(process.env.ELECTRON_FORCE_OFFLINE || "").toLowerCase() === "true";

const config = {
  appName: "EduManage Desktop",
  minWidth: 1100,
  minHeight: 700,
  defaultWidth: 1440,
  defaultHeight: 900,
  neonDatabaseUrl,
  syncApiUrl,
  forceOffline,
  syncIntervalMs: Number(process.env.ELECTRON_SYNC_INTERVAL_MS || 60_000),
  backupIntervalMs: Number(process.env.ELECTRON_BACKUP_INTERVAL_MS || 6 * 60 * 60 * 1000),
  notificationPollMs: Number(process.env.ELECTRON_NOTIFY_POLL_MS || 120_000),
  dbEncryptionKey: process.env.ELECTRON_DB_ENCRYPTION_KEY || "",
  updateFeedUrl: process.env.ELECTRON_UPDATE_FEED_URL || "",
  isDev: process.env.ELECTRON_DEV === "1" || process.env.NODE_ENV === "development",
  viteDevUrl: process.env.VITE_DEV_SERVER_URL || "http://localhost:5173",
};

function hasSyncEndpoint() {
  if (config.forceOffline) return false;
  return Boolean(config.neonDatabaseUrl || config.syncApiUrl);
}

function usesNeonSync() {
  // Neon disabled until NEON_DATABASE_URL is uncommented and forceOffline is off.
  if (config.forceOffline) return false;
  return Boolean(config.neonDatabaseUrl);
}

module.exports = {
  config,
  hasSyncEndpoint,
  usesNeonSync,
  resolvePreload() {
    return path.join(__dirname, "..", "preload.cjs");
  },
};
