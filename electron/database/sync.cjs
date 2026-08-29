/**
 * Offline → cloud synchronization with conflict detection/resolution.
 * Neon Postgres sync is currently disabled (comment NEON_DATABASE_URL).
 * Falls back to HTTP sync API if ELECTRON_SYNC_API_URL is set.
 * Honor ELECTRON_FORCE_OFFLINE=1 to stay offline even with an endpoint.
 *
 * Modes:
 * - local-only: no Neon/HTTP target → SQLite only; no polling spam
 * - offline: force-offline flag, or target configured but no network → queue locally
 * - cloud: Neon/HTTP + online → flush queue on interval and after reconnect
 */
const { net, BrowserWindow } = require("electron");
const { getConnection } = require("./connection.cjs");
const { applyRemoteRecord } = require("./models/_base.cjs");
const { config, hasSyncEndpoint, usesNeonSync } = require("../utils/config.cjs");
// Neon sync is optional — only load when configured.
let neonSync = null;
function getNeonSync() {
  if (!usesNeonSync()) return null;
  if (!neonSync) neonSync = require("./neonSync.cjs");
  return neonSync;
}
const logger = require("../utils/logger.cjs");
const notifications = require("../utils/notifications.cjs");

const MAX_ATTEMPTS = 5;
const MAX_LOGS = 200;
const ONLINE_PROBE_MS = 5_000;
const INITIAL_SYNC_DELAY_MS = 3_000;

let syncTimer = null;
let probeTimer = null;
let initialSyncTimer = null;
let syncing = false;
let wasOnline = false;
let lastSkipReason = null;
/** JWT from the renderer (Supabase session) for authenticated cloud sync. */
let authTokenCache = null;

let lastStatus = {
  online: false,
  status: "idle", // 'syncing' | 'synced' | 'pending' | 'failed' | 'offline' | 'local-only' | 'idle'
  mode: "local-only", // 'local-only' | 'offline' | 'cloud'
  lastSyncAt: null,
  pending: 0,
  failed: 0,
  lastError: null,
  progress: null, // { current, total } while a sync run is in flight
};
const logs = [];

function setAuthToken(token) {
  authTokenCache = typeof token === "string" && token.trim() ? token.trim() : null;
}

function getCachedAuthToken() {
  return authTokenCache;
}

function logEvent(level, message) {
  logs.push({ at: new Date().toISOString(), level, message });
  if (logs.length > MAX_LOGS) logs.shift();
  if (typeof logger[level] === "function") logger[level](message);
}

/** Log a recurring skip reason only once until the reason clears. */
function logSkipOnce(reason, message, level = "info") {
  if (lastSkipReason === reason) return;
  lastSkipReason = reason;
  logEvent(level, message);
}

function clearSkipReason() {
  lastSkipReason = null;
}

function isOnline() {
  return net.isOnline();
}

function currentMode() {
  if (config.forceOffline) return "offline";
  if (!hasSyncEndpoint()) return "local-only";
  if (!isOnline()) return "offline";
  return "cloud";
}

function computeStatusLabel() {
  if (syncing) return "syncing";
  if (config.forceOffline) return "offline";
  if (!hasSyncEndpoint()) return "local-only";
  if (!lastStatus.online) return "offline";
  if (lastStatus.failed > 0) return "failed";
  if (lastStatus.pending > 0) return "pending";
  return "synced";
}

