const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const Payroll = require("../database/models/Payroll.cjs");
const notifications = require("../utils/notifications.cjs");

function registerPayrollIpc() {
  ipcMain.handle(
    "payroll:list",
    wrap(async (_e, params) => Payroll.list(params || {})),
  );
  ipcMain.handle(
    "payroll:upsert",
    wrap(async (_e, record) => {
      const row = Payroll.upsert(record || {});
      if (row.status === "completed") notifications.presets.payrollCompleted();
      return row;
    }),
  );
  ipcMain.handle(
    "payroll:delete",
    wrap(async (_e, id) => Payroll.softDelete(id)),
  );
}

module.exports = { registerPayrollIpc };
