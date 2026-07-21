/**
 * Native desktop notifications + tray badge helpers.
 */
const { Notification, BrowserWindow } = require("electron");
const logger = require("./logger.cjs");

let unreadCount = 0;

function notify(title, body, options = {}) {
  try {
    if (!Notification.isSupported()) {
      logger.warn("Desktop notifications not supported");
      return false;
    }
    const n = new Notification({
      title,
      body,
      silent: options.silent === true,
      urgency: options.urgency || "normal",
    });
    if (typeof options.onClick === "function") {
      n.on("click", options.onClick);
    }
    n.show();
    if (options.countAsUnread !== false) {
      unreadCount += 1;
      broadcastUnread();
    }
    return true;
  } catch (err) {
    logger.error("Notification failed", { message: err.message });
    return false;
  }
}

function broadcastUnread() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("desktop:notification-count", unreadCount);
    }
  }
}

module.exports = {
  notify,
  getUnreadCount: () => unreadCount,
  clearUnread() {
    unreadCount = 0;
    broadcastUnread();
  },
  presets: {
    studentRegistered: (name) => notify("New student registered", name || "A new student was added"),
    paymentReceived: (amount) => notify("Payment received", amount ? `Amount: ${amount}` : "A payment was recorded"),
    attendanceSubmitted: () => notify("Attendance submitted", "Attendance was saved successfully"),
    payrollCompleted: () => notify("Payroll completed", "Payroll run finished"),
    examinationPublished: (title) => notify("Examination published", title || "Results are available"),
    backupCompleted: () => notify("Backup completed", "Local database backup finished", { countAsUnread: false }),
    syncCompleted: () => notify("Synchronization completed", "Offline changes were synced", { countAsUnread: false }),
    updateAvailable: (version) => notify("Software update available", version ? `Version ${version}` : "A new version is ready"),
  },
};
