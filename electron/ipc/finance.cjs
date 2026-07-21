const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const Fees = require("../database/models/Fees.cjs");
const notifications = require("../utils/notifications.cjs");

function registerFinanceIpc() {
  ipcMain.handle(
    "finance:list",
    wrap(async (_e, params) => Fees.list(params || {})),
  );
  ipcMain.handle(
    "finance:get",
    wrap(async (_e, id) => Fees.getById(id)),
  );
  ipcMain.handle(
    "finance:upsert",
    wrap(async (_e, record) => {
      const row = Fees.upsert(record || {});
      if (row.paid_amount > 0) {
        notifications.presets.paymentReceived(String(row.paid_amount));
      }
      return row;
    }),
  );
  ipcMain.handle(
    "finance:delete",
    wrap(async (_e, id) => Fees.softDelete(id)),
  );
}

module.exports = { registerFinanceIpc };
