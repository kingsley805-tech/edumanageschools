import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyBrandTheme, BRAND_DEFAULTS } from "./lib/themeColors";
import { RootErrorBoundary } from "./components/RootErrorBoundary";

const THEME_IDS = ["default", "dark", "blue", "purple", "green", "custom"] as const;
type BootTheme = (typeof THEME_IDS)[number];

const raw =
  typeof window !== "undefined" ? localStorage.getItem("theme") || "default" : "default";
const bootTheme: BootTheme = THEME_IDS.includes(raw as BootTheme)
  ? (raw as BootTheme)
  : "default";

document.documentElement.classList.remove(
  "dark",
  "blue",
  "purple",
  "green",
  "custom",
);

if (bootTheme === "default") {
  applyBrandTheme(BRAND_DEFAULTS);
} else {
  document.documentElement.classList.add(bootTheme);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const root = document.getElementById("root")!;

if (!supabaseUrl || !supabaseKey) {
  createRoot(root).render(
    <div className="min-h-screen flex items-center justify-center p-6 font-sans">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-lg font-semibold">Configuration missing</h1>
        <p className="text-sm text-muted-foreground">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your
          hosting environment (e.g. Vercel project settings), then redeploy.
        </p>
      </div>
    </div>,
  );
} else {
  createRoot(root).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>,
  );
}
