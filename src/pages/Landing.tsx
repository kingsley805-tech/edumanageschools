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
  CheckCircle2,
  Lock,
  Layers,
  Bot,
  Users,
  Building2,
  ChevronRight,
  Radio,
  FileSpreadsheet,
  Mail,
  Phone,
  BookOpen,
  Award,
  Clock,
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
    <div className="relative min-h-[100dvh] lg:h-screen lg:max-h-screen lg:overflow-hidden bg-[#101216] text-white flex flex-col justify-between select-none font-sans">
      {/* Background ambient mesh */}
      <AnimatedBackground />

      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="relative z-30 border-b border-[#292d37] bg-[#16181f]/90 backdrop-blur-xl px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <EduManageLogo imgClassName="h-7 sm:h-8 brightness-0 invert" />
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#3b414f] bg-[#20242c] px-2.5 py-0.5 text-[10px] font-semibold text-white">
              <span className="size-1.5 rounded-full bg-white" />
              Live Portal Active
            </span>
          </div>

          {/* Role Navigation Pills */}
          <nav className="flex items-center gap-1 rounded-xl bg-[#0f1115] border border-[#2b2f3a] p-1">
            {Object.values(roleConfigs).map((r) => {
              const Icon = r.icon;
              const isSelected = activeRole === r.role;
              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setActiveRole(r.role)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white text-black shadow-xs font-semibold"
                      : "text-[#979eb0] hover:text-white hover:bg-[#1e222a]"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Auth Action Buttons */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#383e4c] bg-[#1d2028] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#272b36] hover:border-[#4c5466] transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Hero Content Area ── */}
      <main className="relative z-20 flex-1 flex items-center px-4 py-4 sm:px-8 sm:py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center w-full">
          {/* Left Column */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`role-content-${activeRole}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Role Badge */}
                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md shadow-xs ${currentConfig.badgeColor}`}
                >
                  <currentConfig.icon className="size-3.5 text-white" />
                  <span>{currentConfig.badge}</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight text-white leading-[1.12]">
                  {currentConfig.headlineMain}{" "}
                  <span className="text-[#aeb5c6] block sm:inline">
                    {currentConfig.headlineAccent}
                  </span>
                </h1>

                {/* Subheading */}
                <p className="text-xs sm:text-sm text-[#9da4b5] leading-relaxed max-w-xl font-normal min-h-[3.2rem]">
                  {currentConfig.subheading}
                </p>

                {/* Quick Action CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    to={currentConfig.primaryCtaLink}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
                  >
                    <span>{currentConfig.primaryCtaText}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    to={currentConfig.secondaryCtaLink}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#383e4c] bg-[#1d2028] px-4 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-[#272b36] hover:border-[#4c5466] transition-all"
                  >
                    <currentConfig.secondaryIcon className="size-3.5 text-white" />
                    <span>{currentConfig.secondaryCtaText}</span>
                  </Link>
                </div>

                {/* 4 Feature Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                          <h3 className="text-xs font-semibold text-white truncate leading-tight">
                            {feat.title}
                          </h3>
                          <p className="text-[10px] text-[#8e95a6] truncate leading-tight mt-0.5">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Trust Metrics Row */}
                <div className="flex items-center gap-4 sm:gap-6 pt-2 border-t border-[#292d37] text-white">
                  {currentConfig.trustStats.map((st, i) => (
                    <div key={i} className="flex flex-col">
                      <span className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center">
                        <AnimatedCounter value={st.value} suffix={st.suffix} />
                      </span>
                      <span className="text-[10px] text-[#8c93a4] uppercase tracking-wider font-medium">
                        {st.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <DashboardMockup activeRole={activeRole} />
          </div>
        </div>
      </main>

      {/* ── Integrated Compact Bottom Bar ─────────────────────────────── */}
      <footer className="relative z-30 border-t border-[#292d37] bg-[#14161d]/90 backdrop-blur-xl px-4 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[11px] text-[#8c93a4]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span>© {new Date().getFullYear()} EduManage Cloud Platform.</span>
            <a
              href="mailto:edumanagesystems@gmail.com"
              className="inline-flex items-center gap-1.5 text-[#c1c6d4] hover:text-white transition-colors"
            >
              <Mail className="size-3 text-[#a2a9bb]" />
              <span>edumanagesystems@gmail.com</span>
            </a>
            <a
              href="tel:+233503688781"
              className="inline-flex items-center gap-1.5 text-[#c1c6d4] hover:text-white transition-colors"
            >
              <Phone className="size-3 text-[#a2a9bb]" />
              <span>+233 50 368 8781</span>
            </a>
            <a
              href="tel:+233503230804"
              className="inline-flex items-center gap-1.5 text-[#c1c6d4] hover:text-white transition-colors"
            >
              <Phone className="size-3 text-[#a2a9bb]" />
              <span>+233 50 323 0804</span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-[#a2a9bb]">
              <Shield className="size-3 text-white" />
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
