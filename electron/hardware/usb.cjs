/**
 * USB plug-and-play monitoring.
 * Uses optional `usb` package when installed; otherwise polls drive letters / logs stubs.
 */
const { BrowserWindow } = require("electron");
const logger = require("../utils/logger.cjs");

let monitorTimer = null;
let lastFingerprint = "";
let usbApi = null;

try {
  usbApi = require("usb");
} catch {
  usbApi = null;
}

function classifyDevice(device) {
  const vendorId = device.deviceDescriptor?.idVendor;
  const productId = device.deviceDescriptor?.idProduct;
  return {
    vendorId,
    productId,
    kind: "usb",
    // Heuristic placeholders — extend with known VID/PID tables
    role: "unknown",
  };
}

function listDevices() {
  if (!usbApi) {
    return [
      {
        kind: "stub",
        role: "unavailable",
        note: "Install optional dependency `usb` for live USB enumeration",
      },
    ];
  }
  try {
    return usbApi.getDeviceList().map(classifyDevice);
  } catch (err) {
    logger.warn("USB list failed", { message: err.message });
    return [];
  }
}

function broadcast(event, devices) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("hardware:usb", { event, devices });
  }
}

function startMonitoring(intervalMs = 4000) {
  stopMonitoring();
  const tick = () => {
    const devices = listDevices();
    const fp = JSON.stringify(devices);
    if (fp !== lastFingerprint) {
      const event = lastFingerprint ? "changed" : "initial";
      lastFingerprint = fp;
      broadcast(event, devices);
    }
  };
  tick();
  monitorTimer = setInterval(tick, intervalMs);
  if (monitorTimer.unref) monitorTimer.unref();

  if (usbApi?.on) {
    try {
      usbApi.on("attach", () => broadcast("attach", listDevices()));
      usbApi.on("detach", () => broadcast("detach", listDevices()));
    } catch {
      /* optional */
    }
  }
  logger.info("USB monitoring started", { live: !!usbApi });
}

function stopMonitoring() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
}

module.exports = { listDevices, startMonitoring, stopMonitoring };
