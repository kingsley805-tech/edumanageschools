const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const Attendance = require("../database/models/Attendance.cjs");
const notifications = require("../utils/notifications.cjs");

function registerAttendanceIpc() {
  ipcMain.handle(
    "attendance:list",
    wrap(async (_e, params) => Attendance.list(params || {})),
  );
  ipcMain.handle(
    "attendance:upsert",
    wrap(async (_e, record) => {
      const row = Attendance.upsert(record || {});
      notifications.presets.attendanceSubmitted();
      return row;
    }),
  );
  ipcMain.handle(
    "attendance:delete",
    wrap(async (_e, id) => Attendance.softDelete(id)),
  );
}

module.exports = { registerAttendanceIpc };
