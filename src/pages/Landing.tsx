import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play, Shield, Sparkles, Zap } from "lucide-react";
import AnimatedBackground from "@/components/landing/AnimatedBackground";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import DashboardMockup from "@/components/landing/DashboardMockup";
import LandingNavbar from "@/components/landing/LandingNavbar";

const trustStats = [
  { value: 500, suffix: "+", label: "Schools" },
  { value: 98, suffix: "%", label: "Uptime" },
  { value: 50, suffix: "k+", label: "Students" },
];

const fadeUp: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function Landing() {
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <AnimatedBackground />
      <LandingNavbar />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-2 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col justify-center gap-6 py-2 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex shrink-0 flex-col justify-center lg:w-[48%] xl:w-[46%]">
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-200/90 sm:text-xs">
                Trusted by schools across Africa
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.65rem] xl:text-5xl"
            >
              Smart School Management{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                Made Simple
              </span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mt-3 max-w-lg text-sm leading-relaxed text-white/60 sm:mt-4 sm:text-base"
            >
              EduManage brings students, teachers, parents, and administrators together — manage
              academics, timetables, fees, report cards, lesson notes, and attendance from one
              secure platform.
            </motion.p>

            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6"
            >
              <Link
                to="/auth"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:brightness-110"
              >
                <span className="relative z-10">Get Started</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                <motion.span
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10"
              >
                <Play className="h-4 w-4 fill-white/80 text-white/80" />
                Sign in
              </Link>
            </motion.div>

            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/10 pt-5 sm:gap-6"
            >
              {trustStats.map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span className="text-lg font-bold text-white sm:text-xl">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </span>
                  <span className="text-[10px] text-white/45 sm:text-xs">{stat.label}</span>
                </div>
              ))}
              <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 sm:flex">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-medium text-white/60">Role-based security</span>
              </div>
              <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 sm:flex">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-medium text-white/60">Real-time updates</span>
              </div>
            </motion.div>
          </div>

          <div
            id="features"
            className="relative flex min-h-0 flex-1 items-end justify-center lg:w-[52%] xl:w-[54%]"
          >
            <motion.img
              src="/image.png"
              alt="Student with school supplies"
              custom={5}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="relative z-20 w-full max-w-[280px] object-contain object-bottom drop-shadow-[0_24px_48px_rgba(0,0,0,0.45)] sm:max-w-sm lg:max-h-[min(58vh,560px)] lg:max-w-md xl:max-w-lg"
            />
            <div className="pointer-events-none absolute inset-0 z-10 hidden items-start justify-center pt-4 opacity-85 lg:flex">
              <div className="origin-top scale-[0.72] xl:scale-[0.78]">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-4 pb-3 text-center sm:px-6">
        <p className="text-[10px] text-white/35 sm:text-[11px]">
          © {new Date().getFullYear()} EduManage · School Management System ·{" "}
          <Link to="/privacy" className="underline-offset-2 hover:text-white/50 hover:underline">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
