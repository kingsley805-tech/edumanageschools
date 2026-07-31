/**
 * Centralized filesystem paths for the desktop app.
 */
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

function userData(...segments) {
  const base = app.getPath("userData");
  const full = path.join(base, ...segments);
  return full;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

module.exports = {
  getRoot() {
    return app.getPath("userData");
  },
  getDatabaseDir() {
    return ensureDir(userData("database"));
  },
  getDatabasePath() {
    return path.join(this.getDatabaseDir(), "school-hub.sqlite");
  },
  getBackupDir() {
    return ensureDir(userData("backups"));
  },
  getDocumentsDir(category = "general") {
    return ensureDir(userData("documents", category));
  },
  getPhotosDir() {
    return ensureDir(userData("photos"));
  },
  getExportsDir() {
    return ensureDir(userData("exports"));
  },
  getLogsDir() {
    return ensureDir(userData("logs"));
  },
  getAssetsDir() {
    return path.join(__dirname, "..", "assets");
  },
  getIconPath() {
    const ico = path.join(this.getAssetsDir(), "icon.ico");
    const png = path.join(this.getAssetsDir(), "icon.png");
    if (fs.existsSync(ico)) return ico;
    if (fs.existsSync(png)) return png;
    // Fallback to bundled public logo when packaged/dev
    const publicPng = path.join(__dirname, "..", "..", "public", "shepherd-logo.png");
    return fs.existsSync(publicPng) ? publicPng : undefined;
  },
  /**
   * Confines renderer-supplied paths (IPC args, not native-dialog results) to
   * this app's own userData tree. `files:save` / `files:compress` accept a
   * bare filePath straight from the renderer with no dialog in between, so
   * without this a bug (or any future XSS) could write/read anywhere on
   * disk. `files:open` / `files:saveAs` are exempt — those paths come back
   * from a native dialog the user explicitly drove.
   */
  isWithinAppRoot(candidatePath) {
    if (!candidatePath) return false;
    const root = path.resolve(this.getRoot());
    const resolved = path.resolve(candidatePath);
    return resolved === root || resolved.startsWith(root + path.sep);
  },
};
