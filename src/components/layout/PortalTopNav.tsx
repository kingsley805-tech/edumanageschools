import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";

type NavEntry = AdminNavItem | AdminNavGroup;

type Props = {
  items: NavEntry[];
  unreadMessages?: number;
  className?: string;
};

const DASHBOARD_PATHS = new Set([
  "/admin",
  "/teacher",
  "/parent",
  "/student",
  "/accountant",
  "/auditor",
]);

/** Width reserved for the "More" trigger when entries overflow. */
const MORE_TRIGGER_WIDTH = 104;

function isGroup(item: NavEntry): item is AdminNavGroup {
  return "items" in item;
}

function pathIsActive(pathname: string, path: string) {
  if (DASHBOARD_PATHS.has(path)) return pathname === path;
  return pathname === path || pathname.startsWith(path + "/");
}

function entryIsActive(pathname: string, entry: NavEntry) {
  if (isGroup(entry)) {
    return entry.items.some((sub) => pathIsActive(pathname, sub.path));
  }
  return pathIsActive(pathname, entry.path);
}

/** Split a group's links into balanced columns (≤8 rows per column, ≤3 columns). */
function toColumns(items: AdminNavItem[]) {
  const columns = Math.min(3, Math.max(1, Math.ceil(items.length / 8)));
  const perColumn = Math.ceil(items.length / columns);
  return Array.from({ length: columns }, (_, i) =>
    items.slice(i * perColumn, (i + 1) * perColumn),
  ).filter((column) => column.length > 0);
}

/**
 * Desktop horizontal navigation.
 * Standalone entries render as inline links; groups open a multi-column
 * mega-menu. Entries that don't fit the bar collapse into a "More" menu.
 */
