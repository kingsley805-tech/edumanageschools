/**
 * Offline → cloud synchronization with conflict detection/resolution.
 * Targets ELECTRON_SYNC_API_URL (Laravel REST or compatible gateway).
 */
const { net, BrowserWindow } = require("electron");
const { getConnection } = require("./connection.cjs");
const { applyRemoteRecord } = require("./models/_base.cjs");
const { config } = require("../utils/config.cjs");
const logger = require("../utils/logger.cjs");
const notifications = require("../utils/notifications.cjs");

const MAX_ATTEMPTS = 5;
const MAX_LOGS = 200;

let syncTimer = null;
let syncing = false;
let lastStatus = {
  online: false,
  status: "idle", // 'syncing' | 'synced' | 'pending' | 'failed' | 'offline'
  lastSyncAt: null,
  pending: 0,
  failed: 0,
  lastError: null,
  progress: null, // { current, total } while a sync run is in flight
};
const logs = [];

function logEvent(level, message) {
  logs.push({ at: new Date().toISOString(), level, message });
  if (logs.length > MAX_LOGS) logs.shift();
  if (typeof logger[level] === "function") logger[level](message);
}

function isOnline() {
  return net.isOnline();
}

function computeStatusLabel() {
  if (syncing) return "syncing";
  if (!lastStatus.online) return "offline";
  if (lastStatus.failed > 0) return "failed";
  if (lastStatus.pending > 0) return "pending";
  return "synced";
}

function broadcastStatus() {
  lastStatus.online = isOnline();
  lastStatus.pending = countPending();
  lastStatus.failed = countFailed();
  lastStatus.status = computeStatusLabel();
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

function countFailed() {
  try {
    const db = getConnection();
    const row = db.prepare(`SELECT COUNT(*) AS c FROM sync_queue WHERE status = 'failed'`).get();
    return row?.c || 0;
  } catch {
    return 0;
  }
}

function getFailedItems(limit = 50) {
  try {
    const db = getConnection();
    return db
      .prepare(`SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY updated_at DESC LIMIT ?`)
      .all(limit);
  } catch {
    return [];
  }
}

function getPendingItems(limit = 50) {
  try {
    const db = getConnection();
    return db
      .prepare(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC LIMIT ?`)
      .all(limit);
  } catch {
    return [];
  }
}

function getLogs(limit = 100) {
  return logs.slice(-limit).reverse();
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

/**
 * @param {object} opts
 * @param {string} [opts.authToken]
 * @param {boolean} [opts.includeFailed] - Manual "Sync Now" retries items that
 *   previously exhausted their automatic attempts; the scheduled background
 *   sync does not, so a permanently-broken record can't hammer the API forever.
 */
async function runSync({ authToken, includeFailed = false } = {}) {
  if (syncing) return { ...lastStatus, skipped: true };
  syncing = true;
  lastStatus.progress = null;
  broadcastStatus();

  try {
    if (!isOnline()) {
      lastStatus.lastError = "offline";
      logEvent("warn", "Sync skipped — device is offline");
      return { ...lastStatus };
    }

    if (!config.syncApiUrl) {
      lastStatus.lastError = "sync_api_not_configured";
      lastStatus.lastSyncAt = new Date().toISOString();
      logEvent("warn", "Sync skipped — ELECTRON_SYNC_API_URL not configured (local-only mode)");
      return { ...lastStatus, mode: "local-only" };
    }

    const db = getConnection();
    const statusFilter = includeFailed ? "status IN ('pending', 'failed')" : "status = 'pending'";
    const pending = db
      .prepare(`SELECT * FROM sync_queue WHERE ${statusFilter} ORDER BY id ASC LIMIT 100`)
      .all();

    let synced = 0;
    let failedThisRun = 0;

    for (let i = 0; i < pending.length; i += 1) {
      const item = pending[i];
      lastStatus.progress = { current: i + 1, total: pending.length };
      broadcastStatus();

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
          const resolution = resolveConflict(payload, result.remote);
          if (resolution.winner === "remote" && item.entity) {
            // The server's copy is authoritative for this conflict — write it
            // back into the local table so the local row actually reflects
            // the resolution instead of just being rubber-stamped "synced"
            // while still holding stale data.
            try {
              applyRemoteRecord(item.entity, result.remote);
              logEvent(
                "info",
                `Conflict on ${item.entity} #${item.entity_id} resolved in favor of remote (newer updated_at)`,
              );
            } catch (applyErr) {
              logEvent(
                "warn",
                `Conflict resolved as remote-wins for ${item.entity} #${item.entity_id} but local write-back failed: ${applyErr.message}`,
              );
            }
          } else {
            logEvent("info", `Conflict on ${item.entity} #${item.entity_id} resolved in favor of local (kept as-is)`);
          }
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
        synced += 1;
      } catch (err) {
        const attempts = (item.attempts || 0) + 1;
        const nextStatus = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        db.prepare(
          `UPDATE sync_queue SET attempts = ?, status = ?, last_error = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(attempts, nextStatus, err.message, item.id);
        failedThisRun += 1;
        logEvent(
          "error",
          `Sync failed for ${item.entity} #${item.entity_id} (attempt ${attempts}${nextStatus === "failed" ? ", giving up" : ""}): ${err.message}`,
        );
        // Deliberately do NOT rethrow — one broken record must not block the
        // rest of the queue from syncing this run.
      }
    }

    lastStatus.progress = null;
    setMeta("last_sync_at", new Date().toISOString());
    lastStatus.lastSyncAt = new Date().toISOString();
    lastStatus.lastError = failedThisRun > 0 ? `${failedThisRun} item(s) failed to sync` : null;
    if (synced > 0) {
      notifications.presets.syncCompleted();
      logEvent("info", `Sync completed — ${synced} synced, ${failedThisRun} failed`);
    }
    return { ...lastStatus, synced, failed: failedThisRun };
  } catch (err) {
    lastStatus.lastError = err.message;
    logEvent("error", `Sync run aborted: ${err.message}`);
    return { ...lastStatus };
  } finally {
    lastStatus.progress = null;
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
  lastStatus.failed = countFailed();
  lastStatus.lastSyncAt = getMeta("last_sync_at") || lastStatus.lastSyncAt;
  lastStatus.status = computeStatusLabel();
  return { ...lastStatus };
}

module.exports = {
  runSync,
  startScheduler,
  stopScheduler,
  getStatus,
  getFailedItems,
  getPendingItems,
  getLogs,
  resolveConflict,
  isOnline,
  broadcastStatus,
};
