/**
 * Lightweight main-process logger with levels and optional file sink.
 */
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let currentLevel = LEVELS.info;
let logFilePath = null;

function ensureLogFile() {
  if (logFilePath) return logFilePath;
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.join(dir, "desktop.log");
  } catch {
    logFilePath = null;
  }
  return logFilePath;
}

function write(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const ts = new Date().toISOString();
  const suffix = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${ts}] [${level.toUpperCase()}] ${message}${suffix}`;
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](line);
  const file = ensureLogFile();
  if (file) {
    try {
      fs.appendFileSync(file, `${line}\n`);
    } catch {
      /* ignore disk errors */
    }
  }
}

module.exports = {
  setLevel(level) {
    if (LEVELS[level] !== undefined) currentLevel = LEVELS[level];
  },
  error: (msg, meta) => write("error", msg, meta),
  warn: (msg, meta) => write("warn", msg, meta),
  info: (msg, meta) => write("info", msg, meta),
  debug: (msg, meta) => write("debug", msg, meta),
};
