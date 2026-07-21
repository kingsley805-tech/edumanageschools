const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const Student = require("../database/models/Student.cjs");
const notifications = require("../utils/notifications.cjs");

function registerStudentIpc() {
  ipcMain.handle(
    "student:list",
    wrap(async (_e, params) => Student.list(params || {})),
  );
  ipcMain.handle(
    "student:get",
    wrap(async (_e, id) => Student.getById(id)),
  );
  ipcMain.handle(
    "student:upsert",
    wrap(async (_e, record) => {
      const row = Student.upsert(record || {});
      notifications.presets.studentRegistered(
        [row.first_name, row.last_name].filter(Boolean).join(" ") || row.admission_no,
      );
      return row;
    }),
  );
  ipcMain.handle(
    "student:delete",
    wrap(async (_e, id) => Student.softDelete(id)),
  );
}

module.exports = { registerStudentIpc };