export function PortalTopNav({ items, unreadMessages = 0, className }: Props) {
  const location = useLocation();
  const barRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [alignEnd, setAlignEnd] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const keyFor = useCallback(
    (entry: NavEntry, index: number) =>
      isGroup(entry) ? `g:${entry.label}:${index}` : `i:${entry.path}:${index}`,
    [],
  );

  /* ---- overflow measurement --------------------------------------------- */
  // A hidden "ghost" row always renders every entry at its natural width, so
  // measurements stay correct no matter how many entries are currently shown.

  const measure = useCallback(() => {
    const bar = barRef.current;
    const ghost = ghostRef.current;
    if (!bar || !ghost) return;

    const available = bar.clientWidth;
    const widths = Array.from(ghost.children).map(
      (child) => (child as HTMLElement).offsetWidth,
    );
    if (!widths.length) return;

    const total = widths.reduce((sum, width) => sum + width, 0);
    if (total <= available) {
      setVisibleCount(widths.length);
      return;
    }

    let used = 0;
    let count = 0;
    for (const width of widths) {
      if (used + width > available - MORE_TRIGGER_WIDTH) break;
      used += width;
      count += 1;
    }
    setVisibleCount(Math.max(1, count));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [items, measure]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(bar);
    return () => observer.disconnect();
  }, [measure]);

  /* ---- open / close ------------------------------------------------------ */

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 150);
  }, [cancelClose]);

  const open = useCallback(
    (key: string, trigger: HTMLElement | null) => {
      cancelClose();
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        setAlignEnd(rect.left > window.innerWidth * 0.55);
      }
      setOpenKey(key);
    },
    [cancelClose],
  );

  useEffect(() => () => cancelClose(), [cancelClose]);

  // Close whenever the route changes.
  useEffect(() => {
    setOpenKey(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openKey]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const overflowItems = useMemo(
    () => items.slice(visibleCount),
    [items, visibleCount],
  );
  const overflowActive = overflowItems.some((entry) =>
    entryIsActive(location.pathname, entry),
  );
  const moreOpen = openKey === "more";

  if (!items.length) return null;

  /* ---- renderers --------------------------------------------------------- */

  const panelLink = (sub: AdminNavItem) => (
    <NavLink
      key={sub.path}
      to={sub.path}
      role="menuitem"
      className="portal-topnav-panel-link"
      activeClassName="portal-topnav-panel-link-active"
      onClick={() => setOpenKey(null)}
    >
      <sub.icon className="portal-topnav-panel-icon h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{sub.label}</span>
      {sub.showBadge && unreadMessages > 0 ? (
        <Badge
          variant="destructive"
          className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center px-1 text-[10px]"
        >
          {unreadMessages > 9 ? "9+" : unreadMessages}
        </Badge>
      ) : null}
    </NavLink>
  );

  return (
    <nav
      className={cn("portal-topnav relative min-w-0 flex-1", className)}
      aria-label="Main navigation"
    >
      {/* Hidden measurement row — never visible, never focusable. */}
      <div
        ref={ghostRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 flex h-0 select-none items-stretch gap-0.5 overflow-hidden opacity-0"
      >
        {items.map((entry, index) => (
          <span
            key={`ghost-${keyFor(entry, index)}`}
            className="portal-topnav-trigger shrink-0"
          >
            <span className="h-4 w-4 shrink-0" />
            <span>{entry.label}</span>
            {isGroup(entry) ? <span className="h-3.5 w-3.5 shrink-0" /> : null}
          </span>
        ))}
      </div>

      <div ref={barRef} className="relative flex items-stretch gap-0.5">
        {visibleItems.map((entry, index) => {
          const key = keyFor(entry, index);
          const active = entryIsActive(location.pathname, entry);
          const isOpen = openKey === key;

          if (!isGroup(entry)) {
            return (
              <div key={key} className="relative shrink-0">
                <NavLink
                  to={entry.path}
                  end={DASHBOARD_PATHS.has(entry.path)}
                  className="portal-topnav-trigger"
                  activeClassName="portal-topnav-trigger-active"
                >
                  <entry.icon className="portal-topnav-trigger-icon h-4 w-4 shrink-0" />
                  <span className="truncate">{entry.label}</span>
                  {entry.showBadge && unreadMessages > 0 ? (
                    <Badge
                      variant="destructive"
                      className="flex h-4 min-w-4 shrink-0 items-center justify-center px-1 text-[10px]"
                    >
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </Badge>
                  ) : null}
                </NavLink>
              </div>
            );
          }

          return (
            <div
              key={key}
              className="relative shrink-0"
              onMouseEnter={(event) => open(key, event.currentTarget)}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                className={cn(
                  "portal-topnav-trigger",
                  active && "portal-topnav-trigger-active",
                  isOpen && "portal-topnav-trigger-open",
                )}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={(event) =>
                  isOpen
                    ? setOpenKey(null)
                    : open(key, event.currentTarget.parentElement)
                }
              >
                <entry.icon className="portal-topnav-trigger-icon h-4 w-4 shrink-0" />
                <span className="truncate">{entry.label}</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "portal-topnav-chevron h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen ? (
                <div
                  className={cn(
                    "portal-topnav-panel absolute top-full z-50 mt-px flex gap-1 p-2",
                    alignEnd ? "right-0" : "left-0",
                  )}
                  role="menu"
                  aria-label={entry.label}
                >
                  {toColumns(entry.items).map((column, columnIndex) => (
                    <div
                      key={columnIndex}
                      className="flex min-w-[228px] flex-col gap-px"
                    >
                      {column.map(panelLink)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {overflowItems.length > 0 ? (
          <div
            className="relative shrink-0"
            onMouseEnter={(event) => open("more", event.currentTarget)}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              className={cn(
                "portal-topnav-trigger",
                overflowActive && "portal-topnav-trigger-active",
                moreOpen && "portal-topnav-trigger-open",
              )}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setOpenKey(moreOpen ? null : "more")}
            >
              <MoreHorizontal className="portal-topnav-trigger-icon h-4 w-4 shrink-0" />
              <span>More</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "portal-topnav-chevron h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                  moreOpen && "rotate-180",
                )}
              />
            </button>

            {moreOpen ? (
              <div
                className="portal-topnav-panel absolute right-0 top-full z-50 mt-px grid max-h-[72vh] w-max max-w-[min(680px,calc(100vw-3rem))] grid-cols-2 gap-x-4 gap-y-3 overflow-y-auto p-3"
                role="menu"
                aria-label="More navigation"
              >
                {overflowItems.map((entry, index) => (
                  <div
                    key={`more-${keyFor(entry, index)}`}
                    className="flex min-w-[214px] flex-col gap-px"
                  >
                    <p className="portal-topnav-panel-heading">{entry.label}</p>
                    {isGroup(entry)
                      ? entry.items.map(panelLink)
                      : panelLink(entry)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
