/**
 * Cash drawer kick (opening) support.
 *
 * Most POS cash drawers are wired through the RJ11/RJ12 port on a receipt
 * printer and are opened with the standard ESC/POS "kick" command sent over
 * whatever transport reaches the printer:
 *   ESC p m t1 t2  ->  0x1B 0x70 m t1 t2
 * m = drawer pin (0 or 1), t1/t2 = on/off pulse widths (~ x2ms).
 *
 * We support the two transports already wired into this app:
 *  - serial (RS232 printers / drawer interfaces) via hardware/serial.cjs
 *  - a raw passthrough for printers that expose a writable OS port name
 *
 * Vendor USB/network kick commands vary; this module gives a stable IPC
 * contract other transports can plug into later.
 */
const logger = require("../utils/logger.cjs");
const serial = require("./serial.cjs");

const ESC = 0x1b;

function kickBuffer({ pin = 0, onMs = 25, offMs = 250 } = {}) {
  // t1/t2 units are ~2ms increments per the standard ESC/POS spec.
  const t1 = Math.max(1, Math.min(255, Math.round(onMs / 2)));
  const t2 = Math.max(1, Math.min(255, Math.round(offMs / 2)));
  return Buffer.from([ESC, 0x70, pin === 1 ? 1 : 0, t1, t2]);
}

/**
 * Open the drawer over a serial/COM port that is wired to the printer's
 * drawer-kick pins. The port must already be reachable (see hardware:serialOpen).
 */
async function openViaSerial(portPath, opts = {}) {
  if (!portPath) throw new Error("portPath required for serial cash drawer kick");
  const buf = kickBuffer(opts);
  try {
    await serial.open(portPath, { baudRate: opts.baudRate || 9600 });
    await serial.write(portPath, buf);
    logger.info("Cash drawer kick sent", { portPath, transport: "serial" });
    return { opened: true, transport: "serial", portPath };
  } catch (err) {
    logger.error("Cash drawer kick failed", { portPath, message: err.message });
    throw err;
  }
}

module.exports = { kickBuffer, openViaSerial };
