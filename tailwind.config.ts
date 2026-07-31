import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    /**
     * Component-layer classes that are composed at runtime (`table-status-${tone}`)
     * or belong to third-party markup (Recharts) are invisible to the content
     * scanner and would be purged. Declaring them here keeps the rules in
     * index.css alive without moving them out of @layer components — so
     * per-element Tailwind utilities still win over them.
     */
    {
      raw: [
        "table-status table-status-success table-status-warning",
        "table-status-danger table-status-info table-status-neutral",
        "table-status-dot table-skeleton-bar table-empty table-loading",
        "cell-stack cell-primary cell-secondary cell-with-icon cell-icon",
        "cell-muted cell-empty cell-actions btn-dim btn-dim-danger",
        "portal-nav-drawer portal-ticker-wrap portal-ticker-track",
        "portal-tick portal-tick-tag",
        "data-table data-table-compact data-table-shell data-table-shell-bare",
        "recharts-cartesian-grid recharts-cartesian-axis-line",
        "recharts-cartesian-axis-tick-line recharts-cartesian-axis-tick-value",
        "recharts-label recharts-legend-item-text recharts-tooltip-wrapper",
        "recharts-default-tooltip recharts-tooltip-item recharts-tooltip-label",
        "recharts-surface recharts-wrapper",
        "custom-scrollbar modal-scrollbar portal-main-scroll theme-ready",
      ].join(" "),
      extension: "html",
    },
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2rem",
        "2xl": "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        /* `display` and `report` are kept as aliases so the ~100 existing
           font-display / font-report usages keep working — they now all
           resolve to Inter for a single-family type system. */
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        report: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        /**
         * Global "green" remap to the new status-chip palette.
         * This makes existing `green-*` utilities adopt the updated brand tone.
         */
        green: {
          50: "#ecfdf5",
          100: "#def7ec",
          200: "#b7ebd5",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#065f46",
          800: "#064e3b",
          900: "#022c22",
        },
        emerald: {
          50: "#ecfdf5",
          100: "#def7ec",
          200: "#b7ebd5",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#065f46",
          800: "#064e3b",
          900: "#022c22",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        /* mingo aliases — prefer these over one-off hex */
        bg: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        ink: "hsl(var(--foreground))",
        "ink-soft": "hsl(var(--ink-soft))",
        "ink-faint": "hsl(var(--ink-faint))",
        line: "hsl(var(--border))",
        "line-strong": "hsl(var(--line-strong))",
        critical: "hsl(var(--critical))",
        "critical-bg": "hsl(var(--critical-bg))",
        warn: "hsl(var(--warn))",
        "warn-bg": "hsl(var(--warn-bg))",
        positive: "hsl(var(--positive))",
        "positive-bg": "hsl(var(--positive-bg))",
        "info-bg": "hsl(var(--info-bg))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
      },
      boxShadow: {
        xs: "var(--shadow-sm)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        inner: "var(--shadow-inner)",
        glow: "var(--shadow-glow)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-up": "fade-up 0.6s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-in": "slide-in 0.4s ease-out",
        shimmer: "shimmer 1.6s infinite linear",
        "spin-slow": "spin-slow 6s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
