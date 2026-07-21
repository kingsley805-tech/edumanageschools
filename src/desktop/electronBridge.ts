/**
 * Typed bridge to Electron preload API. Safe no-ops when running in the browser.
 */
export type IpcResult<T> = {
  ok: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export type ElectronAPI = {
  isElectron: true;
  platform: string;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    toggleFullScreen: () => Promise<boolean>;
    openChild: (route: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
  student: {
    list: (params?: Record<string, unknown>) => Promise<IpcResult<unknown[]>>;
    get: (id: string) => Promise<IpcResult<unknown>>;
    upsert: (record: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    delete: (id: string) => Promise<IpcResult<unknown>>;
  };
  attendance: {
    list: (params?: Record<string, unknown>) => Promise<IpcResult<unknown[]>>;
    upsert: (record: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    delete: (id: string) => Promise<IpcResult<unknown>>;
  };
  finance: {
    list: (params?: Record<string, unknown>) => Promise<IpcResult<unknown[]>>;
    get: (id: string) => Promise<IpcResult<unknown>>;
    upsert: (record: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    delete: (id: string) => Promise<IpcResult<unknown>>;
  };
  payroll: {
    list: (params?: Record<string, unknown>) => Promise<IpcResult<unknown[]>>;
    upsert: (record: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    delete: (id: string) => Promise<IpcResult<unknown>>;
  };
  inventory: {
    list: (params?: Record<string, unknown>) => Promise<IpcResult<unknown[]>>;
    upsert: (record: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    delete: (id: string) => Promise<IpcResult<unknown>>;
    findByBarcode: (barcode: string) => Promise<IpcResult<unknown>>;
  };
  printer: {
    list: () => Promise<IpcResult<unknown[]>>;
    receipt: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    report: (
      type: string,
      data: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<IpcResult<unknown>>;
    idCard: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    certificate: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
  };
  files: {
    open: (options?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    save: (payload: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    saveAs: (payload: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    export: (payload: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    importText: (options?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    saveDocument: (payload: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    listDocuments: (category?: string) => Promise<IpcResult<unknown[]>>;
    compress: (payload: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    showInFolder: (filePath: string) => Promise<IpcResult<unknown>>;
    getPaths: () => Promise<IpcResult<Record<string, string>>>;
  };
  scanner: {
    ingest: (raw: string, meta?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    last: () => Promise<IpcResult<unknown>>;
    onScan: (cb: (scan: unknown) => void) => () => void;
  };
  biometric: {
    fingerprintStatus: () => Promise<IpcResult<unknown>>;
    enroll: (userId: string) => Promise<IpcResult<unknown>>;
    verify: (userId: string) => Promise<IpcResult<unknown>>;
    capture: (opts?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    simulate: (enabled?: boolean) => Promise<IpcResult<unknown>>;
    savePhoto: (payload: Record<string, unknown>) => Promise<IpcResult<unknown>>;
  };
  hardware: {
    usbList: () => Promise<IpcResult<unknown[]>>;
    serialList: () => Promise<IpcResult<unknown[]>>;
    serialOpen: (portPath: string, opts?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    serialWrite: (portPath: string, data: string | Buffer) => Promise<IpcResult<unknown>>;
    serialClose: (portPath: string) => Promise<IpcResult<unknown>>;
    onUsb: (cb: (payload: unknown) => void) => () => void;
  };
  backup: {
    create: (opts?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    restore: (backupPath: string) => Promise<IpcResult<unknown>>;
    list: () => Promise<IpcResult<unknown[]>>;
    syncNow: (opts?: Record<string, unknown>) => Promise<IpcResult<unknown>>;
    syncStatus: () => Promise<IpcResult<unknown>>;
  };
  updater: {
    check: () => Promise<unknown>;
    install: () => Promise<unknown>;
    onStatus: (cb: (payload: unknown) => void) => () => void;
  };
  notify: {
    clearUnread: () => Promise<unknown>;
    getUnread: () => Promise<number>;
  };
  events: {
    onSyncStatus: (cb: (payload: unknown) => void) => () => void;
    onNavigate: (cb: (route: string) => void) => () => void;
    onNotificationCount: (cb: (count: number) => void) => () => void;
    onReady: (cb: (payload: unknown) => void) => () => void;
  };
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function isElectronDesktop(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.isElectron;
}

export function getDesktopAPI(): ElectronAPI | null {
  return isElectronDesktop() ? window.electronAPI! : null;
}

export async function unwrapIpc<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise;
  if (!result?.ok) {
    throw new Error(result?.error?.message || "Desktop IPC failed");
  }
  return result.data as T;
}
