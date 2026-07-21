const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const Inventory = require("../database/models/Inventory.cjs");

function registerInventoryIpc() {
  ipcMain.handle(
    "inventory:list",
    wrap(async (_e, params) => Inventory.list(params || {})),
  );
  ipcMain.handle(
    "inventory:upsert",
    wrap(async (_e, record) => Inventory.upsert(record || {})),
  );
  ipcMain.handle(
    "inventory:delete",
    wrap(async (_e, id) => Inventory.softDelete(id)),
  );
  ipcMain.handle(
    "inventory:findByBarcode",
    wrap(async (_e, barcode) => {
      const rows = Inventory.list({ limit: 5000 });
      return rows.find((r) => r.barcode === barcode) || null;
    }),
  );
}

module.exports = { registerInventoryIpc };