function broadcastStatus() {
  lastStatus.online = isOnline();
  lastStatus.mode = currentMode();
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

function buildSyncHeaders(authToken) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

function resolveSyncEndpoint() {
  const base = config.syncApiUrl.replace(/\/$/, "");
  return base.endsWith("/sync") ? base : `${base}/sync`;
}

async function pushOneItem(item, authToken) {
  const payload = JSON.parse(item.payload || "{}");
  const neon = getNeonSync();
  if (neon) {
    return neon.pushRecord({
      entity: item.entity,
      entityId: item.entity_id,
      operation: item.operation,
      payload,
      clientUpdatedAt: payload.updated_at,
      syncedBy: null,
    });
  }

  return postJson(
    resolveSyncEndpoint(),
    {
      entity: item.entity,
      entity_id: item.entity_id,
      operation: item.operation,
      payload,
      client_updated_at: payload.updated_at,
    },
    buildSyncHeaders(authToken),
  );
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

  const token = authToken || getCachedAuthToken();

  try {
    if (config.forceOffline) {
      lastStatus.lastError = null;
      lastStatus.mode = "offline";
      logSkipOnce(
        "force-offline",
        "Sync paused — ELECTRON_FORCE_OFFLINE is set. Local changes stay on this device.",
        "info",
      );
      return { ...lastStatus, mode: "offline", skipped: true };
    }

    if (!isOnline()) {
      // Not an app error — local SQLite keeps working; queue waits for reconnect.
      lastStatus.lastError = null;
      lastStatus.mode = "offline";
      logSkipOnce(
        "offline",
        "Sync paused — offline. Local changes are saved and will auto-sync when the connection returns.",
        "info",
      );
      return { ...lastStatus, mode: "offline", skipped: true };
    }

    if (!hasSyncEndpoint()) {
      // Local-only is intentional when no cloud target is configured.
      lastStatus.lastError = null;
      lastStatus.mode = "local-only";
      if (!lastStatus.lastSyncAt) {
        lastStatus.lastSyncAt = getMeta("last_sync_at") || new Date().toISOString();
      }
      logSkipOnce(
        "local-only",
        "Local-only mode — set NEON_DATABASE_URL to enable Neon cloud sync.",
        "info",
      );
      return { ...lastStatus, mode: "local-only", skipped: true };
    }

    // Neon sync uses the desktop DB credential — no Supabase JWT required.
    // Legacy HTTP sync still expects a bearer token when configured.
    if (!usesNeonSync() && !token) {
      lastStatus.lastError = null;
      lastStatus.mode = "cloud";
      logSkipOnce(
        "auth",
        "Cloud sync waiting for sign-in — queue stays local until you log in.",
        "info",
      );
      return { ...lastStatus, mode: "cloud", skipped: true, reason: "auth_required" };
    }

    clearSkipReason();
    lastStatus.mode = "cloud";

    const db = getConnection();
    const statusFilter = includeFailed ? "status IN ('pending', 'failed')" : "status = 'pending'";
    const pending = db
      .prepare(`SELECT * FROM sync_queue WHERE ${statusFilter} ORDER BY id ASC LIMIT 100`)
      .all();

    let synced = 0;
    let failedThisRun = 0;

    if (pending.length === 0) {
      // Empty queue must still contact the backend before reporting a successful sync.
      try {
        const neon = getNeonSync();
        if (neon) {
          await neon.ping();
        } else if (config.syncApiUrl) {
          await postJson(resolveSyncEndpoint(), { ping: true }, buildSyncHeaders(token));
        } else {
          return {
            ...lastStatus,
            synced: 0,
            failed: 0,
            skipped: true,
            reason: "empty_queue_no_backend",
          };
        }
        setMeta("last_sync_at", new Date().toISOString());
        lastStatus.lastSyncAt = new Date().toISOString();
        lastStatus.lastError = null;
        return { ...lastStatus, synced: 0, failed: 0 };
      } catch (pingErr) {
        lastStatus.lastError = pingErr.message;
        logEvent("warn", `Empty-queue sync ping failed: ${pingErr.message}`);
        return { ...lastStatus, synced: 0, failed: 0, skipped: true, reason: "ping_failed" };
      }
    }

    for (let i = 0; i < pending.length; i += 1) {
      const item = pending[i];
      lastStatus.progress = { current: i + 1, total: pending.length };
      broadcastStatus();

      try {
        const payload = JSON.parse(item.payload || "{}");
        const result = await pushOneItem(item, token);

        if (result?.conflict && result?.remote) {
          const resolution = resolveConflict(payload, result.remote);
          if (resolution.winner === "remote" && item.entity) {
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
      }
    }

    lastStatus.progress = null;
    setMeta("last_sync_at", new Date().toISOString());
    lastStatus.lastSyncAt = new Date().toISOString();
    lastStatus.lastError = failedThisRun > 0 ? `${failedThisRun} item(s) failed to sync` : null;
    if (synced > 0) {
      notifications.presets.syncCompleted();
      logEvent("info", `Sync completed — ${synced} synced, ${failedThisRun} failed`);
    } else if (failedThisRun > 0) {
      logEvent("warn", `Sync finished with ${failedThisRun} failure(s) and 0 synced`);
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
  wasOnline = isOnline();
  lastStatus.online = wasOnline;
  lastStatus.mode = currentMode();
  lastStatus.lastSyncAt = getMeta("last_sync_at");

  const resolveToken = () => {
    if (typeof getAuthToken === "function") {
      const t = getAuthToken();
      if (t) return t;
    }
    return getCachedAuthToken();
  };

  // Connectivity probe — auto-resume cloud sync when the network returns.
  probeTimer = setInterval(() => {
    const online = isOnline();
    if (online && !wasOnline) {
      clearSkipReason();
      if (hasSyncEndpoint()) {
        logEvent("info", "Network restored — starting auto sync");
        runSync({ authToken: resolveToken() }).catch(() => {});
      }
    } else if (!online && wasOnline && hasSyncEndpoint()) {
      logSkipOnce(
        "offline",
        "Went offline — sync paused. Local changes continue to save to SQLite.",
        "info",
      );
    }
    wasOnline = online;
    broadcastStatus();
  }, ONLINE_PROBE_MS);
  if (probeTimer.unref) probeTimer.unref();

  if (hasSyncEndpoint()) {
    syncTimer = setInterval(() => {
      if (!isOnline()) return;
      runSync({ authToken: resolveToken() }).catch(() => {});
    }, config.syncIntervalMs);
    if (syncTimer.unref) syncTimer.unref();

    initialSyncTimer = setTimeout(() => {
      if (isOnline()) {
        runSync({ authToken: resolveToken() }).catch(() => {});
      }
    }, INITIAL_SYNC_DELAY_MS);
    if (initialSyncTimer.unref) initialSyncTimer.unref();

    logger.info("Sync scheduler started", {
      intervalMs: config.syncIntervalMs,
      mode: "cloud",
      backend: usesNeonSync() ? "neon" : "http",
      endpoint: usesNeonSync() ? "neon://desktop_sync_records" : resolveSyncEndpoint(),
    });
  } else {
    logEvent(
      "info",
      "Local-only mode — SQLite is the source of truth. Set NEON_DATABASE_URL to enable Neon cloud sync.",
    );
    logger.info("Sync scheduler idle (local-only)", { intervalMs: config.syncIntervalMs });
  }

  broadcastStatus();
}

function stopScheduler() {
  if (syncTimer) clearInterval(syncTimer);
  if (probeTimer) clearInterval(probeTimer);
  if (initialSyncTimer) clearTimeout(initialSyncTimer);
  syncTimer = null;
  probeTimer = null;
  initialSyncTimer = null;
}

function getStatus() {
  lastStatus.online = isOnline();
  lastStatus.mode = currentMode();
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
  hasSyncEndpoint,
  setAuthToken,
  getCachedAuthToken,
};
