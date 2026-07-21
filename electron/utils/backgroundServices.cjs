/**
 * Background service orchestrator (sync, backup, device & updater hooks).
 * Started from main.cjs after migrations.
 */
const logger = require("./logger.cjs");
const backup = require("../database/backup.cjs");
const sync = require("../database/sync.cjs");
const usb = require("../hardware/usb.cjs");
const { getConnection } = require("../database/connection.cjs");

let maintenanceTimer = null;

function runDatabaseMaintenance() {
  try {
    const db = getConnection();
    if (typeof db.pragma === "function") {
      db.pragma("optimize");
      db.pragma("wal_checkpoint(PASSIVE)");
    }
    logger.debug("Database maintenance complete");
  } catch (err) {
    logger.warn("DB maintenance failed", { message: err.message });
  }
}

function startBackgroundServices() {
  backup.startScheduler();
  sync.startScheduler();
  usb.startMonitoring();
  maintenanceTimer = setInterval(runDatabaseMaintenance, 6 * 60 * 60 * 1000);
  if (maintenanceTimer.unref) maintenanceTimer.unref();
  logger.info("Background services started");
}

function stopBackgroundServices() {
  backup.stopScheduler();
  sync.stopScheduler();
  usb.stopMonitoring();
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  maintenanceTimer = null;
}

module.exports = { startBackgroundServices, stopBackgroundServices, runDatabaseMaintenance };
