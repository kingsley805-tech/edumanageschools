/**
 * Secure preload bridge — the only surface exposed to React.
 * No Node APIs are leaked; all capability flows through IPC.
 */
const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

function on(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  isElectron: true,
  platform: process.platform,

  window: {
    minimize: () => invoke("window:minimize"),
    maximize: () => invoke("window:maximize"),
    close: () => invoke("window:close"),
    isMaximized: () => invoke("window:isMaximized"),
    toggleFullScreen: () => invoke("window:toggleFullScreen"),
    openChild: (route, options) => invoke("window:openChild", route, options),
  },

  student: {
    list: (params) => invoke("student:list", params),
    get: (id) => invoke("student:get", id),
    upsert: (record) => invoke("student:upsert", record),
    delete: (id) => invoke("student:delete", id),
  },

  attendance: {
    list: (params) => invoke("attendance:list", params),
    upsert: (record) => invoke("attendance:upsert", record),
    delete: (id) => invoke("attendance:delete", id),
  },

  finance: {
    list: (params) => invoke("finance:list", params),
    get: (id) => invoke("finance:get", id),
    upsert: (record) => invoke("finance:upsert", record),
    delete: (id) => invoke("finance:delete", id),
  },

  payroll: {
    list: (params) => invoke("payroll:list", params),
    upsert: (record) => invoke("payroll:upsert", record),
    delete: (id) => invoke("payroll:delete", id),
  },

  inventory: {
    list: (params) => invoke("inventory:list", params),
    upsert: (record) => invoke("inventory:upsert", record),
    delete: (id) => invoke("inventory:delete", id),
    findByBarcode: (barcode) => invoke("inventory:findByBarcode", barcode),
  },

  printer: {
    list: () => invoke("printer:list"),
    receipt: (data, options) => invoke("printer:receipt", data, options),
    report: (type, data, options) => invoke("printer:report", type, data, options),
    idCard: (data, options) => invoke("printer:idCard", data, options),
    certificate: (data, options) => invoke("printer:certificate", data, options),
  },

  files: {
    open: (options) => invoke("files:open", options),
    save: (payload) => invoke("files:save", payload),
    saveAs: (payload) => invoke("files:saveAs", payload),
    export: (payload) => invoke("files:export", payload),
    importText: (options) => invoke("files:importText", options),
    saveDocument: (payload) => invoke("files:saveDocument", payload),
    listDocuments: (category) => invoke("files:listDocuments", category),
    compress: (payload) => invoke("files:compress", payload),
    showInFolder: (filePath) => invoke("files:showInFolder", filePath),
    getPaths: () => invoke("files:getPaths"),
  },

  scanner: {
    ingest: (raw, meta) => invoke("scanner:ingest", raw, meta),
    last: () => invoke("scanner:last"),
    onScan: (cb) => on("hardware:scan", cb),
  },

  biometric: {
    fingerprintStatus: () => invoke("biometric:fingerprintStatus"),
    enroll: (userId) => invoke("biometric:enroll", userId),
    verify: (userId) => invoke("biometric:verify", userId),
    capture: (opts) => invoke("biometric:capture", opts),
    simulate: (enabled) => invoke("biometric:simulate", enabled),
    savePhoto: (payload) => invoke("biometric:savePhoto", payload),
  },

  hardware: {
    usbList: () => invoke("hardware:usbList"),
    serialList: () => invoke("hardware:serialList"),
    serialOpen: (portPath, opts) => invoke("hardware:serialOpen", portPath, opts),
    serialWrite: (portPath, data) => invoke("hardware:serialWrite", portPath, data),
    serialClose: (portPath) => invoke("hardware:serialClose", portPath),
    onUsb: (cb) => on("hardware:usb", cb),
    cashDrawerOpen: (portPath, opts) => invoke("hardware:cashDrawerOpen", portPath, opts),
  },

  backup: {
    create: (opts) => invoke("backup:create", opts),
    restore: (backupPath) => invoke("backup:restore", backupPath),
    list: () => invoke("backup:list"),
    syncNow: (opts) => invoke("backup:syncNow", opts),
    syncStatus: () => invoke("backup:syncStatus"),
    syncFailedItems: (limit) => invoke("backup:syncFailedItems", limit),
    syncPendingItems: (limit) => invoke("backup:syncPendingItems", limit),
    syncLogs: (limit) => invoke("backup:syncLogs", limit),
    setAuthToken: (token) => invoke("backup:setAuthToken", token),
  },

  updater: {
    check: () => invoke("updater:check"),
    install: () => invoke("updater:install"),
    onStatus: (cb) => on("updater:status", cb),
  },

  notify: {
    clearUnread: () => invoke("notify:clearUnread"),
    getUnread: () => invoke("notify:getUnread"),
  },

  events: {
    onSyncStatus: (cb) => on("desktop:sync-status", cb),
    onNavigate: (cb) => on("desktop:navigate", cb),
    onNotificationCount: (cb) => on("desktop:notification-count", cb),
    onReady: (cb) => on("desktop:ready", cb),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
