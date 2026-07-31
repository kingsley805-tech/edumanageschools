/**
 * Shared print helpers: silent print, preview, PDF, printer list.
 */
const { BrowserWindow, webContents } = require("electron");
const path = require("path");
const fs = require("fs");
const paths = require("../utils/paths.cjs");
const logger = require("../utils/logger.cjs");

function listPrinters(targetWc) {
  const wc = targetWc || BrowserWindow.getFocusedWindow()?.webContents;
  if (!wc) return [];
  return wc.getPrintersAsync ? null : wc.getPrinters();
}

async function getPrintersAsync(targetWc) {
  const wc = targetWc || BrowserWindow.getFocusedWindow()?.webContents;
  if (!wc) return [];
  if (typeof wc.getPrintersAsync === "function") return wc.getPrintersAsync();
  return wc.getPrinters();
}

/**
 * Print HTML document via a hidden BrowserWindow.
 */
async function printHtml(html, options = {}) {
  const {
    silent = false,
    deviceName = "",
    copies = 1,
    pageSize = "A4",
    landscape = false,
    preview = false,
    margins = { marginType: "default" },
  } = options;

  const win = new BrowserWindow({
    show: preview,
    width: 900,
    height: 1100,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await win.loadURL(dataUrl);

  if (preview && !silent) {
    // User prints from preview window
    return new Promise((resolve) => {
      win.webContents.print(
        {
          silent: false,
          printBackground: true,
          deviceName,
          copies,
          pageSize,
          landscape,
          margins,
        },
        (success, failureReason) => {
          if (!win.isDestroyed()) win.close();
          resolve({ success, failureReason });
        },
      );
    });
  }

  return new Promise((resolve, reject) => {
    win.webContents.print(
      {
        silent,
        printBackground: true,
        deviceName,
        copies,
        pageSize,
        landscape,
        margins,
      },
      (success, failureReason) => {
        if (!win.isDestroyed()) win.close();
        if (!success) {
          logger.warn("Print failed", { failureReason });
          reject(new Error(failureReason || "Print failed"));
          return;
        }
        resolve({ success: true });
      },
    );
  });
}

async function printToPdf(html, fileName = `print-${Date.now()}.pdf`, options = {}) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    landscape: options.landscape === true,
    pageSize: options.pageSize || "A4",
  });
  if (!win.isDestroyed()) win.close();

  const outPath = path.join(paths.getExportsDir(), fileName);
  fs.writeFileSync(outPath, pdf);
  return { path: outPath };
}

function wrapDocument(title, bodyHtml, { thermal = false, paperWidthMm = 80 } = {}) {
  const width = thermal ? `${paperWidthMm}mm` : "100%";
  const margin = thermal ? "0" : "16px";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;margin:${margin};color:#111;width:${width}}
    h1{font-size:${thermal ? "13px" : "18px"};margin:0 0 8px} h2{font-size:${thermal ? "11px" : "14px"};margin:12px 0 6px}
    table{width:100%;border-collapse:collapse;font-size:${thermal ? "10px" : "12px"}}
    th,td{border:${thermal ? "none" : "1px solid #ccc"};padding:${thermal ? "2px 0" : "6px"};text-align:left}
    .muted{color:#666;font-size:${thermal ? "9px" : "11px"}}
    @media print{body{margin:0}}
  </style></head><body>${bodyHtml}</body></html>`;
}

/**
 * Electron's print/printToPDF pageSize accepts a named size OR a custom
 * {width, height} object in microns (1mm = 1000 microns). Thermal roll
 * printers need a narrow custom width — a named size like "A4" causes
 * misscaled/cropped output on real 58mm/80mm hardware.
 */
function thermalPageSize(paperWidthMm = 80, paperHeightMm = 297) {
  return {
    width: Math.round(paperWidthMm * 1000),
    height: Math.round(paperHeightMm * 1000),
  };
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  listPrinters,
  getPrintersAsync,
  printHtml,
  printToPdf,
  wrapDocument,
  thermalPageSize,
  escapeHtml,
};
