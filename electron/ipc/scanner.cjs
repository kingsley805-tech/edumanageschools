const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const barcode = require("../hardware/barcode.cjs");

function registerScannerIpc() {
  ipcMain.handle(
    "scanner:ingest",
    wrap(async (_e, raw, meta) => barcode.ingestScan(raw, meta || {})),
  );
  ipcMain.handle(
    "scanner:last",
    wrap(async () => barcode.getLastScan()),
  );
}

module.exports = { registerScannerIpc };
