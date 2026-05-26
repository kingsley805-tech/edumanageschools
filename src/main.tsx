import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyBrandTheme, BRAND_DEFAULTS } from "./lib/themeColors";

applyBrandTheme(BRAND_DEFAULTS);

createRoot(document.getElementById("root")!).render(<App />);
