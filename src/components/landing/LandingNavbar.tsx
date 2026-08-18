import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { EduManageLogo } from "@/components/EduManageLogo";
import { landingPalette } from "@/components/landing/landingPalette";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Partners", href: "#partners" },
];

export default function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      className="relative z-50 shrink-0 px-4 pt-4 sm:px-6 lg:px-8"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/15 bg-black/80 px-4 py-2.5 shadow-lg shadow-black/40 backdrop-blur-xl sm:px-5">
        <EduManageLogo imgClassName="h-9 sm:h-10 brightness-0 invert drop-shadow-sm" />

        <motion.div
          className="hidden items-center gap-8 md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {navLinks.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-white/70 transition-colors hover:text-blue-300"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-medium text-white/70 transition-colors hover:text-blue-300"
              >
                {link.label}
              </Link>
            ),
          )}
          <Link
            to="/auth"
            className="text-sm font-medium text-white/70 transition-colors hover:text-blue-300"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${landingPalette.btnPrimary}`}
          >
            Get Started
          </Link>
        </motion.div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen ? (
        <motion.div
          className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/15 bg-black/95 p-4 backdrop-blur-xl md:hidden"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col gap-3">
            {navLinks.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-white/80"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm font-medium text-white/80"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}
            <Link to="/auth" className="text-sm font-medium text-white/80" onClick={() => setMobileOpen(false)}>
              Sign in
            </Link>
            <Link
              to="/auth"
              className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${landingPalette.btnPrimary}`}
              onClick={() => setMobileOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </motion.div>
      ) : null}
    </motion.header>
  );
}
