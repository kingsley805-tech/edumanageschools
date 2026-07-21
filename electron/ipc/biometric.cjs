const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const fingerprint = require("../hardware/fingerprint.cjs");
const webcam = require("../hardware/webcam.cjs");

function registerBiometricIpc() {
  ipcMain.handle(
    "biometric:fingerprintStatus",
    wrap(async () => fingerprint.getStatus()),
  );
  ipcMain.handle(
    "biometric:enroll",
    wrap(async (_e, userId) => fingerprint.enroll(userId)),
  );
  ipcMain.handle(
    "biometric:verify",
    wrap(async (_e, userId) => fingerprint.verify(userId)),
  );
  ipcMain.handle(
    "biometric:capture",
    wrap(async (_e, opts) => fingerprint.capture(opts || {})),
  );
  ipcMain.handle(
    "biometric:simulate",
    wrap(async (_e, enabled) => {
      fingerprint.enableSimulator(enabled !== false);
      return fingerprint.getStatus();
    }),
  );
  ipcMain.handle(
    "biometric:savePhoto",
    wrap(async (_e, payload) => webcam.saveCapture(payload || {})),
  );
}

module.exports = { registerBiometricIpc };
