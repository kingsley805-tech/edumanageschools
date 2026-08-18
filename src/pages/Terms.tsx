import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  ShieldCheck,
  Scale,
  CreditCard,
  AlertCircle,
  Mail,
  Phone,
  ArrowRight,
  Shield,
} from "lucide-react";
import { EduManageLogo } from "@/components/EduManageLogo";

export default function Terms() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative min-h-screen w-full bg-[#050811] text-slate-100 selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden font-sans antialiased">
      {/* Background Ambience */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full bg-indigo-600/15 blur-[130px]" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-emerald-600/10 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050811]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <EduManageLogo size="md" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Platform Overview
              </Link>
              <Link
                to="/privacy"
                className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Privacy & Security
              </Link>
              <Link
                to="/contact"
                className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Contact & Support
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white shadow-xs backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/25 active:scale-95"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/35 hover:brightness-110 active:scale-95"
            >
              Get Started
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 backdrop-blur-md mb-4 shadow-xs"
          >
            <img src="/assets/edumanageLogo.png" alt="EduManage" className="size-4 object-contain" />
            Legal & Acceptable Service Agreement
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            Terms of{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
              Platform Service
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed"
          >
            Last Revised: <span className="font-semibold text-white">{lastUpdated}</span> · Governing acceptable cloud usage, financial processing, and data custody across EduManage.
          </motion.p>
        </div>

        {/* Structured Terms Document */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-3xl border border-white/10 bg-[#0b0f1d]/90 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-8 text-slate-200 text-xs sm:text-sm leading-relaxed"
        >
          <section className="space-y-3 pb-6 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-bold text-blue-300 flex items-center gap-2">
              <FileText className="size-4 text-blue-400" />
              1. Acceptance of Terms & Cloud Services
            </h2>
            <p className="text-white/80">
              By accessing, registering an institution with, or using the EduManage platform, you agree to be bound by these Terms of Service. These terms apply to school administrators, teachers, parents, students, and system owners.
            </p>
          </section>

          <section className="space-y-3 pb-6 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-bold text-emerald-300 flex items-center gap-2">
              <CreditCard className="size-4 text-emerald-400" />
              2. Billing, Fee Collection & Financial Gateway
            </h2>
            <p className="text-white/80">
              Schools may connect automated payment gateways (including Paystack) for online fee settlement. EduManage provides transaction processing interfaces and audit logging but is not a financial depository. Transaction receipts generated through the portal represent legitimate school financial entries.
            </p>
          </section>

          <section className="space-y-3 pb-6 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-bold text-purple-300 flex items-center gap-2">
              <ShieldCheck className="size-4 text-purple-400" />
              3. Institutional Responsibility & Account Security
            </h2>
            <p className="text-white/80">
              School administrators maintain primary responsibility for maintaining the accuracy of student rosters, verifying staff identity, and configuring appropriate grade calculation matrices. Account holders must keep credentials confidential.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-cyan-300 flex items-center gap-2">
              <AlertCircle className="size-4 text-cyan-400" />
              4. Contact & Dispute Resolution
            </h2>
            <p className="text-white/80">
              For administrative inquiries, billing disputes, or terms clarifications, please reach our legal and support team:
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="mailto:edumanagesystems@gmail.com"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors text-xs font-semibold"
              >
                <Mail className="size-4 text-blue-400" />
                edumanagesystems@gmail.com
              </a>
              <a
                href="tel:+233503688781"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors text-xs font-semibold"
              >
                <Phone className="size-4 text-emerald-400" />
                +233 50 368 8781
              </a>
              <a
                href="tel:+233503230804"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors text-xs font-semibold"
              >
                <Phone className="size-4 text-emerald-400" />
                +233 50 323 0804
              </a>
            </div>
          </section>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/60 px-4 py-6 text-white/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span>© {new Date().getFullYear()} EduManage Cloud Platform.</span>
            <a
              href="mailto:edumanagesystems@gmail.com"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-blue-400 transition-colors"
            >
              <Mail className="size-3 text-blue-400" />
              <span>edumanagesystems@gmail.com</span>
            </a>
            <a
              href="tel:+233503688781"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-emerald-400 transition-colors"
            >
              <Phone className="size-3 text-emerald-400" />
              <span>+233 50 368 8781</span>
            </a>
            <a
              href="tel:+233503230804"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-emerald-400 transition-colors"
            >
              <Phone className="size-3 text-emerald-400" />
              <span>+233 50 323 0804</span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-white/60">
              <Shield className="size-3 text-emerald-400" />
              256-bit Encrypted
            </span>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy & Security
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
