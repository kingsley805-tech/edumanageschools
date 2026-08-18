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
  headlineGradient: string;
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
    color: string;
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
    badgeColor: "border-blue-500/30 bg-blue-950/40 text-blue-300",
    headlineMain: "Smart School Operations.",
    headlineGradient: "Unified in Real-Time.",
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
        color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
      },
      {
        icon: Calendar,
        title: "Live Attendance & Registers",
        desc: "Instant SMS alerts & daily class presence",
        color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
      },
      {
        icon: FileSpreadsheet,
        title: "Automated Report Cards",
        desc: "Standardized grading & bulk PDF downloads",
        color: "from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30",
      },
      {
        icon: Bot,
        title: "AI Voice Receptionist & SMS",
        desc: "24/7 automated parent communication",
        color: "from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30",
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
    badgeColor: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
    headlineMain: "Effortless Teaching & Grading.",
    headlineGradient: "Built for Educators.",
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
        color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
      },
      {
        icon: FileText,
        title: "Digital Lesson Notes & Plans",
        desc: "Structured curriculum submission & approvals",
        color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
      },
      {
        icon: FileSpreadsheet,
        title: "Instant Gradebook & Marks",
        desc: "Continuous assessment & exam score entry",
        color: "from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30",
      },
      {
        icon: FileCheck,
        title: "Digital Signatures & Reports",
        desc: "One-click report card verification & signing",
        color: "from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30",
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
    badgeColor: "border-amber-500/30 bg-amber-950/40 text-amber-300",
    headlineMain: "Track Academic Progress.",
    headlineGradient: "Pay Fees with Ease.",
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
        color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
      },
      {
        icon: Radio,
        title: "SMS Attendance & Absentee Alerts",
        desc: "Real-time morning notifications on your phone",
        color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
      },
      {
        icon: TrendingUp,
        title: "Term Report Cards & Rankings",
        desc: "Download verified terminal performance PDFs",
        color: "from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30",
      },
      {
        icon: Bot,
        title: "AI Voice & Inquiry Support",
        desc: "24/7 automated query answering on tuition",
        color: "from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30",
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
    badgeColor: "border-purple-500/30 bg-purple-950/40 text-purple-300",
    headlineMain: "Your School Life & Exams.",
    headlineGradient: "All in One Hub.",
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
        color: "from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30",
      },
      {
        icon: Award,
        title: "WAEC & BECE Online Exams",
        desc: "Instant grading, timers & past question bank",
        color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
      },
      {
        icon: GraduationCap,
        title: "Academic Performance & Grades",
        desc: "Term scores, class ranking & progress badges",
        color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
      },
      {
        icon: BookOpen,
        title: "Assignments & Study Materials",
        desc: "Download lesson handouts & digital textbooks",
        color: "from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30",
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
    <div className="relative min-h-[100dvh] lg:h-screen lg:max-h-screen lg:overflow-hidden bg-[#050811] text-white flex flex-col justify-between select-none">
      {/* Background ambient particle mesh */}
      <AnimatedBackground />

      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="relative z-30 border-b border-white/10 bg-[#070b16]/75 backdrop-blur-xl px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <EduManageLogo imgClassName="h-7 sm:h-8 brightness-0 invert drop-shadow-md" />
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Portal Active
            </span>
          </div>

          {/* Role Navigation Pills (Clicking any button switches role description & mockup) */}
          <nav className="flex items-center gap-1 rounded-xl bg-white/[0.05] border border-white/10 p-1">
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
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md hover:bg-white/10 hover:border-white/30 transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Hero Content Area (Single Viewport Fit with Animated Role Switch) ── */}
      <main className="relative z-20 flex-1 flex items-center px-4 py-4 sm:px-8 sm:py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center w-full">
          
          {/* Left Column: High-Impact Dynamic Role Description */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`role-content-${activeRole}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Role Shimmer Badge */}
                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md shadow-xs ${currentConfig.badgeColor}`}
                >
                  <currentConfig.icon className="size-3.5 text-blue-400" />
                  <span>{currentConfig.badge}</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight text-white leading-[1.12]">
                  {currentConfig.headlineMain}{" "}
                  <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent block sm:inline">
                    {currentConfig.headlineGradient}
                  </span>
                </h1>

                {/* Subheading */}
                <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-xl font-normal min-h-[3.2rem]">
                  {currentConfig.subheading}
                </p>

                {/* Quick Action CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    to={currentConfig.primaryCtaLink}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <span>{currentConfig.primaryCtaText}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    to={currentConfig.secondaryCtaLink}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs sm:text-sm font-medium text-white/90 backdrop-blur-md hover:bg-white/10 hover:border-white/30 transition-all"
                  >
                    <currentConfig.secondaryIcon className="size-3.5 text-emerald-400" />
                    <span>{currentConfig.secondaryCtaText}</span>
                  </Link>
                </div>

                {/* 4 Feature Badges for Current Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {currentConfig.features.map((feat, idx) => {
                    const FeatIcon = feat.icon;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 rounded-xl border bg-gradient-to-br ${feat.color} p-2.5 backdrop-blur-md hover:scale-[1.01] transition-transform`}
                      >
                        <div className="p-1.5 rounded-lg bg-black/40 shrink-0 mt-0.5">
                          <FeatIcon className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-white truncate leading-tight">
                            {feat.title}
                          </h3>
                          <p className="text-[10px] text-white/50 truncate leading-tight mt-0.5">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Trust Metrics Row */}
                <div className="flex items-center gap-4 sm:gap-6 pt-2 border-t border-white/10 text-white/80">
                  {currentConfig.trustStats.map((st, i) => (
                    <div key={i} className="flex flex-col">
                      <span className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center">
                        <AnimatedCounter value={st.value} suffix={st.suffix} />
                      </span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                        {st.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column: Interactive Dashboard Mockup Device (Dynamic per activeRole) */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <DashboardMockup activeRole={activeRole} />
          </div>
        </div>
      </main>

      {/* ── Integrated Compact Bottom Bar ─────────────────────────────── */}
      <footer className="relative z-30 border-t border-white/10 bg-[#070b16]/75 backdrop-blur-xl px-4 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[11px] text-white/50">
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
