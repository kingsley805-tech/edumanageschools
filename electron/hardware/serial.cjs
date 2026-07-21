/**
 * Serial / COM port communication for specialty devices.
 * Uses optional `serialport` package when available.
 */
const logger = require("../utils/logger.cjs");

let SerialPort = null;
try {
  ({ SerialPort } = require("serialport"));
} catch {
  SerialPort = null;
}

const openPorts = new Map();

async function listPorts() {
  if (!SerialPort) {
    return [{ path: "COM_STUB", manufacturer: "serialport not installed" }];
  }
  return SerialPort.list();
}

async function open(portPath, { baudRate = 9600 } = {}) {
  if (!SerialPort) throw new Error("serialport dependency not installed");
  if (openPorts.has(portPath)) return { path: portPath, alreadyOpen: true };

  const port = new SerialPort({ path: portPath, baudRate, autoOpen: true });
  openPorts.set(portPath, port);
  port.on("error", (err) => logger.warn("Serial error", { path: portPath, message: err.message }));
  return { path: portPath, baudRate };
}

async function write(portPath, data) {
  const port = openPorts.get(portPath);
  if (!port) throw new Error("Port not open");
  return new Promise((resolve, reject) => {
    port.write(data, (err) => (err ? reject(err) : resolve({ written: true })));
  });
}

async function close(portPath) {
  const port = openPorts.get(portPath);
  if (!port) return { closed: true };
  await new Promise((resolve) => port.close(() => resolve()));
  openPorts.delete(portPath);
  return { closed: true };
}

module.exports = { listPorts, open, write, close };
