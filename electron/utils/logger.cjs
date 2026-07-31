/**
 * Lightweight main-process logger with levels and optional file sink.
 */
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let currentLevel = LEVELS.info;
let logFilePath = null;

// This app runs continuously in the tray on school office machines for
// months at a time, with the sync scheduler, USB monitor, and backup
// scheduler all writing through this logger. Without a size cap
// desktop.log grows forever; rotate it once it crosses ~5MB and keep a
// single previous file instead of letting disk usage grow unbounded.
const MAX_LOG_BYTES = 5 * 1024 * 1024;
let sizeCheckCounter = 0;

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

function rotateIfNeeded(file) {
  // Checking file size on every single write would itself add a syscall per
  // log line; sampling every 200 writes bounds a rotation from ever growing
  // more than a few hundred KB past MAX_LOG_BYTES while avoiding that cost.
  sizeCheckCounter += 1;
  if (sizeCheckCounter % 200 !== 0) return;
  try {
    const { size } = fs.statSync(file);
    if (size > MAX_LOG_BYTES) {
      const rotated = `${file}.1`;
      try {
        fs.rmSync(rotated, { force: true });
      } catch {
        /* ignore */
      }
      fs.renameSync(file, rotated);
    }
  } catch {
    /* file may not exist yet — nothing to rotate */
  }
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
      rotateIfNeeded(file);
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
