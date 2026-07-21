/**
 * Fingerprint reader integration surface.
 * Vendor SDKs vary; this module provides a stable IPC contract and a simulator for development.
 */
const crypto = require("crypto");
const { BrowserWindow } = require("electron");
const logger = require("../utils/logger.cjs");
const User = require("../database/models/User.cjs");

let deviceConnected = false;
let simulating = process.env.ELECTRON_SIMULATE_FINGERPRINT === "1";

function setConnected(connected) {
  deviceConnected = !!connected;
  broadcastStatus();
}

function broadcastStatus() {
  const payload = getStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("hardware:fingerprint-status", payload);
  }
}

function getStatus() {
  return {
    connected: deviceConnected || simulating,
    simulating,
    vendor: simulating ? "simulator" : "native",
  };
}

/**
 * Capture a fingerprint template (vendor SDK hook).
 * Returns a hashed template string suitable for local matching.
 */
async function capture({ purpose = "verify", userId = null } = {}) {
  if (!deviceConnected && !simulating) {
    throw new Error("Fingerprint reader not connected");
  }

  // Simulator path for labs without hardware
  if (simulating) {
    const template = crypto
      .createHash("sha256")
      .update(`sim-${userId || "anon"}-${purpose}-${Date.now()}`)
      .digest("hex");
    return { template, quality: 0.92, purpose, simulated: true };
  }

  // Native vendor integration point:
  // Replace with SDK capture call (DigitalPersona, ZKTeco, Suprema, etc.)
  throw new Error("Native fingerprint SDK not configured. Set ELECTRON_SIMULATE_FINGERPRINT=1 for lab use.");
}

async function enroll(userId) {
  const captured = await capture({ purpose: "enroll", userId });
  User.upsert(
    {
      id: userId,
      fingerprint_template: captured.template,
      updated_at: new Date().toISOString(),
    },
    { enqueueSync: true },
  );
  logger.info("Fingerprint enrolled", { userId });
  return { enrolled: true, userId };
}

async function verify(userId) {
  const user = User.getById(userId);
  if (!user?.fingerprint_template) throw new Error("No fingerprint enrolled for user");
  const captured = await capture({ purpose: "verify", userId });
  if (simulating) {
    // Lab mode: treat consecutive captures from same user as match helper only when templates equal
    return { match: captured.template === user.fingerprint_template, purpose: "verify", userId, simulated: true };
  }
  const a = Buffer.from(String(user.fingerprint_template));
  const b = Buffer.from(String(captured.template));
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { match: !!match, purpose: "verify", userId };
}

function enableSimulator(enabled = true) {
  simulating = !!enabled;
  broadcastStatus();
}

module.exports = {
  getStatus,
  setConnected,
  capture,
  enroll,
  verify,
  enableSimulator,
};
