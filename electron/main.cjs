/**
 * Electron main process — window lifecycle, secure defaults, background services.
 */
const path = require("path");
const { app, BrowserWindow, ipcMain, globalShortcut, shell, session } = require("electron");

const { config, resolvePreload } = require("./utils/config.cjs");
const paths = require("./utils/paths.cjs");
const logger = require("./utils/logger.cjs");
const notifications = require("./utils/notifications.cjs");
const { registerAllIpc } = require("./ipc/index.cjs");
const { getConnection, closeConnection } = require("./database/connection.cjs");
const { runMigrations } = require("./database/migrations.cjs");
const { createTray, destroyTray } = require("./tray/tray.cjs");
const { setupAutoUpdater, checkForUpdates, quitAndInstall } = require("./updater/autoUpdater.cjs");
const { startBackgroundServices, stopBackgroundServices } = require("./utils/backgroundServices.cjs");
const backup = require("./database/backup.cjs");
const sync = require("./database/sync.cjs");

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    icon: paths.getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashWindow.loadFile(path.join(__dirname, "splash", "splash.html"));
}

function getSecureWebPreferences() {
  return {
    preload: resolvePreload(),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: true,
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: config.defaultWidth,
    height: config.defaultHeight,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0b3d2e",
    icon: paths.getIconPath(),
    webPreferences: getSecureWebPreferences(),
  });

  mainWindow.maximize();

  const startUrl = app.isPackaged
    ? `file://${path.join(__dirname, "..", "dist", "index.html")}`
    : config.viteDevUrl;

  mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.webContents.send("desktop:ready", {
      platform: process.platform,
      version: app.getVersion(),
    });
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting && process.platform !== "darwin") {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return mainWindow;
}

function createChildWindow(route = "/", options = {}) {
  const child = new BrowserWindow({
    width: options.width || 1200,
    height: options.height || 800,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    parent: options.modal ? mainWindow || undefined : undefined,
    modal: !!options.modal,
    show: true,
    frame: false,
    icon: paths.getIconPath(),
    webPreferences: getSecureWebPreferences(),
  });

  const base = app.isPackaged
    ? `file://${path.join(__dirname, "..", "dist", "index.html")}`
    : config.viteDevUrl;
  const hashRoute = route?.startsWith("/") ? `#${route}` : `#/${route || ""}`;
  child.loadURL(app.isPackaged ? `${base}${hashRoute}` : `${base}${route || "/"}`);
  return child;
}

function registerWindowIpc() {
  ipcMain.handle("window:minimize", (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  ipcMain.handle("window:maximize", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("window:close", (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
  ipcMain.handle("window:isMaximized", (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
  });
  ipcMain.handle("window:toggleFullScreen", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });
  ipcMain.handle("window:openChild", (_e, route, options) => {
    createChildWindow(route, options || {});
    return { opened: true };
  });

  ipcMain.handle("notify:clearUnread", () => {
    notifications.clearUnread();
    return { cleared: true };
  });
  ipcMain.handle("notify:getUnread", () => notifications.getUnreadCount());

  ipcMain.handle("updater:check", async () => checkForUpdates());
  ipcMain.handle("updater:install", () => {
    quitAndInstall();
    return { installing: true };
  });
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+F", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.setFullScreen(!win.isFullScreen());
  });
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (!app.isPackaged) BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
  });
  globalShortcut.register("CommandOrControl+R", () => {
    if (!app.isPackaged) BrowserWindow.getFocusedWindow()?.reload();
  });
  globalShortcut.register("CommandOrControl+Shift+S", () => {
    sync.runSync().catch(() => {});
  });
  globalShortcut.register("CommandOrControl+Shift+B", () => {
    backup.createBackup().catch(() => {});
  });
}

function hardenSession() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          app.isPackaged
            ? "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https: wss:; script-src 'self'; media-src 'self' blob:;"
            : "default-src 'self' http://localhost:* ws://localhost:* https:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' http://localhost:* ws://localhost:* https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; media-src 'self' blob:;",
        ],
      },
    });
  });
}

function initDatabaseAndServices() {
  getConnection();
  runMigrations();
  startBackgroundServices();
}

app.whenReady().then(() => {
  logger.info("EduManage Desktop starting", { version: app.getVersion() });
  hardenSession();
  createSplash();
  initDatabaseAndServices();
  registerAllIpc();
  registerWindowIpc();
  createMainWindow();
  createTray({
    onOpen: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });
  registerShortcuts();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopBackgroundServices();
  destroyTray();
  closeConnection();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep running in tray unless quitting
    if (isQuitting) app.quit();
  }
});
