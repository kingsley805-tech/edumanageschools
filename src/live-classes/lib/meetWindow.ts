const MEET_WINDOW_NAME = "eduManageMeet";
const WIN_KEY = "__eduManageMeetWindow";

type WindowWithMeet = Window & { [WIN_KEY]?: Window | null };

function meetWindowFeatures(): string {
  const width = Math.min(window.screen.availWidth - 48, 1280);
  const height = Math.min(window.screen.availHeight - 48, 860);
  const left = Math.round((window.screen.availWidth - width) / 2);
  const top = Math.round((window.screen.availHeight - height) / 2);
  return [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "menubar=no",
    "toolbar=no",
    "location=yes",
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

function getStoredMeetWindow(): Window | null {
  const win = (window as WindowWithMeet)[WIN_KEY];
  if (!win || win.closed) {
    (window as WindowWithMeet)[WIN_KEY] = null;
    return null;
  }
  return win;
}

/** Opens or focuses the shared Google Meet window (reuses the same named window). */
export function openMeetWindow(url: string): Window | null {
  const existing = getStoredMeetWindow();
  if (existing) {
    existing.focus();
    return existing;
  }

  const win = window.open(url, MEET_WINDOW_NAME, meetWindowFeatures());
  if (win) {
    (window as WindowWithMeet)[WIN_KEY] = win;
    win.focus();
  }
  return win;
}

/** Focus the Meet window if it is still open. */
export function focusMeetWindow(): boolean {
  const win = getStoredMeetWindow();
  if (!win) return false;
  win.focus();
  return true;
}
