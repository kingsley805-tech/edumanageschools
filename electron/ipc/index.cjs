const { registerStudentIpc } = require("./student.cjs");
const { registerAttendanceIpc } = require("./attendance.cjs");
const { registerFinanceIpc } = require("./finance.cjs");
const { registerPayrollIpc } = require("./payroll.cjs");
const { registerInventoryIpc } = require("./inventory.cjs");
const { registerPrinterIpc } = require("./printer.cjs");
const { registerFilesIpc } = require("./files.cjs");
const { registerScannerIpc } = require("./scanner.cjs");
const { registerBiometricIpc } = require("./biometric.cjs");
const { registerHardwareIpc } = require("./hardware.cjs");
const { registerBackupIpc } = require("./backup.cjs");

function registerAllIpc() {
  registerStudentIpc();
  registerAttendanceIpc();
  registerFinanceIpc();
  registerPayrollIpc();
  registerInventoryIpc();
  registerPrinterIpc();
  registerFilesIpc();
  registerScannerIpc();
  registerBiometricIpc();
  registerHardwareIpc();
  registerBackupIpc();
}

module.exports = { registerAllIpc };
