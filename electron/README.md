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
- `usb` and `serialport` are regular dependencies (used for barcode/USB device enumeration and serial cash-drawer/printer control). Run `npm run electron:rebuild` after install so their native bindings match Electron's ABI.
- Vendor fingerprint SDKs plug into `electron/hardware/fingerprint.cjs`.

## Packaging (`electron-builder.json`)

- `files` explicitly lists `node_modules/**/*`. electron-builder does **not** fall back to its default file set once you supply a custom `files` array — omitting `node_modules` here means production dependencies (`better-sqlite3`, `electron-updater`, `serialport`, `usb`) silently don't ship in the packaged app, and every module falls back to its degraded/stub mode (in-memory DB, no updater, no hardware) with no visible error. Keep `node_modules/**/*` in this list.
- `asarUnpack` unpacks native `.node` binaries (`better-sqlite3`, `serialport`, `usb`, and their transitive native deps) — code cannot execute a native addon from inside the `asar` archive, it must be unpacked.
- `publish` must point at wherever you actually host update artifacts (`latest.yml` / `latest-mac.yml` / `latest-linux.yml` + installers). The `https://updates.example.com/...` value here is a placeholder so `electron-builder` still generates those update metadata files during `electron:build` — replace it with your real host (or your CI's `--publish` flag) before shipping. `ELECTRON_UPDATE_FEED_URL` overrides the feed URL at runtime via `autoUpdater.setFeedURL()`, but that only matters if the metadata files exist at that URL in the first place.
