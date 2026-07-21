# EduManage Desktop (Electron)

Secure Electron shell around the existing React School Management System.

## Layout

Electron entry files use `.cjs` because the root `package.json` sets `"type": "module"`. The folder map matches the planned architecture:

```text
electron/
├── main.cjs
├── preload.cjs
├── database/          # SQLite connection, migrations, backup, sync, models
├── ipc/               # Domain IPC handlers
├── printer/           # Receipts, reports, ID cards, certificates
├── hardware/          # Barcode, fingerprint, webcam, USB, serial
├── tray/
├── updater/
├── splash/
├── assets/
└── utils/
```

## Security

Browser windows use:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Preload-only bridge (`window.electronAPI`)

## Commands

```bash
npm install
npm run electron:rebuild   # native better-sqlite3 for Electron
npm run electron:dev       # Vite + Electron
npm run electron:build     # packaged installer
```

## Environment

| Variable | Purpose |
|---|---|
| `ELECTRON_SYNC_API_URL` | Laravel/compatible sync REST base URL |
| `ELECTRON_DB_ENCRYPTION_KEY` | Optional DB key (SQLCipher-compatible builds) |
| `ELECTRON_UPDATE_FEED_URL` | Generic auto-update feed |
| `ELECTRON_SIMULATE_FINGERPRINT=1` | Lab fingerprint simulator |
| `VITE_DEV_SERVER_URL` | Dev UI URL (default `http://localhost:8080`) |

## React usage

```ts
import { getDesktopAPI, isElectronDesktop, unwrapIpc } from "@/desktop";

if (isElectronDesktop()) {
  const api = getDesktopAPI()!;
  await unwrapIpc(api.printer.receipt({ studentName: "Ada", total: "100" }, { silent: true }));
}
```

Web builds are unchanged; the desktop shell only activates when `window.electronAPI` exists.

## Notes

- Offline SQLite stores core entities and a sync queue; changes sync when `ELECTRON_SYNC_API_URL` is reachable.
- USB/`serialport` are optional; install `usb` / `serialport` for live device APIs.
- Vendor fingerprint SDKs plug into `electron/hardware/fingerprint.cjs`.
