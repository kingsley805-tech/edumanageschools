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
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Main Ash/Black Frame */}
      <div className="relative rounded-2xl sm:rounded-3xl border border-[#333742] bg-[#14161a] shadow-2xl shadow-black/90 backdrop-blur-xl overflow-hidden transition-all duration-300">
        {/* Browser Top Window Bar */}
        <div className="flex items-center justify-between border-b border-[#282c35] bg-[#1c1f26] px-4 py-2.5 sm:px-5 sm:py-3">
          {/* Window action buttons */}
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#3d424e] inline-block" />
            <span className="size-3 rounded-full bg-[#4f5564] inline-block" />
            <span className="size-3 rounded-full bg-[#6a7285] inline-block" />
          </div>

          {/* Browser Address URL Pill */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#0d0e11] border border-[#2e323b] px-3 py-1 text-[11px] font-mono text-[#a2a8b8]">
            <Lock className="size-3 text-white" />
            <span>portal.edumanage.io</span>
            <span className="text-white font-semibold">{getRoleUrl()}</span>
          </div>

          {/* Dark / Light Mode Switcher Buttons */}
          <div className="flex items-center gap-1 rounded-lg bg-[#0d0e11] p-1 border border-[#2e323b]">
            <button
              type="button"
              onClick={() => setThemeMode("dark")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                themeMode === "dark"
                  ? "bg-[#2c3039] text-white shadow-xs"
                  : "text-[#888e9e] hover:text-white"
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
                  ? "bg-white text-black shadow-xs font-semibold"
                  : "text-[#888e9e] hover:text-white"
              }`}
              title="Light Mode Preview"
            >
              <Sun className="size-3" />
              <span className="hidden xs:inline">Light</span>
            </button>
          </div>
        </div>

        {/* Dashboard Image / Interactive Mockup Area */}
        <div className="relative w-full aspect-[16/9.6] bg-[#101216] overflow-hidden group select-none">
          <AnimatePresence mode="wait">
            {activeRole === "admin" && (
              <motion.div
                key="admin-preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="relative size-full"
              >
                <img
                  src={
                    themeMode === "dark"
                      ? "/assets/media/dashboard-preview-dark.png"
                      : "/assets/media/dashboard-preview-light.png"
                  }
                  alt="EduManage Admin Dashboard Preview"
                  className="w-full h-full object-cover object-top"
                />

                {/* Left overlay to protect internal items */}
                <div className="absolute inset-y-0 left-0 w-[19.2%] backdrop-blur-md bg-[#0a0b0d]/70 border-r border-[#2c3039] flex flex-col items-center justify-center p-2 text-center">
                  <div className="size-8 rounded-full bg-[#20232a] border border-[#373c47] flex items-center justify-center mb-1.5 shadow-md">
                    <Shield className="size-4 text-white" />
                  </div>
                  <span className="text-[9px] font-semibold text-white leading-tight hidden sm:block">
                    Secured Role
                  </span>
                  <span className="text-[8px] text-[#8e95a5] leading-none mt-0.5 hidden sm:block">
                    Admin Portal
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
                transition={{ duration: 0.3 }}
                className={`relative size-full p-4 sm:p-5 flex flex-col justify-between ${
                  themeMode === "dark" ? "bg-[#14161b] text-white" : "bg-[#f4f5f7] text-[#111215]"
                }`}
              >
                {/* Teacher Workspace Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#282c35]">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-[#242730] border border-[#3e4452] flex items-center justify-center text-white font-bold text-xs">
                      SK
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Sir Kingsley</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#232731] text-[#cdd1dc] border border-[#3a3f4e]">
                          Senior Academic Staff
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#9ca2b1] font-medium mt-0.5">4 Assigned Classes · Core Mathematics & Science</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#20242d] text-white border border-[#373d4b] flex items-center gap-1">
                    <Check className="size-3 text-white" /> Register Marked Today
                  </span>
                </div>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-4 gap-2 my-auto">
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Assigned Classes</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">4 Classes</span>
                    <span className="text-[9px] text-[#747b8d]">120 Total Students</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Attendance Rate</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">100.0%</span>
                    <span className="text-[9px] text-[#747b8d]">Roll Call Verified</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Lesson Notes</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">12 / 12</span>
                    <span className="text-[9px] text-[#747b8d]">Approved by Admin</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Report Cards</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">Ready</span>
                    <span className="text-[9px] text-[#747b8d]">Terminal Gradebooks</span>
                  </div>
                </div>

                {/* Today's Schedule & Quick Action Row */}
                <div className={`p-3 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-[#252933] border border-[#383e4c] flex items-center justify-center text-white">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Next Period: JHS 2A — Core Mathematics</span>
                      <span className="text-[10px] text-[#939aa9]">Room 4B · 10:00 AM - 11:30 AM · Lesson 14: Algebra</span>
                    </div>
                  </div>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors">
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
                transition={{ duration: 0.3 }}
                className={`relative size-full p-4 sm:p-5 flex flex-col justify-between ${
                  themeMode === "dark" ? "bg-[#14161b] text-white" : "bg-[#f4f5f7] text-[#111215]"
                }`}
              >
                {/* Parent Portal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#282c35]">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-[#242730] border border-[#3e4452] flex items-center justify-center text-white font-bold text-xs">
                      KM
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Kwame Mensah</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#232731] text-[#cdd1dc] border border-[#3a3f4e]">
                          SHS 1 Science · ID #ADM-2026-004
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#9ca2b1] font-medium mt-0.5">Parent: Mr. & Mrs. Mensah · Primary Guardian</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#20242d] text-white border border-[#373d4b] flex items-center gap-1">
                    <Check className="size-3 text-white" /> Tuition Paid In Full
                  </span>
                </div>

                {/* 4 Parent Metric Cards */}
                <div className="grid grid-cols-4 gap-2 my-auto">
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Outstanding Fees</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">GH₵0.00</span>
                    <span className="text-[9px] text-[#747b8d]">Invoice #8821 Cleared</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Term Attendance</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">99.2%</span>
                    <span className="text-[9px] text-[#747b8d]">SMS Alerts Active</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Class Rank</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">2nd / 48</span>
                    <span className="text-[9px] text-[#747b8d]">Aggregate 07 (Grade A)</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Report Card</span>
                    <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">Verified</span>
                    <span className="text-[9px] text-[#747b8d]">Official PDF</span>
                  </div>
                </div>

                {/* Recent Notification Banner */}
                <div className={`p-3 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-[#252933] border border-[#383e4c] flex items-center justify-center text-white">
                      <Radio className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Morning SMS Alert: Arrived safely at 7:45 AM</span>
                      <span className="text-[10px] text-[#939aa9]">Automated gate check · Verified by Class Teacher</span>
                    </div>
                  </div>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors">
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
                transition={{ duration: 0.3 }}
                className={`relative size-full p-4 sm:p-5 flex flex-col justify-between ${
                  themeMode === "dark" ? "bg-[#14161b] text-white" : "bg-[#f4f5f7] text-[#111215]"
                }`}
              >
                {/* Student Learning Desk Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#282c35]">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-[#242730] border border-[#3e4452] flex items-center justify-center text-white font-bold text-xs">
                      KM
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Kwame Mensah</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#232731] text-[#cdd1dc] border border-[#3a3f4e]">
                          SHS 2 Science Section A
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#9ca2b1] font-medium mt-0.5">Student Portal · Enrolled in 8 Subjects</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#20242d] text-white border border-[#373d4b] flex items-center gap-1">
                    <Award className="size-3 text-white" /> Top 5% Academic Honor Roll
                  </span>
                </div>

                {/* 4 Student Metric Cards */}
                <div className="grid grid-cols-4 gap-2 my-auto">
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Next Period</span>
                    <span className="text-base sm:text-lg font-bold text-white block mt-0.5">Physics</span>
                    <span className="text-[9px] text-[#747b8d]">Lab 2 · 10:30 AM</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">WAEC Practice</span>
                    <span className="text-base sm:text-lg font-bold text-white block mt-0.5">94% Score</span>
                    <span className="text-[9px] text-[#747b8d]">Top Percentile</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Homework Due</span>
                    <span className="text-base sm:text-lg font-bold text-white block mt-0.5">2 Tasks</span>
                    <span className="text-[9px] text-[#747b8d]">Maths & Elective Chem</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"}`}>
                    <span className="text-[10px] text-[#959cb0] block font-medium">Terminal Grade</span>
                    <span className="text-base sm:text-lg font-bold text-white block mt-0.5">Grade A</span>
                    <span className="text-[9px] text-[#747b8d]">Aggregate 07</span>
                  </div>
                </div>

                {/* Timetable Schedule Bar */}
                <div className={`p-3 rounded-xl border ${themeMode === "dark" ? "bg-[#1a1d24] border-[#2c303a]" : "bg-white border-[#dcdfe5] shadow-xs"} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-[#252933] border border-[#383e4c] flex items-center justify-center text-white">
                      <BookOpen className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block">Online Exam Ready: 2026 WAEC / BECE Mock Series</span>
                      <span className="text-[10px] text-[#939aa9]">40 Multiple Choice Questions · Instant Evaluation</span>
                    </div>
                  </div>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors">
                    Start Practice Exam
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Micro-Badge Top Right */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`badge-top-${activeRole}`}
          className="absolute -top-3 -right-2 sm:-right-4 z-20 flex items-center gap-2 rounded-xl border border-[#3a404e] bg-[#16181e]/95 px-3 py-1.5 shadow-xl backdrop-blur-xl"
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <span className="relative flex size-2">
            <span className="relative inline-flex rounded-full size-2 bg-white" />
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
              <CheckCircle2 className="size-3 text-white inline" />
            </span>
            <span className="text-[9px] text-[#949cae] font-mono">
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

      {/* Floating Micro-Badge Bottom Left */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`badge-bot-${activeRole}`}
          className="absolute -bottom-3 -left-2 sm:-left-4 z-20 hidden sm:flex items-center gap-2.5 rounded-xl border border-[#3a404e] bg-[#16181e]/95 px-3.5 py-2 shadow-xl backdrop-blur-xl"
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#252831] border border-[#393e4d]">
            {activeRole === "teacher" ? (
              <BookOpen className="size-4 text-white" />
            ) : activeRole === "parent" ? (
              <Radio className="size-4 text-white" />
            ) : activeRole === "student" ? (
              <Calendar className="size-4 text-white" />
            ) : (
              <TrendingUp className="size-4 text-white" />
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
            <span className="text-[9px] text-[#949cae] block">
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
