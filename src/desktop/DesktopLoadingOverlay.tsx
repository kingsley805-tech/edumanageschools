import { useEffect, useState } from "react";
import { getDesktopAPI } from "./electronBridge";

/**
 * Short loading veil after splash until renderer reports ready services.
 */
export function DesktopLoadingOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const api = getDesktopAPI();
    const t = window.setTimeout(() => setVisible(false), 900);
    const off = api?.events.onReady(() => setVisible(false));
    return () => {
      window.clearTimeout(t);
      off?.();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-[#0b3d2e]/95 backdrop-blur-sm">
      <div className="text-center text-emerald-50">
        <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-xl bg-emerald-400/30" />
        <p className="text-sm tracking-wide">Loading workspace…</p>
      </div>
    </div>
  );
}
