const { createModel } = require("./_base.cjs");
const { getConnection } = require("../connection.cjs");
const { nowIso } = require("./_base.cjs");

const User = createModel("users", "users");

User.getSettings = function getSettings() {
  const db = getConnection();
  const rows = db.prepare("SELECT key, value FROM user_settings").all() || [];
  return Object.fromEntries(rows.map((r) => [r.key, safeParse(r.value)]));
};

User.setSetting = function setSetting(key, value) {
  const db = getConnection();
  db.prepare(
    `INSERT INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), nowIso());
  return { key, value };
};

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

module.exports = User;
