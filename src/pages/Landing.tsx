import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Shield,
  CreditCard,
  GraduationCap,
  Calendar,
  FileCheck,
  Lock,
  Bot,
  Users,
  Building2,
  Radio,
  FileSpreadsheet,
  Mail,
  Phone,
  BookOpen,
  Award,
  TrendingUp,
  FileText,
  UserCheck,
} from "lucide-react";
import AnimatedBackground from "@/components/landing/AnimatedBackground";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import DashboardMockup from "@/components/landing/DashboardMockup";
import { EduManageLogo } from "@/components/EduManageLogo";

interface RoleConfig {
  label: string;
  shortLabel: string;
  role: string;
  icon: any;
  badge: string;
  badgeColor: string;
  headlineMain: string;
  headlineAccent: string;
  subheading: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  secondaryIcon: any;
  features: {
    icon: any;
    title: string;
    desc: string;
  }[];
  trustStats: {
    value: number;
    suffix: string;
    label: string;
  }[];
}

const roleConfigs: Record<string, RoleConfig> = {
  admin: {
    label: "Admin Portal",
    shortLabel: "Admin",
    role: "admin",
    icon: Shield,
    badge: "Next-Gen School Operations & Academics",
    badgeColor: "border-[#3b414f] bg-[#1e222a] text-white",
    headlineMain: "Smart School Operations.",
    headlineAccent: "Unified in Real-Time.",
    subheading:
      "Consolidate student enrollment, real-time fee payments, automatic gradebooks, class registers, timetabling, and AI receptionist support into one seamless portal.",
    primaryCtaText: "Launch Admin Portal",
    primaryCtaLink: "/auth",
    secondaryCtaText: "Staff & Parent Sign In",
    secondaryCtaLink: "/auth",
    secondaryIcon: Lock,
    features: [
      {
        icon: CreditCard,
        title: "GH₵ Fee Invoicing & Tracking",
        desc: "Real-time receivables & receipt generation",
      },
      {
        icon: Calendar,
        title: "Live Attendance & Registers",
        desc: "Instant SMS alerts & daily class presence",
      },
      {
        icon: FileSpreadsheet,
        title: "Automated Report Cards",
        desc: "Standardized grading & bulk PDF downloads",
      },
      {
        icon: Bot,
        title: "AI Voice Receptionist & SMS",
        desc: "24/7 automated parent communication",
      },
    ],
    trustStats: [
      { value: 500, suffix: "+", label: "Partner Schools" },
      { value: 150, suffix: "k+", label: "Active Students" },
      { value: 99.99, suffix: "%", label: "Cloud Uptime" },
    ],
  },
  teacher: {
    label: "Teachers",
    shortLabel: "Teachers",
    role: "teacher",
    icon: GraduationCap,
    badge: "Empowering Educators & Academic Excellence",
    badgeColor: "border-[#3b414f] bg-[#1e222a] text-white",
    headlineMain: "Effortless Teaching & Grading.",
    headlineAccent: "Built for Educators.",
    subheading:
      "Mark daily class attendance in seconds, submit curriculum lesson notes, manage examination question banks, record score entries, and generate signed terminal report cards.",
    primaryCtaText: "Enter Teacher Workspace",
    primaryCtaLink: "/auth",
    secondaryCtaText: "Review Lesson Plans",
    secondaryCtaLink: "/auth",
    secondaryIcon: BookOpen,
    features: [
      {
        icon: UserCheck,
        title: "Daily Register & Roll Call",
        desc: "One-tap attendance with instant parent SMS",
      },
      {
        icon: FileText,
        title: "Digital Lesson Notes & Plans",
        desc: "Structured curriculum submission & approvals",
      },
      {
        icon: FileSpreadsheet,
        title: "Instant Gradebook & Marks",
        desc: "Continuous assessment & exam score entry",
      },
      {
        icon: FileCheck,
        title: "Digital Signatures & Reports",
        desc: "One-click report card verification & signing",
      },
    ],
    trustStats: [
      { value: 4800, suffix: "+", label: "Active Teachers" },
      { value: 98.6, suffix: "%", label: "Lesson Approvals" },
      { value: 12, suffix: "k+", label: "Classes Managed" },
    ],
  },
  parent: {
    label: "Parents",
    shortLabel: "Parents",
    role: "parent",
    icon: Users,
    badge: "Connected Parenting & Instant Visibility",
    badgeColor: "border-[#3b414f] bg-[#1e222a] text-white",
    headlineMain: "Track Academic Progress.",
    headlineAccent: "Pay Fees with Ease.",
    subheading:
      "Monitor your child's daily school attendance, receive instant SMS notifications, view term report cards, check live gradebooks, and settle tuition fees securely via MoMo or Card.",
    primaryCtaText: "Access Parent Portal",
    primaryCtaLink: "/auth",
    secondaryCtaText: "Pay School Fees",
    secondaryCtaLink: "/auth",
    secondaryIcon: CreditCard,
    features: [
      {
        icon: CreditCard,
        title: "Instant MoMo & Card Payments",
        desc: "MTN, Telecel, AT & Visa fee settlement",
      },
      {
        icon: Radio,
        title: "SMS Attendance & Absentee Alerts",
        desc: "Real-time morning notifications on your phone",
      },
      {
        icon: TrendingUp,
        title: "Term Report Cards & Rankings",
        desc: "Download verified terminal performance PDFs",
      },
      {
        icon: Bot,
        title: "AI Voice & Inquiry Support",
        desc: "24/7 automated query answering on tuition",
      },
    ],
    trustStats: [
      { value: 95, suffix: "k+", label: "Connected Parents" },
      { value: 50, suffix: "M+", label: "GH₵ Fees Processed" },
      { value: 99.8, suffix: "%", label: "SMS Delivery Rate" },
    ],
  },
  student: {
    label: "Students",
    shortLabel: "Students",
    role: "student",
    icon: Building2,
    badge: "Interactive Student Learning Hub",
    badgeColor: "border-[#3b414f] bg-[#1e222a] text-white",
    headlineMain: "Your School Life & Exams.",
    headlineAccent: "All in One Hub.",
    subheading:
      "View your daily class timetable, practice with past WAEC & BECE exam questions, submit homework assignments, check terminal grades, and track your academic achievements.",
    primaryCtaText: "Open Student Hub",
    primaryCtaLink: "/auth",
    secondaryCtaText: "Take Practice Exam",
    secondaryCtaLink: "/auth",
    secondaryIcon: GraduationCap,
    features: [
      {
        icon: Calendar,
        title: "Live Class Timetables",
        desc: "Personalized daily periods & room schedules",
      },
      {
        icon: Award,
        title: "WAEC & BECE Online Exams",
        desc: "Instant grading, timers & past question bank",
      },
      {
        icon: GraduationCap,
        title: "Academic Performance & Grades",
        desc: "Term scores, class ranking & progress badges",
      },
      {
        icon: BookOpen,
        title: "Assignments & Study Materials",
        desc: "Download lesson handouts & digital textbooks",
      },
    ],
    trustStats: [
      { value: 150, suffix: "k+", label: "Active Learners" },
      { value: 500, suffix: "k+", label: "Practice Exams Taken" },
      { value: 94.2, suffix: "%", label: "Exam Pass Rate" },
    ],
  },
};

