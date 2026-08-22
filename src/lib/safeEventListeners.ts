/**
 * Capacitor/Cordova overrides document/window addEventListener and calls
 * `evt.toLowerCase()` before forwarding. If any caller passes null/undefined
 * as the event type, that throws:
 *   TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 *   at document.addEventListener.capture
 *
 * See: https://github.com/ionic-team/capacitor/issues/4178
 *
 * Uses defineProperty setters so Cordova cannot replace our guard later.
 * index.html runs the same bootstrap before React loads.
 */
export function installSafeEventListeners(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const w = window as unknown as Record<string, unknown>;
  w.__edumanage_safe_event_listeners__ = true;

  installHostGuard(document);
  installHostGuard(window);

  document.addEventListener("deviceready", () => {
    installHostGuard(document);
    installHostGuard(window);
  }, { once: true });
}

type GuardedHost = EventTarget & {
  addEventListener: EventTarget["addEventListener"];
  removeEventListener: EventTarget["removeEventListener"];
};

function installHostGuard(host: EventTarget): void {
  const h = host as GuardedHost & Record<string, unknown>;
  if (h.__edumanage_evt_guard_installed__) return;

  let addImpl = host.addEventListener.bind(host);
  let removeImpl = host.removeEventListener.bind(host);

  const guardedAdd = ((type: unknown, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (type == null || type === "") return;
    const eventType = typeof type === "string" || typeof type === "symbol" ? type : String(type);
    return addImpl(eventType as string, listener, options);
  }) as EventTarget["addEventListener"];

  const guardedRemove = ((type: unknown, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    if (type == null || type === "") return;
    const eventType = typeof type === "string" || typeof type === "symbol" ? type : String(type);
    return removeImpl(eventType as string, listener, options);
  }) as EventTarget["removeEventListener"];

  const define = (key: "addEventListener" | "removeEventListener", get: () => EventTarget[typeof key]) => {
    try {
      Object.defineProperty(host, key, {
        configurable: true,
        enumerable: true,
        get,
        set(next: EventTarget[typeof key]) {
          if (typeof next === "function") {
            if (key === "addEventListener") addImpl = next.bind(host);
            else removeImpl = next.bind(host);
          }
        },
      });
    } catch {
      host[key] = get();
    }
  };

  define("addEventListener", () => guardedAdd);
  define("removeEventListener", () => guardedRemove);

  h.__edumanage_evt_guard_installed__ = true;
}
