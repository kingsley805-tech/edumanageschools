/**
 * Barcode / QR input handling.
 * Most USB barcode scanners act as HID keyboards; we also accept explicit scans from renderer.
 */
const { BrowserWindow } = require("electron");
const logger = require("../utils/logger.cjs");

let lastScan = null;
const listeners = new Set();

function broadcast(scan) {
  lastScan = scan;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("hardware:scan", scan);
  }
  for (const fn of listeners) {
    try {
      fn(scan);
    } catch (err) {
      logger.warn("Barcode listener error", { message: err.message });
    }
  }
}

function ingestScan(raw, meta = {}) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const scan = {
    value,
    type: meta.type || detectType(value),
    purpose: meta.purpose || "generic",
    at: new Date().toISOString(),
  };
  broadcast(scan);
  return scan;
}

function detectType(value) {
  if (/^https?:\/\//i.test(value) || value.includes("student:") || value.length > 40) return "qr";
  return "barcode";
}

function onScan(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getLastScan() {
  return lastScan;
}

module.exports = { ingestScan, onScan, getLastScan, detectType };
