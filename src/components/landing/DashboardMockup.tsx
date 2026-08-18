import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  Shield,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Lock,
  Zap,
  GraduationCap,
  Users,
  Building2,
  Calendar,
  BookOpen,
  FileSpreadsheet,
  Award,
  Bell,
  Check,
  ArrowUpRight,
  Clock,
  Radio,
} from "lucide-react";

export interface DashboardMockupProps {
  activeRole?: string;
}

export default function DashboardMockup({ activeRole = "admin" }: DashboardMockupProps) {
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  const getRoleUrl = () => {
    switch (activeRole) {
      case "teacher":
        return "/teacher/dashboard";
      case "parent":
        return "/parent/dashboard";
      case "student":
        return "/student/dashboard";
      default:
        return "/admin/dashboard";
    }
  };

  return (
    <motion.div
      className="relative w-full max-w-2xl lg:max-w-none"
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Ambient background glow effect */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-emerald-500/25 blur-2xl opacity-75 group-hover:opacity-100 transition-opacity" />

      {/* Main Glass Device Frame */}
      <div className="relative rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0a0d14]/90 shadow-2xl shadow-black/80 backdrop-blur-2xl overflow-hidden transition-all duration-300">
        {/* Browser Top Window Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-2.5 sm:px-5 sm:py-3">
          {/* Window action buttons */}
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-rose-500/80 ring-1 ring-rose-500/30 inline-block" />
            <span className="size-3 rounded-full bg-amber-500/80 ring-1 ring-amber-500/30 inline-block" />
            <span className="size-3 rounded-full bg-emerald-500/80 ring-1 ring-emerald-500/30 inline-block" />
          </div>

          {/* Browser Address URL Pill (Dynamic per Role) */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-3 py-1 text-[11px] font-mono text-white/60">
            <Lock className="size-3 text-emerald-400" />
            <span>portal.edumanage.io</span>
            <span className="text-blue-400 font-semibold">{getRoleUrl()}</span>
          </div>

          {/* Dark / Light Mode Switcher Buttons */}
          <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setThemeMode("dark")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                themeMode === "dark"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-white/50 hover:text-white"
              }`}
              title="Dark Mode Preview"
            >
              <Moon className="size-3" />
              <span className="hidden xs:inline">Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode("light")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                themeMode === "light"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-white/50 hover:text-white"
              }`}
              title="Light Mode Preview"
            >
              <Sun className="size-3" />
              <span className="hidden xs:inline">Light</span>
            </button>
          </div>
        </div>

        {/* Dashboard Image / Interactive Mockup Area */}
        <div className="relative w-full aspect-[16/9.6] bg-[#0d1117] overflow-hidden group select-none">
          <AnimatePresence mode="wait">
            {activeRole === "admin" && (
              <motion.div
                key="admin-preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className="relative size-full"
              >
                {/* Actual Admin Dashboard Screenshot */}
                <img
                  src={
                    themeMode === "dark"
                      ? "/assets/media/dashboard-preview-dark.png"
                      : "/assets/media/dashboard-preview-light.png"
                  }
                  alt="EduManage Admin Dashboard Preview"
                  className="w-full h-full object-cover object-top"
                />

                {/* SIDEBAR BLUR OVERLAY: Blurs the left sidebar items (~19% width) to protect internal items */}
                <div className="absolute inset-y-0 left-0 w-[19.2%] backdrop-blur-md bg-black/55 border-r border-white/10 flex flex-col items-center justify-center p-2 text-center">
                  <div className="size-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-md">
                    <Shield className="size-4 text-blue-400" />
                  </div>
                  <span className="text-[9px] font-semibold text-white/80 leading-tight hidden sm:block">
                    Role Secured
                  </span>
                  <span className="text-[8px] text-white/40 leading-none mt-0.5 hidden sm:block">
                    Modules
                  </span>
                </div>
              </motion.div>
            )}

            {activeRole === "teacher" && (
              <motion.div
                key="teacher-preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className={`relative size-full p-4 sm:p-5 flex flex-col justify-between ${
                  themeMode === "dark" ? "bg-[#0b0f19] text-white" : "bg-slate-50 text-slate-900"
                }`}
              >
                {/* Teacher Workspace Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-blue-500/25 border-2 border-blue-400 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/20">
                      SK
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Sir Kingsley</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Senior Academic Staff
                        </span>
                      </h4>
                      <p className="text-[11px] text-white/80 font-medium mt-0.5">4 Assigned Classes · Core Mathematics & Science</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Check className="size-3 text-emerald-400" /> Register Marked Today
                  </span>
                </div>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-4 gap-2 my-auto">
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Assigned Classes</span>
                    <span className="text-base sm:text-lg font-extrabold text-blue-400 block mt-0.5">4 Classes</span>
                    <span className="text-[9px] text-white/50">120 Total Students</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Attendance Rate</span>
                    <span className="text-base sm:text-lg font-extrabold text-emerald-400 block mt-0.5">100.0%</span>
                    <span className="text-[9px] text-white/50">Roll Call Verified</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Lesson Notes</span>
                    <span className="text-base sm:text-lg font-extrabold text-amber-400 block mt-0.5">12 / 12</span>
                    <span className="text-[9px] text-white/50">Approved by Admin</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Report Cards</span>
                    <span className="text-base sm:text-lg font-extrabold text-purple-400 block mt-0.5">Ready</span>
                    <span className="text-[9px] text-white/50">Terminal Gradebooks</span>
                  </div>
                </div>

                {/* Today's Schedule & Quick Action Row */}
                <div className={`p-3 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Next Period: JHS 2A — Core Mathematics</span>
                      <span className="text-[10px] text-white/60">Room 4B · 10:00 AM - 11:30 AM · Lesson 14: Algebra</span>
                    </div>
                  </div>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white shadow-xs hover:bg-blue-500">
                    Open Digital Register
                  </button>
                </div>
              </motion.div>
            )}

            {activeRole === "parent" && (
              <motion.div
                key="parent-preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className={`relative size-full p-4 sm:p-5 flex flex-col justify-between ${
                  themeMode === "dark" ? "bg-[#0b0f19] text-white" : "bg-slate-50 text-slate-900"
                }`}
              >
                {/* Parent Portal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-emerald-500/25 border-2 border-emerald-400 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-emerald-500/20">
                      KM
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Kwame Mensah</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          SHS 1 Science · ID #ADM-2026-004
                        </span>
                      </h4>
                      <p className="text-[11px] text-white/80 font-medium mt-0.5">Parent: Mr. & Mrs. Mensah · Primary Guardian</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Check className="size-3 text-emerald-400" /> Tuition Paid In Full
                  </span>
                </div>

                {/* 4 Parent Metric Cards */}
                <div className="grid grid-cols-4 gap-2 my-auto">
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Outstanding Fees</span>
                    <span className="text-base sm:text-lg font-extrabold text-emerald-400 block mt-0.5">GH₵0.00</span>
                    <span className="text-[9px] text-white/50">Invoice #8821 Cleared</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Term Attendance</span>
                    <span className="text-base sm:text-lg font-extrabold text-blue-400 block mt-0.5">99.2%</span>
                    <span className="text-[9px] text-white/50">SMS Alerts Active</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Class Rank</span>
                    <span className="text-base sm:text-lg font-extrabold text-amber-400 block mt-0.5">2nd / 48</span>
                    <span className="text-[9px] text-white/50">Aggregate 07 (Grade A)</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/70 block font-medium">Report Card</span>
                    <span className="text-base sm:text-lg font-extrabold text-purple-400 block mt-0.5">Verified</span>
                    <span className="text-[9px] text-white/50">Download Official PDF</span>
                  </div>
                </div>

                {/* Recent Notification Banner */}
                <div className={`p-3 rounded-xl border ${themeMode === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-slate-200 shadow-xs"} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Radio className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Morning SMS Alert Delivered: Arrived safely at 7:45 AM</span>
                      <span className="text-[10px] text-white/60">Automated gate check · Verified by Class Teacher</span>
                    </div>
                  </div>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white shadow-xs hover:bg-emerald-500">
                    Download Report Card
                  </button>
                </div>
              </motion.div>
            )}

            {activeRole === "student" && (
              <motion.div
                key="student-preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className={`relative size-full p-4 sm:p-5 flex flex-col justify-between ${
                  themeMode === "dark" ? "bg-[#0b0f19] text-white" : "bg-slate-50 text-slate-900"
                }`}
              >
                {/* Student Learning Desk Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-purple-500/25 border-2 border-purple-400 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-purple-500/20">
                      KM
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Kwame Mensah</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          SHS 2 Science Section A
                        </span>
                      </h4>
                      <p className="text-[11px] text-white/80 font-medium mt-0.5">Student Portal · Enrolled in 8 Subjects</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                    <Award className="size-3 text-purple-400" /> Top 5% Academic Honor Roll
                  </span>
                </div>

                {/* 4 Student Metric Cards */}
                <div className="grid grid-cols-4 gap-2 my-auto">
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/50 block font-medium">Next Period</span>
                    <span className="text-base sm:text-lg font-bold text-purple-400 block mt-0.5">Physics</span>
                    <span className="text-[9px] text-white/40">Lab 2 · 10:30 AM</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/50 block font-medium">WAEC Practice</span>
                    <span className="text-base sm:text-lg font-bold text-emerald-400 block mt-0.5">94% Score</span>
                    <span className="text-[9px] text-white/40">Top Percentile</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/50 block font-medium">Homework Due</span>
                    <span className="text-base sm:text-lg font-bold text-amber-400 block mt-0.5">2 Tasks</span>
                    <span className="text-[9px] text-white/40">Maths & Elective Chem</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xs"}`}>
                    <span className="text-[10px] text-white/50 block font-medium">Terminal Grade</span>
                    <span className="text-base sm:text-lg font-bold text-blue-400 block mt-0.5">Grade A</span>
                    <span className="text-[9px] text-white/40">Aggregate 07</span>
                  </div>
                </div>

                {/* Timetable Schedule Bar */}
                <div className={`p-3 rounded-xl border ${themeMode === "dark" ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xs"} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                      <BookOpen className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block">Online Exam Ready: 2026 WAEC / BECE Mock Series</span>
                      <span className="text-[10px] text-white/50">40 Multiple Choice Questions · Instant Evaluation</span>
                    </div>
                  </div>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white shadow-xs hover:bg-purple-500">
                    Start Practice Exam
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle bottom gradient to blend cleanly */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Floating Micro-Badge Top Right (Dynamic per Role) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`badge-top-${activeRole}`}
          className="absolute -top-3 -right-2 sm:-right-4 z-20 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-black/85 px-3 py-1.5 shadow-xl backdrop-blur-xl"
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white flex items-center gap-1">
              {activeRole === "teacher"
                ? "Academic Register Verified"
                : activeRole === "parent"
                ? "Fee Receipt #REC-8842 Verified"
                : activeRole === "student"
                ? "Academic Honor Roll"
                : "Live Feed Verified"}
              <CheckCircle2 className="size-3 text-emerald-400 inline" />
            </span>
            <span className="text-[9px] text-white/60 font-mono">
              {activeRole === "teacher"
                ? "JHS 2A · All students marked"
                : activeRole === "parent"
                ? "Paid in full via MoMo Gateway"
                : activeRole === "student"
                ? "Top 5% Term Performance"
                : "Fee payment received · GH₵555.00"}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Floating Micro-Badge Bottom Left (Dynamic per Role) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`badge-bot-${activeRole}`}
          className="absolute -bottom-3 -left-2 sm:-left-4 z-20 hidden sm:flex items-center gap-2.5 rounded-xl border border-blue-500/30 bg-black/85 px-3.5 py-2 shadow-xl backdrop-blur-xl"
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-500/30">
            {activeRole === "teacher" ? (
              <BookOpen className="size-4 text-blue-400" />
            ) : activeRole === "parent" ? (
              <Radio className="size-4 text-blue-400" />
            ) : activeRole === "student" ? (
              <Calendar className="size-4 text-blue-400" />
            ) : (
              <TrendingUp className="size-4 text-blue-400" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold text-white block">
              {activeRole === "teacher"
                ? "4 Active Classes Linked"
                : activeRole === "parent"
                ? "SMS Alert Sent: 7:45 AM"
                : activeRole === "student"
                ? "Timetable Period Synced"
                : "100.0% Attendance Rate"}
            </span>
            <span className="text-[9px] text-white/50 block">
              {activeRole === "teacher"
                ? "Lesson Notes & Marks Synced"
                : activeRole === "parent"
                ? "Arrived safely in class"
                : activeRole === "student"
                ? "Core Maths · Room 4B"
                : "Term student presence tracked"}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
