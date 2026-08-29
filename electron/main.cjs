/**
 * Electron main process — window lifecycle, secure defaults, background services.
 */
const path = require("path");
const { app, BrowserWindow, ipcMain, shell, session } = require("electron");

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

  attachWindowShortcuts(mainWindow);

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
  attachWindowShortcuts(child);
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

/**
 * App keyboard shortcuts, scoped per-window via `before-input-event` instead
 * of Electron's `globalShortcut` module. `globalShortcut` binds a key combo
 * OS-wide — it fires even when this app isn't focused, and silently steals
 * that combo from whatever else is running (a real problem for something as
 * common as Ctrl+Shift+S/B on a shared office PC). `before-input-event` only
 * fires while one of *this app's* windows has focus, which is what every one
 * of these actions (fullscreen, devtools, reload, sync, backup) actually
 * needs — none of them make sense to trigger while the app is in the
 * background. This also means shortcuts automatically work for child windows
 * (createChildWindow) without a separate global registration.
 */
function attachWindowShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const cmdOrCtrl = process.platform === "darwin" ? input.meta : input.control;
    if (!cmdOrCtrl) return;
    const key = (input.key || "").toLowerCase();

    if (input.shift && key === "f") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.shift && key === "i") {
      if (!app.isPackaged) win.webContents.toggleDevTools();
      event.preventDefault();
    } else if (!input.shift && key === "r") {
      if (!app.isPackaged) win.reload();
      event.preventDefault();
    } else if (input.shift && key === "s") {
      sync.runSync().catch(() => {});
      event.preventDefault();
    } else if (input.shift && key === "b") {
      backup.createBackup().catch(() => {});
      event.preventDefault();
    }
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

  // Deny every permission request by default; only camera is legitimately
  // used (webcam capture for ID photos / biometrics). Without this,
  // Electron's default is to prompt the OS/user for anything a page asks
  // for, including things this app never needs (geolocation, MIDI, HID).
  const ALLOWED_PERMISSIONS = new Set(["media"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
}

/**
 * Applies to every webContents this app creates (main window, child windows,
 * print/PDF windows, splash). Blocks the frame from ever being navigated to
 * a non-app origin — the only two valid origins are the packaged dist build
 * (file://) or the local Vite dev server. Without this, any way a remote
 * link or injected content reached window.location would swap out the
 * entire trusted UI for attacker-controlled content running with this app's
 * preload bridge still attached.
 */
function hardenNavigation() {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (navEvent, url) => {
      const allowedOrigin = app.isPackaged ? "file://" : config.viteDevUrl;
      if (!url.startsWith(allowedOrigin) && !url.startsWith("data:text/html")) {
        logger.warn("Blocked navigation to disallowed origin", { url });
        navEvent.preventDefault();
      }
    });
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
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
  hardenNavigation();
  createSplash();

  // Kick off the renderer load (createMainWindow -> loadURL) before the
  // synchronous DB/migrations/IPC setup below, instead of after it. Chromium
  // loads and parses the app bundle in its own renderer process, which takes
  // far longer than the handful of milliseconds better-sqlite3 + migrations
  // need on the main process — starting it first overlaps two phases of
  // startup that were previously paid for serially, shaving real time off
  // "app launch" to "usable UI". This is safe: the window stays hidden
  // (`show: false`) until 'ready-to-show', and the renderer's own JS can't
  // issue an IPC call until well after 'dom-ready' — long after
  // registerAllIpc() below has finished on this same synchronous tick.
  createMainWindow();

  initDatabaseAndServices();
  registerAllIpc();
  registerWindowIpc();
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
  stopBackgroundServices();
  destroyTray();
  try {
    // Neon sync currently unused — optional close when re-enabled.
    if (process.env.NEON_DATABASE_URL) {
      require("./database/neonSync.cjs").close();
    }
  } catch {
    /* optional */
  }
  closeConnection();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep running in tray unless quitting
    if (isQuitting) app.quit();
  }
});
