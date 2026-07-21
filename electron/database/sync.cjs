/**
 * Offline → cloud synchronization with conflict resolution.
 * Targets ELECTRON_SYNC_API_URL (Laravel REST or compatible gateway).
 */
const { net, BrowserWindow } = require("electron");
const { getConnection } = require("./connection.cjs");
const { config } = require("../utils/config.cjs");
const logger = require("../utils/logger.cjs");
const notifications = require("../utils/notifications.cjs");

let syncTimer = null;
let syncing = false;
let lastStatus = {
  online: false,
  lastSyncAt: null,
  pending: 0,
  lastError: null,
};

function isOnline() {
  return net.isOnline();
}

function broadcastStatus() {
  lastStatus.online = isOnline();
  lastStatus.pending = countPending();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("desktop:sync-status", lastStatus);
  }
}

function countPending() {
  try {
    const db = getConnection();
    const row = db.prepare(`SELECT COUNT(*) AS c FROM sync_queue WHERE status = 'pending'`).get();
    return row?.c || 0;
  } catch {
    return 0;
  }
}

function getMeta(key) {
  const db = getConnection();
  const row = db.prepare(`SELECT value FROM sync_meta WHERE key = ?`).get(key);
  return row?.value ?? null;
}

function setMeta(key, value) {
  const db = getConnection();
  db.prepare(
    `INSERT INTO sync_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, String(value));
}

/**
 * Last-write-wins conflict resolution using updated_at timestamps.
 */
function resolveConflict(local, remote) {
  const localTs = Date.parse(local?.updated_at || 0) || 0;
  const remoteTs = Date.parse(remote?.updated_at || 0) || 0;
  return remoteTs >= localTs ? { winner: "remote", record: remote } : { winner: "local", record: local };
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sync HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

async function runSync({ authToken } = {}) {
  if (syncing) return { ...lastStatus, skipped: true };
  syncing = true;
  broadcastStatus();

  try {
    if (!isOnline()) {
      lastStatus.lastError = "offline";
      return { ...lastStatus };
    }

    if (!config.syncApiUrl) {
      // Local-only mode: mark queue items as acknowledged when no API configured
      lastStatus.lastError = "sync_api_not_configured";
      lastStatus.lastSyncAt = new Date().toISOString();
      return { ...lastStatus, mode: "local-only" };
    }

    const db = getConnection();
    const pending = db
      .prepare(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 100`)
      .all();

    for (const item of pending) {
      try {
        const payload = JSON.parse(item.payload || "{}");
        const result = await postJson(
          `${config.syncApiUrl.replace(/\/$/, "")}/sync`,
          {
            entity: item.entity,
            entity_id: item.entity_id,
            operation: item.operation,
            payload,
            client_updated_at: payload.updated_at,
          },
          authToken ? { Authorization: `Bearer ${authToken}` } : {},
        );

        if (result?.conflict && result?.remote) {
          resolveConflict(payload, result.remote);
          // Prefer remote on tie / newer remote — caller API may also push corrective data
        }

        db.prepare(
          `UPDATE sync_queue SET status = 'synced', updated_at = datetime('now'), last_error = NULL WHERE id = ?`,
        ).run(item.id);

        if (item.entity && item.entity_id) {
          try {
            db.prepare(`UPDATE ${item.entity} SET synced_at = datetime('now') WHERE id = ?`).run(item.entity_id);
          } catch {
            /* table may not match entity name */
          }
        }
      } catch (err) {
        db.prepare(
          `UPDATE sync_queue SET attempts = attempts + 1, last_error = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(err.message, item.id);
        throw err;
      }
    }

    setMeta("last_sync_at", new Date().toISOString());
    lastStatus.lastSyncAt = new Date().toISOString();
    lastStatus.lastError = null;
    if (pending.length > 0) notifications.presets.syncCompleted();
    return { ...lastStatus, synced: pending.length };
  } catch (err) {
    lastStatus.lastError = err.message;
    logger.error("Sync failed", { message: err.message });
    return { ...lastStatus };
  } finally {
    syncing = false;
    broadcastStatus();
  }
}

function startScheduler(getAuthToken) {
  stopScheduler();
  syncTimer = setInterval(() => {
    const token = typeof getAuthToken === "function" ? getAuthToken() : undefined;
    runSync({ authToken: token }).catch(() => {});
  }, config.syncIntervalMs);
  if (syncTimer.unref) syncTimer.unref();

  // Connectivity probe
  setInterval(broadcastStatus, 15_000).unref?.();
  logger.info("Sync scheduler started", { intervalMs: config.syncIntervalMs });
}

function stopScheduler() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
}

function getStatus() {
  lastStatus.online = isOnline();
  lastStatus.pending = countPending();
  lastStatus.lastSyncAt = getMeta("last_sync_at") || lastStatus.lastSyncAt;
  return { ...lastStatus };
}

module.exports = {
  runSync,
  startScheduler,
  stopScheduler,
  getStatus,
  resolveConflict,
  isOnline,
  broadcastStatus,
};
