/** Product branding (landing, auth, portal shell). */
export const APP_NAME = "Edu Report";

export const APP_LOGO_URL = "/eduReport-removebg-preview.png";

export const APP_TAGLINE = "Modern school reports, analytics, and parent communication.";

/** Logo URL for marketing/auth components (SchoolLogo). */
export const SCHOOL_LOGO_URL = APP_LOGO_URL;

/** Default name on printable report cards when a school has no custom name. */
export const SCHOOL_DISPLAY_NAME = "Shepherd's Heart School";

export const SCHOOL_MOTTO = '"Those Led By Love Will Never Lose Their Way"';

/** Internal localStorage keys — keep stable (no apostrophes). */
export const STORAGE_KEYS = {
  theme: "scholaris.theme",
  intendedRole: "scholaris.intended_role",
  pendingAdmission: "scholaris.pending_admission",
} as const;
