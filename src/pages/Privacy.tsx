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
    <div className="relative min-h-screen w-full bg-[#101216] text-[#e1e4ec] selection:bg-[#2e3340] selection:text-white overflow-x-hidden font-sans antialiased">
      {/* Background Architectural Grid */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#4b5161 1px, transparent 1px), linear-gradient(90deg, #4b5161 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-[#292d37] bg-[#14161d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <EduManageLogo size="md" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className="px-3 py-1.5 text-xs font-medium text-[#98a0b1] hover:text-white hover:bg-[#1f232c] rounded-lg transition-colors"
              >
                Platform Overview
              </Link>
              <Link
                to="/privacy"
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#222630] rounded-lg border border-[#353a47]"
              >
                Privacy & Security
              </Link>
              <Link
                to="/contact"
                className="px-3 py-1.5 text-xs font-medium text-[#98a0b1] hover:text-white hover:bg-[#1f232c] rounded-lg transition-colors"
              >
                Contact & Support
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl border border-[#383e4c] bg-[#1d2028] px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-[#272b36] hover:border-[#4c5466] active:scale-95"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-95"
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
            className="inline-flex items-center gap-2 rounded-full border border-[#393f4e] bg-[#1d212a] px-3.5 py-1 text-xs font-medium text-white backdrop-blur-md mb-4 shadow-xs"
          >
            <img src="/assets/edumanageLogo.png" alt="EduManage" className="size-4 object-contain brightness-0 invert" />
            Enterprise Data Protection & Security Standard
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            Privacy Policy &{" "}
            <span className="text-[#aeb5c6]">
              Security Architecture
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4 text-xs sm:text-sm text-[#949cae] leading-relaxed"
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
          <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-5 backdrop-blur-xl hover:border-[#434a5c] transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] mb-3 shadow-md">
              <Lock className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">AES-256 Encryption</h3>
            <p className="text-xs text-[#8e95a6] leading-relaxed">
              All financial transactions, student profiles, and grade records are encrypted in transit and at rest.
            </p>
          </div>

          <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-5 backdrop-blur-xl hover:border-[#434a5c] transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] mb-3 shadow-md">
              <Database className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Tenant Isolation</h3>
            <p className="text-xs text-[#8e95a6] leading-relaxed">
              Strict database Row-Level Security (RLS) guarantees complete separation of institutional records.
            </p>
          </div>

          <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-5 backdrop-blur-xl hover:border-[#434a5c] transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] mb-3 shadow-md">
              <UserCheck className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Role-Based Access</h3>
            <p className="text-xs text-[#8e95a6] leading-relaxed">
              Granular permission matrices ensure users only access information appropriate to their verified role.
            </p>
          </div>

          <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-5 backdrop-blur-xl hover:border-[#434a5c] transition-all">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] mb-3 shadow-md">
              <Server className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Automated Backups</h3>
            <p className="text-xs text-[#8e95a6] leading-relaxed">
              Continuous point-in-time recovery and redundant failovers prevent accidental record degradation.
            </p>
          </div>
        </motion.div>

        {/* Detailed Policy Document Sections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-3xl border border-[#2d323e] bg-[#16181f] p-6 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-8 text-[#d4d8e3] text-xs sm:text-sm leading-relaxed"
        >
          {/* Section 1 */}
          <section className="space-y-3 pb-6 border-b border-[#2a2f3a]">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileCheck className="size-4 text-white" />
              1. Information We Collect and Custody
            </h2>
            <p className="text-[#9ea6b8]">
              EduManage acts as a data processor for registered partner schools. Information provided by institutions or gathered during operation includes:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[#b4bac9]">
              <li className="flex items-start gap-2 bg-[#1b1e26] p-2.5 rounded-xl border border-[#2d323e]">
                <span className="size-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                <span><strong className="text-white">Institutional Information:</strong> School code, accreditation name, contact emails, and billing parameters.</span>
              </li>
              <li className="flex items-start gap-2 bg-[#1b1e26] p-2.5 rounded-xl border border-[#2d323e]">
                <span className="size-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                <span><strong className="text-white">Academic & Student Records:</strong> Admission IDs, full names, class rosters, attendance records, exam scores, and report cards.</span>
              </li>
              <li className="flex items-start gap-2 bg-[#1b1e26] p-2.5 rounded-xl border border-[#2d323e]">
                <span className="size-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                <span><strong className="text-white">Parent & Guardian Details:</strong> Contact telephone numbers, verified emails, and linked student associations.</span>
              </li>
              <li className="flex items-start gap-2 bg-[#1b1e26] p-2.5 rounded-xl border border-[#2d323e]">
                <span className="size-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                <span><strong className="text-white">Financial Transaction Logs:</strong> Invoices, payment receipts, fee tracking, and Paystack reference identifiers.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pb-6 border-b border-[#2a2f3a]">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Activity className="size-4 text-white" />
              2. How Data is Utilized
            </h2>
            <p className="text-[#9ea6b8]">
              All processed data is strictly utilized to deliver school management functionality, specifically:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-[#1b1e26] border border-[#2d323e]">
                <strong className="text-white block mb-1">Academic Administration</strong>
                Facilitating daily roll-call attendance, grade calculation, and official PDF report generation.
              </div>
              <div className="p-3 rounded-xl bg-[#1b1e26] border border-[#2d323e]">
                <strong className="text-white block mb-1">Real-Time Parent Alerts</strong>
                Delivering SMS notifications for student arrival, departure, fee balances, and school announcements.
              </div>
              <div className="p-3 rounded-xl bg-[#1b1e26] border border-[#2d323e]">
                <strong className="text-white block mb-1">AI Receptionist Support</strong>
                Answering prospective inquiries and verifying student admission status with strict privacy safeguards.
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pb-6 border-b border-[#2a2f3a]">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Lock className="size-4 text-white" />
              3. Data Ownership & Non-Disclosure
            </h2>
            <p className="text-[#9ea6b8]">
              EduManage strictly adheres to zero-monetization principles regarding educational and student information.
              We do <strong className="text-white">not sell, rent, license, or barter</strong> student, parent, or staff data to advertising networks or third-party brokers.
              All data belongs solely to the partner school and authorized students/guardians.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pb-6 border-b border-[#2a2f3a]">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Database className="size-4 text-white" />
              4. Data Retention & Erasure
            </h2>
            <p className="text-[#9ea6b8]">
              Academic and financial records are retained according to national educational compliance guidelines or per institutional subscription lifespan.
              Upon formal request by school administration, tenant databases can be completely purged or exported into portable JSON/CSV formats within 14 calendar days.
            </p>
          </section>

          {/* Section 5: Inquiries & Contact */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Shield className="size-4 text-white" />
              5. Security Officer Inquiries
            </h2>
            <p className="text-[#9ea6b8]">
              If your institution has specific data protection questions, compliance audits, or security assessment requirements, reach out to our regional compliance desk:
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="mailto:edumanagesystems@gmail.com"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1f232c] border border-[#343a47] px-4 py-2 text-xs font-semibold text-white hover:bg-[#282d38] transition-all"
              >
                <Mail className="size-3.5 text-white" />
                edumanagesystems@gmail.com
              </a>
              <a
                href="tel:+233503688781"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1f232c] border border-[#343a47] px-4 py-2 text-xs font-semibold text-white hover:bg-[#282d38] transition-all"
              >
                <Phone className="size-3.5 text-white" />
                +233 50 368 8781
              </a>
            </div>
          </section>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#292d37] bg-[#14161d]/90 backdrop-blur-xl px-4 py-6 sm:px-8 mt-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-[#8c93a4]">
          <div>
            <span>© {new Date().getFullYear()} EduManage Cloud Platform. All institutional records protected.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-[#a2a9bb] hover:text-white transition-colors">
              Platform Overview
            </Link>
            <Link to="/contact" className="text-[#a2a9bb] hover:text-white transition-colors">
              Contact & Support
            </Link>
            <Link to="/auth" className="text-[#a2a9bb] hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
