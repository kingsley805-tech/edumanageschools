/**
 * Desktop runtime configuration (env + defaults).
 * Sync target can be Laravel REST or any compatible API / Supabase edge.
 */
const path = require("path");

const config = {
  appName: "EduManage Desktop",
  minWidth: 1100,
  minHeight: 700,
  defaultWidth: 1440,
  defaultHeight: 900,
  /** Cloud sync base URL (Laravel API, Supabase REST proxy, etc.) */
  syncApiUrl: process.env.ELECTRON_SYNC_API_URL || process.env.VITE_SYNC_API_URL || "",
  syncIntervalMs: Number(process.env.ELECTRON_SYNC_INTERVAL_MS || 60_000),
  backupIntervalMs: Number(process.env.ELECTRON_BACKUP_INTERVAL_MS || 6 * 60 * 60 * 1000),
  notificationPollMs: Number(process.env.ELECTRON_NOTIFY_POLL_MS || 120_000),
  dbEncryptionKey: process.env.ELECTRON_DB_ENCRYPTION_KEY || "",
  updateFeedUrl: process.env.ELECTRON_UPDATE_FEED_URL || "",
  isDev: process.env.ELECTRON_DEV === "1" || process.env.NODE_ENV === "development",
  viteDevUrl: process.env.VITE_DEV_SERVER_URL || "http://localhost:5173",
};

module.exports = {
  config,
  resolvePreload() {
    return path.join(__dirname, "..", "preload.cjs");
  },
};
