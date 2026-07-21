/**
 * Auto-update via electron-updater when a feed URL is configured.
 */
const { BrowserWindow } = require("electron");
const logger = require("../utils/logger.cjs");
const notifications = require("../utils/notifications.cjs");
const { config } = require("../utils/config.cjs");

let autoUpdater = null;

function loadUpdater() {
  try {
    ({ autoUpdater } = require("electron-updater"));
    return autoUpdater;
  } catch (err) {
    logger.warn("electron-updater not available", { message: err.message });
    return null;
  }
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function setupAutoUpdater() {
  const updater = loadUpdater();
  if (!updater) return null;

  if (config.updateFeedUrl) {
    try {
      updater.setFeedURL({ provider: "generic", url: config.updateFeedUrl });
    } catch (err) {
      logger.warn("Invalid update feed", { message: err.message });
    }
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on("checking-for-update", () => broadcast("updater:status", { status: "checking" }));
  updater.on("update-available", (info) => {
    broadcast("updater:status", { status: "available", info });
    notifications.presets.updateAvailable(info?.version);
  });
  updater.on("update-not-available", (info) =>
    broadcast("updater:status", { status: "not-available", info }),
  );
  updater.on("download-progress", (progress) =>
    broadcast("updater:status", { status: "downloading", progress }),
  );
  updater.on("update-downloaded", (info) => {
    broadcast("updater:status", { status: "downloaded", info });
    notifications.notify("Update ready", "Restart to install the new version", {
      onClick: () => updater.quitAndInstall(),
    });
  });
  updater.on("error", (err) => {
    logger.error("Auto-updater error", { message: err.message });
    broadcast("updater:status", { status: "error", message: err.message });
  });

  // Delay first check
  setTimeout(() => {
    updater.checkForUpdates().catch((err) => logger.warn("Update check failed", { message: err.message }));
  }, 8_000);

  return updater;
}

function checkForUpdates() {
  const updater = autoUpdater || loadUpdater();
  if (!updater) return Promise.resolve({ ok: false, reason: "updater_unavailable" });
  return updater.checkForUpdates();
}

function quitAndInstall() {
  const updater = autoUpdater || loadUpdater();
  if (updater) updater.quitAndInstall();
}

module.exports = { setupAutoUpdater, checkForUpdates, quitAndInstall };