export default function Landing() {
  const [activeRole, setActiveRole] = useState<string>("admin");
  const currentConfig = roleConfigs[activeRole] || roleConfigs.admin;

  return (
    <div className="relative min-h-[100dvh] lg:h-screen lg:max-h-screen lg:overflow-hidden overflow-x-hidden bg-[#101216] text-white flex flex-col select-none font-sans">
      {/* Background ambient mesh */}
      <AnimatedBackground />

      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="relative z-30 shrink-0 border-b border-[#292d37] bg-[#16181f]/90 backdrop-blur-xl px-3 py-2.5 sm:px-8 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between gap-3">
            {/* Brand Logo */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <EduManageLogo imgClassName="h-6 sm:h-8 brightness-0 invert" />
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[#3b414f] bg-[#20242c] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                <span className="size-1.5 rounded-full bg-white" />
                Live Portal Active
              </span>
            </div>

            {/* Auth Action Buttons */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-[#383e4c] bg-[#1d2028] px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-white hover:bg-[#272b36] hover:border-[#4c5466] transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl bg-white px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
              >
                <span>Get Started</span>
                <ArrowRight className="size-3 sm:size-3.5" />
              </Link>
            </div>
          </div>

          {/* Role Navigation — full-width grid on mobile, compact pills on desktop */}
          <nav
            className="grid w-full grid-cols-4 gap-1 rounded-xl border border-[#2b2f3a] bg-[#0f1115] p-1 sm:flex sm:w-auto sm:items-center sm:self-center md:self-start"
            aria-label="Audience"
          >
            {Object.values(roleConfigs).map((r) => {
              const Icon = r.icon;
              const isSelected = activeRole === r.role;
              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setActiveRole(r.role)}
                  aria-pressed={isSelected}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all sm:flex-row sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-xs ${
                    isSelected
                      ? "bg-white text-black shadow-xs font-semibold"
                      : "text-[#979eb0] hover:text-white hover:bg-[#1e222a]"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate sm:hidden">{r.shortLabel}</span>
                  <span className="hidden sm:inline">{r.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Main Hero Content Area ── */}
      <main className="relative z-20 flex-1 flex items-start lg:items-center overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-6 max-w-7xl mx-auto w-full min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-10 items-center w-full pb-2">
          {/* Left Column */}
          <div className="lg:col-span-6 flex flex-col justify-center min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`role-content-${activeRole}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-3.5 sm:space-y-5"
              >
                {/* Role Badge */}
                <div
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold backdrop-blur-md shadow-xs ${currentConfig.badgeColor}`}
                >
                  <currentConfig.icon className="size-3.5 shrink-0 text-white" />
                  <span className="truncate">{currentConfig.badge}</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-[1.65rem] sm:text-4xl lg:text-[2.65rem] font-black tracking-tight text-white leading-[1.15]">
                  {currentConfig.headlineMain}{" "}
                  <span className="text-[#aeb5c6] block sm:inline">
                    {currentConfig.headlineAccent}
                  </span>
                </h1>

                {/* Subheading */}
                <p className="text-xs sm:text-sm text-[#9da4b5] leading-relaxed max-w-xl font-normal sm:min-h-[3.2rem]">
                  {currentConfig.subheading}
                </p>

                {/* Quick Action CTAs */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-0.5">
                  <Link
                    to={currentConfig.primaryCtaLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
                  >
                    <span>{currentConfig.primaryCtaText}</span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                  <Link
                    to={currentConfig.secondaryCtaLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#383e4c] bg-[#1d2028] px-4 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-[#272b36] hover:border-[#4c5466] transition-all"
                  >
                    <currentConfig.secondaryIcon className="size-3.5 shrink-0 text-white" />
                    <span>{currentConfig.secondaryCtaText}</span>
                  </Link>
                </div>

                {/* 4 Feature Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 pt-0.5">
                  {currentConfig.features.map((feat, idx) => {
                    const FeatIcon = feat.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-xl border border-[#2d323e] bg-[#181a21] p-2.5 backdrop-blur-md hover:border-[#424959] transition-all"
                      >
                        <div className="p-1.5 rounded-lg bg-[#242833] border border-[#353b49] shrink-0 mt-0.5 text-white">
                          <FeatIcon className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-white leading-tight line-clamp-2 sm:line-clamp-none sm:truncate">
                            {feat.title}
                          </h3>
                          <p className="text-[10px] text-[#8e95a6] leading-tight mt-0.5 line-clamp-2 sm:line-clamp-none sm:truncate">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Trust Metrics Row */}
                <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-6 pt-2 border-t border-[#292d37] text-white">
                  {currentConfig.trustStats.map((st, i) => (
                    <div key={i} className="flex min-w-0 flex-col">
                      <span className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center">
                        <AnimatedCounter value={st.value} suffix={st.suffix} />
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-[#8c93a4] uppercase tracking-wider font-medium leading-tight">
                        {st.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column — hide mockup on very small heights / keep below content on mobile */}
          <div className="lg:col-span-6 flex items-center justify-center min-w-0 w-full">
            <div className="w-full max-w-md sm:max-w-lg lg:max-w-none scale-[0.92] origin-top sm:scale-100">
              <DashboardMockup activeRole={activeRole} />
            </div>
          </div>
        </div>
      </main>

      {/* ── Integrated Compact Bottom Bar ─────────────────────────────── */}
      <footer className="relative z-30 shrink-0 border-t border-[#292d37] bg-[#14161d]/90 backdrop-blur-xl px-3 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 text-[10px] sm:text-[11px] text-[#8c93a4]">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1">
            <span>© {new Date().getFullYear()} EduManage Cloud Platform.</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href="mailto:edumanagesystems@gmail.com"
                className="inline-flex items-center gap-1.5 text-[#c1c6d4] hover:text-white transition-colors"
              >
                <Mail className="size-3 shrink-0 text-[#a2a9bb]" />
                <span className="break-all">edumanagesystems@gmail.com</span>
              </a>
              <a
                href="tel:+233503688781"
                className="inline-flex items-center gap-1.5 text-[#c1c6d4] hover:text-white transition-colors"
              >
                <Phone className="size-3 shrink-0 text-[#a2a9bb]" />
                <span>+233 50 368 8781</span>
              </a>
              <a
                href="tel:+233503230804"
                className="inline-flex items-center gap-1.5 text-[#c1c6d4] hover:text-white transition-colors"
              >
                <Phone className="size-3 shrink-0 text-[#a2a9bb]" />
                <span>+233 50 323 0804</span>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
            <span className="inline-flex items-center gap-1 text-[#a2a9bb]">
              <Shield className="size-3 shrink-0 text-white" />
              256-bit Encrypted
            </span>
            <Link to="/privacy" className="text-[#a2a9bb] hover:text-white transition-colors">
              Privacy & Security
            </Link>
            <Link to="/contact" className="text-[#a2a9bb] hover:text-white transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
