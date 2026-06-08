import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  // Absolute base for web hosting (Vercel, etc.). Deep routes like /teacher/report-cards
  // break with relative "./" because assets resolve under the URL path.
  // For Capacitor: npm run build:capacitor (sets VITE_RELATIVE_BASE=true)
  base: process.env.VITE_RELATIVE_BASE === "true" ? "./" : "/",
});
