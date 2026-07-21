const { ipcMain } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const { getPrintersAsync } = require("../printer/_shared.cjs");
const { printReceipt } = require("../printer/receiptPrinter.cjs");
const { printReport } = require("../printer/reportPrinter.cjs");
const { printIdCard } = require("../printer/idCardPrinter.cjs");
const { printCertificate } = require("../printer/certificatePrinter.cjs");

function registerPrinterIpc() {
  ipcMain.handle(
    "printer:list",
    wrap(async (event) => getPrintersAsync(event.sender)),
  );

  ipcMain.handle(
    "printer:receipt",
    wrap(async (_e, data, options) => printReceipt(data || {}, options || {})),
  );
  ipcMain.handle(
    "printer:report",
    wrap(async (_e, type, data, options) => printReport(type, data || {}, options || {})),
  );
  ipcMain.handle(
    "printer:idCard",
    wrap(async (_e, data, options) => printIdCard(data || {}, options || {})),
  );
  ipcMain.handle(
    "printer:certificate",
    wrap(async (_e, data, options) => printCertificate(data || {}, options || {})),
  );
}

module.exports = { registerPrinterIpc };
