const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const backup = require("../database/backup.cjs");
const sync = require("../database/sync.cjs");

function registerBackupIpc() {
  ipcMain.handle(
    "backup:create",
    wrap(async (_e, opts) => backup.createBackup(opts || {})),
  );
  ipcMain.handle(
    "backup:restore",
    wrap(async (_e, backupPath) => backup.restoreBackup(backupPath)),
  );
  ipcMain.handle(
    "backup:list",
    wrap(async () => backup.listBackups()),
  );
  ipcMain.handle(
    "backup:syncNow",
    wrap(async (_e, opts) => sync.runSync(opts || {})),
  );
  ipcMain.handle(
    "backup:syncStatus",
    wrap(async () => sync.getStatus()),
  );
  ipcMain.handle(
    "backup:syncFailedItems",
    wrap(async (_e, limit) => sync.getFailedItems(limit)),
  );
  ipcMain.handle(
    "backup:syncPendingItems",
    wrap(async (_e, limit) => sync.getPendingItems(limit)),
  );
  ipcMain.handle(
    "backup:syncLogs",
    wrap(async (_e, limit) => sync.getLogs(limit)),
  );
}

module.exports = { registerBackupIpc };
