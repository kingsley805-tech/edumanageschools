// @ts-nocheck
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play, Shield, Sparkles, Zap } from "lucide-react";
import AnimatedBackground from "@/components/landing/AnimatedBackground";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import DashboardMockup from "@/components/landing/DashboardMockup";
import FeaturesSection from "@/components/landing/FeaturesSection";
import AboutSection from "@/components/landing/AboutSection";
import LandingNavbar from "@/components/landing/LandingNavbar";
import PartnersSection from "@/components/landing/PartnersSection";
import { fadeUp } from "@/components/landing/landingMotion";
import { landingPalette } from "@/components/landing/landingPalette";

const trustStats = [
  { value: 500, suffix: "+", label: "Schools" },
  { value: 150, suffix: "k+", label: "Students" },
  { value: 99.9, suffix: "%", label: "Uptime" },
];

export default function Landing() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-black text-white">
      <AnimatedBackground />
      <LandingNavbar />

      {/* Hero */}
      <section className="relative z-10 flex min-h-[100dvh] flex-col px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-6 py-8 lg:flex-row lg:items-center lg:gap-10 lg:py-12">
          <div className="flex shrink-0 flex-col justify-center lg:w-[48%] xl:w-[46%]">
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`mb-3 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 ${landingPalette.badge}`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${landingPalette.badgeIcon}`} />
              <span className={`text-[11px] font-medium sm:text-xs ${landingPalette.badgeText}`}>
                All-in-One School Operations & Academics
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.65rem] xl:text-5xl"
            >
              <span className="text-white">EduManage</span>
              <span className="text-white/90"> — The Modern, Complete </span>
              <span className={landingPalette.highlight}>School Management System</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mt-3 max-w-lg text-sm leading-relaxed text-white/60 sm:mt-4 sm:text-base"
            >
              Empower administrators, teachers, students, and parents with a unified platform. Streamline class
              registers, lesson notes, timetabling, report cards, smart billing, SMS notifications, and school
              operations in real-time.
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
                className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${landingPalette.btnPrimary}`}
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
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-all ${landingPalette.btnSecondary}`}
              >
                <Play className="h-4 w-4 fill-white/80 text-white/80" />
                Watch Demo
              </button>
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
                  <span className={`text-lg font-bold sm:text-xl ${landingPalette.highlight}`}>
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </span>
                  <span className="text-[10px] text-white/45 sm:text-xs">{stat.label}</span>
                </div>
              ))}
              <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 sm:flex">
                <Shield className={`h-3.5 w-3.5 ${landingPalette.icon}`} />
                <span className="text-[10px] font-medium text-white/60">Academics & Grading</span>
              </div>
              <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 sm:flex">
                <Zap className={`h-3.5 w-3.5 ${landingPalette.icon}`} />
                <span className="text-[10px] font-medium text-white/60">Finance & Operations</span>
              </div>
            </motion.div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center lg:w-[52%] xl:w-[54%]">
            <DashboardMockup />
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <FeaturesSection />
        <AboutSection />
        <PartnersSection />
      </div>

      <footer id="pricing" className="relative z-10 border-t border-white/10 px-4 py-8 text-center sm:px-6">
        <p className="text-[10px] text-white/35 sm:text-[11px]">
          © {new Date().getFullYear()} EduManage · School Management System ·{" "}
          <Link to="/privacy" className={`underline-offset-2 hover:underline ${landingPalette.link}`}>
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
