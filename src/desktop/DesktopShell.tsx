import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DesktopTitleBar } from "./DesktopTitleBar";
import { DesktopLoadingOverlay } from "./DesktopLoadingOverlay";
import { getDesktopAPI, isElectronDesktop } from "./electronBridge";

/**
 * Desktop chrome + tray navigation wiring. Renders children unchanged on web.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const desktop = isElectronDesktop();

  useEffect(() => {
    if (!desktop) return;
    const api = getDesktopAPI();
    if (!api) return;

    document.documentElement.classList.add("electron-desktop");

    const offNav = api.events.onNavigate((route) => {
      if (typeof route === "string" && route) navigate(route);
    });

    return () => {
      offNav();
      document.documentElement.classList.remove("electron-desktop");
    };
  }, [desktop, navigate]);

  if (!desktop) return <>{children}</>;

  return (
    <div className="electron-shell flex min-h-screen flex-col">
      <DesktopTitleBar />
      <DesktopLoadingOverlay />
      <div className="electron-shell-content relative min-h-0 flex-1">{children}</div>
    </div>
  );
}
