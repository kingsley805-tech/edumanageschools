import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Calendar,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";

const barHeights = [38, 52, 45, 68, 58, 82, 70, 90];

const activities = [
  { name: "JHS 2A — Math", detail: "Lesson note submitted", color: "bg-emerald-500" },
  { name: "SHS 1 — Fees", detail: "Payment received", color: "bg-amber-400" },
  { name: "Primary 5", detail: "Report card approved", color: "bg-emerald-500" },
];

const floatY = (delay: number) => ({
  y: [0, -10, 0],
  transition: { duration: 4 + delay * 0.5, repeat: Infinity, ease: "easeInOut" as const, delay },
});

export default function DashboardMockup() {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-[280px] scale-[0.92] sm:max-w-md sm:scale-100 lg:max-w-none"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative rounded-2xl border border-white/15 bg-white/[0.07] p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:rounded-3xl sm:p-4"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="mb-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400/80" />
            <span className="h-2 w-2 rounded-full bg-amber-400/80" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          </div>
          <span className="text-[10px] font-medium text-white/50 sm:text-xs">School Admin</span>
          <Bell className="h-3.5 w-3.5 text-white/40" />
        </div>

        <motion.div
          className="mb-3 grid grid-cols-3 gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}
        >
          {[
            { label: "Students", value: "1,842", icon: Users, trend: "+3.2%" },
            { label: "Attendance", value: "94.2%", icon: TrendingUp, trend: "Today" },
            { label: "Classes", value: "48", icon: GraduationCap, trend: "Active" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              className="rounded-xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-sm"
            >
              <stat.icon className="mb-1 h-3 w-3 text-emerald-400" />
              <p className="text-[9px] text-white/50 sm:text-[10px]">{stat.label}</p>
              <p className="text-xs font-bold text-white sm:text-sm">{stat.value}</p>
              <p className="text-[8px] text-emerald-400/90 sm:text-[9px]">{stat.trend}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="grid grid-cols-5 gap-2">
          <motion.div
            className="col-span-3 rounded-xl border border-white/10 bg-white/[0.05] p-2.5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-white/80 sm:text-xs">Enrollment trend</p>
              <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="flex h-16 items-end justify-between gap-1 sm:h-20">
              {barHeights.map((h, i) => (
                <motion.div
                  key={i}
                  className="w-full rounded-sm bg-gradient-to-t from-emerald-600/80 to-emerald-400/90"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.7 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            className="col-span-2 rounded-xl border border-white/10 bg-white/[0.05] p-2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.65 }}
          >
            <p className="mb-1.5 text-[10px] font-semibold text-white/80">Recent activity</p>
            <div className="space-y-1.5">
              {activities.map((p, i) => (
                <motion.div
                  key={p.name}
                  className="flex items-center gap-1.5"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[8px] text-white/70 sm:text-[9px]">{p.name}</p>
                    <p className="text-[8px] text-white/50 sm:text-[9px]">{p.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute -left-2 top-8 z-10 hidden w-36 rounded-xl sm:block border border-white/20 bg-white/10 p-2.5 shadow-xl backdrop-blur-xl sm:-left-6 sm:w-40"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0, ...floatY(0) }}
        transition={{ delay: 0.9 }}
      >
        <div className="flex items-center gap-2">
          <motion.div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/30">
            <BookOpen className="h-3.5 w-3.5 text-violet-300" />
          </motion.div>
          <div>
            <p className="text-[9px] font-semibold text-white">Lesson notes</p>
            <p className="text-[8px] text-white/50">3 pending review</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -right-1 bottom-16 z-10 hidden w-32 rounded-xl sm:block border border-white/20 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 p-2.5 shadow-xl backdrop-blur-xl sm:-right-4 sm:w-36"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, ...floatY(0.8) }}
        transition={{ delay: 1 }}
      >
        <Calendar className="mb-1 h-3.5 w-3.5 text-emerald-300" />
        <p className="text-[9px] font-semibold text-white">Timetable</p>
        <p className="text-lg font-bold text-white">Published</p>
        <p className="text-[8px] text-emerald-300/80">JHS 1A · Term 2</p>
      </motion.div>

      <motion.div
        className="absolute -right-2 top-2 z-20 hidden items-center gap-2 rounded-xl sm:flex border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-2 shadow-lg backdrop-blur-xl sm:-right-6"
        initial={{ opacity: 0, scale: 0.8, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/40"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Bell className="h-3 w-3 text-emerald-200" />
        </motion.div>
        <div>
          <p className="text-[9px] font-semibold text-white">Fee payment</p>
          <p className="text-[8px] text-white/60">Received · Parent portal</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
