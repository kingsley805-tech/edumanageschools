import { useEffect, useState, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { getDesktopAPI, isElectronDesktop } from "./electronBridge";
import { cn } from "@/lib/utils";

/**
 * Frameless custom title bar for the Electron shell.
 */
export function DesktopTitleBar({ className }: { className?: string }) {
  const api = getDesktopAPI();
  const [maximized, setMaximized] = useState(true);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!api) return;
    api.window.isMaximized().then(setMaximized).catch(() => {});
    const off = api.events.onSyncStatus((status: unknown) => {
      const s = status as { online?: boolean; pending?: number };
      if (typeof s?.online === "boolean") setOnline(s.online);
      if (typeof s?.pending === "number") setPending(s.pending);
    });
    api.backup.syncStatus().then((res) => {
      if (res.ok && res.data) {
        const s = res.data as { online?: boolean; pending?: number };
        if (typeof s.online === "boolean") setOnline(s.online);
        if (typeof s.pending === "number") setPending(s.pending);
      }
    });
    return off;
  }, [api]);

  if (!isElectronDesktop() || !api) return null;

  return (
    <div
      className={cn(
        "electron-titlebar sticky top-0 z-[100] flex h-9 items-center justify-between border-b border-emerald-900/30 bg-[#0b3d2e] text-emerald-50 select-none",
        className,
      )}
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div className="flex items-center gap-2 px-3 text-xs font-medium tracking-wide">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-400/20 text-[10px] font-bold">
          E
        </span>
        <span>EduManage Desktop</span>
        <span
          className={cn(
            "ml-2 rounded px-1.5 py-0.5 text-[10px]",
            online ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-100",
          )}
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          {online ? "Online" : "Offline"}
          {pending > 0 ? ` · ${pending} pending` : ""}
        </span>
      </div>

      <div
        className="flex h-full items-stretch"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <TitleBtn aria-label="Minimize" onClick={() => api.window.minimize()}>
          <Minus className="h-3.5 w-3.5" />
        </TitleBtn>
        <TitleBtn
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={async () => {
            await api.window.maximize();
            setMaximized(await api.window.isMaximized());
          }}
        >
          {maximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </TitleBtn>
        <TitleBtn aria-label="Close" danger onClick={() => api.window.close()}>
          <X className="h-3.5 w-3.5" />
        </TitleBtn>
      </div>
    </div>
  );
}

function TitleBtn({
  children,
  onClick,
  danger,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-11 items-center justify-center transition-colors hover:bg-white/10",
        danger && "hover:bg-red-600 hover:text-white",
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
