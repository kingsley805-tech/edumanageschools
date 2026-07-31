import { useEffect, useRef, type DependencyList } from "react";
import { getDesktopAPI, isElectronDesktop } from "./electronBridge";

export type BarcodeScan = {
  value: string;
  type: "barcode" | "qr" | string;
  purpose: string;
  at: string;
};

/**
 * Subscribes to hardware barcode/QR scans broadcast over Electron IPC
 * (`electron/hardware/barcode.cjs` -> `hardware:scan`).
 *
 * This is a *second*, complementary path to the far more common one: most
 * USB barcode scanners are configured as HID keyboard-emulation devices, so
 * they "type" straight into whatever text input has focus (see
 * InventoryBarcodeLookup) and need no Electron wiring at all. This hook
 * covers scans that don't arrive that way — a scanner wired through
 * `hardware:serialOpen`/serial passthrough, a companion window forwarding a
 * scan via `scanner:ingest`, or a scan that should be actionable regardless
 * of which input currently has focus. No-ops on web / outside Electron.
 */
export function useBarcodeScan(onScan: (scan: BarcodeScan) => void, deps: DependencyList = []) {
  const handlerRef = useRef(onScan);
  handlerRef.current = onScan;

  useEffect(() => {
    if (!isElectronDesktop()) return;
    const api = getDesktopAPI();
    if (!api) return;
    return api.scanner.onScan((scan) => handlerRef.current(scan as BarcodeScan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
