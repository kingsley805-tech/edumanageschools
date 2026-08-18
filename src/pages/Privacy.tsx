import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Database,
  UserCheck,
  Server,
  FileCheck,
  Mail,
  Phone,
  ArrowRight,
  Activity,
} from "lucide-react";
import { EduManageLogo } from "@/components/EduManageLogo";

export default function Privacy() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative min-h-screen w-full bg-[#050811] text-slate-100 selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden font-sans antialiased">
      {/* Background Radial Atmosphere */}
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
                className="px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 rounded-lg border border-blue-500/20"
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
        {/* Hero Banner */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-400 backdrop-blur-md mb-4 shadow-xs"
          >
            <img src="/assets/edumanageLogo.png" alt="EduManage" className="size-4 object-contain" />
            Enterprise Data Protection & Security Standard
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            Privacy Policy &{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
              Security Architecture
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed"
          >
            Last Revised: <span className="font-semibold text-white">{lastUpdated}</span> · Effective for all EduManage school tenants, administrative personnel, teachers, students, and guardians.
          </motion.p>
        </div>

        {/* 4 Visual Security Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl hover:border-blue-500/40 transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 mb-3 shadow-md">
              <Lock className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">AES-256 Encryption</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              All financial transactions, student profiles, and grade records are encrypted in transit and at rest.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl hover:border-emerald-500/40 transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-3 shadow-md">
              <Database className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Tenant Isolation</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Strict database Row-Level Security (RLS) guarantees complete separation of institutional records.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl hover:border-purple-500/40 transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-3 shadow-md">
              <UserCheck className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Role-Based Access</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Granular permission matrices ensure users only access information appropriate to their verified role.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl hover:border-amber-500/40 transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-3 shadow-md">
              <Server className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Automated Backups</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Continuous point-in-time recovery and redundant failovers prevent accidental record degradation.
            </p>
          </div>
        </motion.div>

        {/* Detailed Policy Document Sections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-3xl border border-white/10 bg-[#0b0f1d]/90 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-8 text-slate-200 text-xs sm:text-sm leading-relaxed"
        >
          {/* Section 1 */}
          <section className="space-y-3 pb-6 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-bold text-blue-300 flex items-center gap-2">
              <FileCheck className="size-4 text-blue-400" />
              1. Information We Collect and Custody
            </h2>
            <p className="text-white/80">
              EduManage acts as a data processor for registered partner schools. Information provided by institutions or gathered during operation includes:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-white/70">
              <li className="flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                <span className="size-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span><strong>Institutional Information:</strong> School code, accreditation name, contact emails, and billing parameters.</span>
              </li>
              <li className="flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                <span className="size-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span><strong>Academic & Student Records:</strong> Admission IDs, full names, class rosters, attendance records, exam scores, and report cards.</span>
              </li>
              <li className="flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                <span className="size-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span><strong>Parent & Guardian Details:</strong> Contact telephone numbers, verified emails, and linked student associations.</span>
              </li>
              <li className="flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                <span className="size-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span><strong>Financial Transaction Logs:</strong> Invoices, payment receipts, fee tracking, and Paystack reference identifiers.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pb-6 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-bold text-emerald-300 flex items-center gap-2">
              <Activity className="size-4 text-emerald-400" />
              2. How Data is Utilized
            </h2>
            <p className="text-white/80">
              All processed data is strictly utilized to deliver school management functionality, specifically:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <strong className="text-white block mb-1">Academic Administration</strong>
                Facilitating daily roll-call attendance, grade calculation, and official PDF report generation.
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <strong className="text-white block mb-1">Real-Time Parent Alerts</strong>
                Delivering SMS notifications for student arrival, departure, fee balances, and school announcements.
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <strong className="text-white block mb-1">AI Receptionist Support</strong>
                Answering prospective inquiries and verifying student admission status with strict privacy safeguards.
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pb-6 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-bold text-purple-300 flex items-center gap-2">
              <Lock className="size-4 text-purple-400" />
              3. Data Ownership & Non-Disclosure
            </h2>
            <p className="text-white/80">
              EduManage strictly adheres to zero-monetization principles regarding educational and student information.
              We do <strong>not sell, rent, license, or barter</strong> student, parent, or staff data to advertising networks or third-party brokers.
              All data belongs solely to the partner school and authorized students/guardians.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-cyan-300 flex items-center gap-2">
              <Shield className="size-4 text-cyan-400" />
              4. Data Protection Officer & Compliance Inquiries
            </h2>
            <p className="text-white/80">
              For questions regarding privacy policies, compliance requests, or data extraction requests, reach out directly to our platform security team:
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
