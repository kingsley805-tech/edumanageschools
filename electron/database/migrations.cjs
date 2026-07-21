/**
 * Schema migrations for the local offline database.
 */
const { getConnection } = require("./connection.cjs");
const logger = require("../utils/logger.cjs");

const MIGRATIONS = [
  {
    id: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        role TEXT,
        school_id TEXT,
        settings_json TEXT,
        fingerprint_template TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        admission_no TEXT,
        first_name TEXT,
        last_name TEXT,
        class_id TEXT,
        parent_id TEXT,
        phone TEXT,
        email TEXT,
        photo_path TEXT,
        status TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS parents (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        full_name TEXT,
        phone TEXT,
        email TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        staff_code TEXT,
        full_name TEXT,
        phone TEXT,
        email TEXT,
        photo_path TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        staff_code TEXT,
        full_name TEXT,
        department TEXT,
        phone TEXT,
        email TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        student_id TEXT,
        class_id TEXT,
        date TEXT,
        status TEXT,
        recorded_by TEXT,
        source TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS fees (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        student_id TEXT,
        invoice_no TEXT,
        amount REAL,
        paid_amount REAL,
        status TEXT,
        due_date TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS payroll (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        staff_id TEXT,
        period TEXT,
        gross REAL,
        net REAL,
        status TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS examination (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        title TEXT,
        term TEXT,
        class_id TEXT,
        status TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        examination_id TEXT,
        student_id TEXT,
        subject_id TEXT,
        score REAL,
        grade TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        sku TEXT,
        name TEXT,
        quantity REAL,
        barcode TEXT,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS timetable (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        class_id TEXT,
        day_of_week INTEGER,
        payload_json TEXT,
        updated_at TEXT,
        synced_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS cached_reports (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        report_type TEXT,
        title TEXT,
        file_path TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
      CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    `,
  },
];

function runMigrations() {
  const db = getConnection();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() || []).map((r) => r.id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const tx = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(
        migration.id,
        migration.name,
      );
    });
    tx();
    logger.info("Applied migration", { id: migration.id, name: migration.name });
  }
}

module.exports = { runMigrations, MIGRATIONS };
