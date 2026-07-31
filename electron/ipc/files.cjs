const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { ipcMain, dialog, BrowserWindow, shell } = require("electron");
const { wrap } = require("../utils/ipcResult.cjs");
const paths = require("../utils/paths.cjs");

function focused() {
  return BrowserWindow.getFocusedWindow();
}

function registerFilesIpc() {
  ipcMain.handle(
    "files:open",
    wrap(async (_e, options = {}) => {
      const result = await dialog.showOpenDialog(focused(), {
        properties: options.multiple ? ["openFile", "multiSelections"] : ["openFile"],
        filters: options.filters || [{ name: "All Files", extensions: ["*"] }],
      });
      if (result.canceled) return null;
      const files = result.filePaths.map((p) => ({
        path: p,
        name: path.basename(p),
        content: options.asText ? fs.readFileSync(p, "utf8") : undefined,
        base64: options.asBase64 ? fs.readFileSync(p).toString("base64") : undefined,
      }));
      return options.multiple ? files : files[0];
    }),
  );

  ipcMain.handle(
    "files:save",
    wrap(async (_e, { filePath, content, encoding = "utf8" } = {}) => {
      if (!filePath) throw new Error("filePath required");
      if (!paths.isWithinAppRoot(filePath)) {
        throw new Error("filePath must be inside the app's data directory; use files:saveAs to write elsewhere");
      }
      const data = encoding === "base64" ? Buffer.from(content, "base64") : content;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, data);
      return { path: filePath };
    }),
  );

  ipcMain.handle(
    "files:saveAs",
    wrap(async (_e, { defaultPath, content, encoding = "utf8", filters } = {}) => {
      const result = await dialog.showSaveDialog(focused(), {
        defaultPath,
        filters: filters || [{ name: "All Files", extensions: ["*"] }],
      });
      if (result.canceled || !result.filePath) return null;
      const data = encoding === "base64" ? Buffer.from(content, "base64") : content;
      fs.writeFileSync(result.filePath, data);
      return { path: result.filePath };
    }),
  );

  ipcMain.handle(
    "files:export",
    wrap(async (_e, { format, fileName, content } = {}) => {
      const ext = String(format || "txt").toLowerCase();
      const name = fileName || `export-${Date.now()}.${ext}`;
      const out = path.join(paths.getExportsDir(), name);
      if (ext === "pdf" || ext === "xlsx" || ext === "docx") {
        // Binary payloads expected as base64
        fs.writeFileSync(out, Buffer.from(content || "", "base64"));
      } else {
        fs.writeFileSync(out, content || "", "utf8");
      }
      return { path: out, format: ext };
    }),
  );

  ipcMain.handle(
    "files:importText",
    wrap(async (_e, options = {}) => {
      const result = await dialog.showOpenDialog(focused(), {
        properties: ["openFile"],
        filters:
          options.filters ||
          [
            { name: "Spreadsheets", extensions: ["csv", "xlsx", "xls"] },
            { name: "All Files", extensions: ["*"] },
          ],
      });
      if (result.canceled) return null;
      const filePath = result.filePaths[0];
      const buf = fs.readFileSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        text: buf.toString("utf8"),
        base64: buf.toString("base64"),
      };
    }),
  );

  ipcMain.handle(
    "files:saveDocument",
    wrap(async (_e, { category = "general", fileName, content, encoding = "base64" } = {}) => {
      const dir = paths.getDocumentsDir(category);
      const name = fileName || `doc-${Date.now()}`;
      const full = path.join(dir, name);
      const data = encoding === "base64" ? Buffer.from(content || "", "base64") : content || "";
      fs.writeFileSync(full, data);
      return { path: full, category };
    }),
  );

  ipcMain.handle(
    "files:listDocuments",
    wrap(async (_e, category = "general") => {
      const dir = paths.getDocumentsDir(category);
      return fs.readdirSync(dir).map((name) => {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        return { name, path: full, size: st.size, modifiedAt: st.mtime.toISOString() };
      });
    }),
  );

  ipcMain.handle(
    "files:compress",
    wrap(async (_e, { sourcePath, destPath } = {}) => {
      if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("Source not found");
      if (!paths.isWithinAppRoot(sourcePath)) {
        throw new Error("sourcePath must be inside the app's data directory");
      }
      const out = destPath || `${sourcePath}.gz`;
      if (!paths.isWithinAppRoot(out)) {
        throw new Error("destPath must be inside the app's data directory");
      }
      fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(sourcePath)));
      return { path: out };
    }),
  );

  ipcMain.handle(
    "files:showInFolder",
    wrap(async (_e, filePath) => {
      shell.showItemInFolder(filePath);
      return { shown: true };
    }),
  );

  ipcMain.handle(
    "files:getPaths",
    wrap(async () => ({
      documents: paths.getDocumentsDir(),
      photos: paths.getPhotosDir(),
      exports: paths.getExportsDir(),
      backups: paths.getBackupDir(),
      students: paths.getDocumentsDir("students"),
      teachers: paths.getDocumentsDir("teachers"),
      payroll: paths.getDocumentsDir("payroll"),
      certificates: paths.getDocumentsDir("certificates"),
      logos: paths.getDocumentsDir("logos"),
      signatures: paths.getDocumentsDir("signatures"),
    })),
  );
}

module.exports = { registerFilesIpc };
