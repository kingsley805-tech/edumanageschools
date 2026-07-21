const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const usb = require("../hardware/usb.cjs");
const serial = require("../hardware/serial.cjs");

function registerHardwareIpc() {
  ipcMain.handle(
    "hardware:usbList",
    wrap(async () => usb.listDevices()),
  );
  ipcMain.handle(
    "hardware:serialList",
    wrap(async () => serial.listPorts()),
  );
  ipcMain.handle(
    "hardware:serialOpen",
    wrap(async (_e, portPath, opts) => serial.open(portPath, opts || {})),
  );
  ipcMain.handle(
    "hardware:serialWrite",
    wrap(async (_e, portPath, data) => serial.write(portPath, data)),
  );
  ipcMain.handle(
    "hardware:serialClose",
    wrap(async (_e, portPath) => serial.close(portPath)),
  );
}

module.exports = { registerHardwareIpc };
