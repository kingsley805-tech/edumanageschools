import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function googleSiteVerificationPlugin() {
  return {
    name: "google-site-verification",
    transformIndexHtml(html: string) {
      const token = process.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
      if (!token) return html;
      const tag = `<meta name="google-site-verification" content="${token}" />`;
      if (html.includes("google-site-verification")) return html;
      return html.replace("</head>", `    ${tag}\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const electronMode =
    mode === "electron" ||
    mode === "capacitor" ||
    process.env.VITE_RELATIVE_BASE === "true";

  return {
    server: {
      host: "::",
      port: 5173,
      strictPort: false,
    },
    plugins: [react(), googleSiteVerificationPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    // Absolute base for web hosting (Vercel, etc.). Deep routes like /teacher/report-cards
    // break with relative "./" because assets resolve under the URL path.
    // For Capacitor / Electron: relative base so file:// and packaged assets resolve.
    base: electronMode ? "./" : "/",
  };
});
