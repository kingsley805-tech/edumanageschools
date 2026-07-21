/**
 * System tray with quick actions and live status.
 */
const { Tray, Menu, nativeImage, BrowserWindow, app } = require("electron");
const path = require("path");
const paths = require("../utils/paths.cjs");
const sync = require("../database/sync.cjs");
const notifications = require("../utils/notifications.cjs");
const logger = require("../utils/logger.cjs");

let tray = null;

function buildTooltip() {
  const status = sync.getStatus();
  const unread = notifications.getUnreadCount();
  const net = status.online ? "Online" : "Offline";
  const syncLabel = status.lastError ? `Sync: ${status.lastError}` : `Pending: ${status.pending}`;
  return `EduManage Desktop\n${net} · ${syncLabel}\nNotifications: ${unread}`;
}

function navigate(route) {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  win.show();
  win.focus();
  win.webContents.send("desktop:navigate", route);
}

function createTray({ onOpen, onQuit } = {}) {
  if (tray) return tray;

  const iconPath = paths.getIconPath();
  let image = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (image.isEmpty()) {
    // 16x16 simple fallback
    image = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFElEQVQ4T2NkYGD4z0BUYGxgYGAAAAD//wMAAfYBmiQAAAAASUVORK5CYII=",
    );
  }
  if (process.platform === "win32") {
    image = image.resize({ width: 16, height: 16 });
  }

  tray = new Tray(image);
  tray.setToolTip(buildTooltip());

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Dashboard", click: () => (onOpen ? onOpen() : navigate("/admin")) },
    { label: "Attendance", click: () => navigate("/admin/attendance") },
    { label: "Finance", click: () => navigate("/billing") },
    { type: "separator" },
    {
      label: "Sync Now",
      click: () => {
        sync.runSync().then(() => refreshTray());
      },
    },
    {
      label: "Clear Notifications",
      click: () => {
        notifications.clearUnread();
        refreshTray();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        if (onQuit) onQuit();
        else app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => (onOpen ? onOpen() : navigate("/admin")));

  setInterval(refreshTray, 10_000).unref?.();
  logger.info("System tray ready");
  return tray;
}

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(buildTooltip());
}

function destroyTray() {
  if (tray) tray.destroy();
  tray = null;
}

module.exports = { createTray, refreshTray, destroyTray, navigate };
