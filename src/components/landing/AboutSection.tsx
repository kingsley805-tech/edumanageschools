import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Globe2, Heart, Lightbulb, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionHeading from "@/components/landing/SectionHeading";
import { fadeIn, fadeUp, staggerContainer } from "@/components/landing/landingMotion";
import { landingPalette } from "@/components/landing/landingPalette";

type ValueItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const values: ValueItem[] = [
  {
    icon: Target,
    title: "Mission-Driven",
    description:
      "We help schools run smarter — less paperwork, more time for teaching, and clearer communication with every family.",
  },
  {
    icon: Globe2,
    title: "Built for Real Schools",
    description:
      "Designed around how Ghanaian and African schools actually operate: registers, fees, report cards, and parent engagement.",
  },
  {
    icon: Lightbulb,
    title: "Always Improving",
    description:
      "From attendance SMS to subscription packages and Paystack billing, we ship features schools ask for every day.",
  },
  {
    icon: Heart,
    title: "People First",
    description:
      "Administrators, teachers, parents, and students each get a portal that respects their role and keeps data secure.",
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="relative scroll-mt-24 border-t border-white/10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          badge="About EduManage"
          badgeIcon={Heart}
          title="Empowering schools to focus on"
          highlight="what matters most"
          description="EduManage is a modern school management platform built to simplify academics, finance, and communication — so educators can spend less time on admin and more time with students."
        />

        <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-2 lg:gap-12 lg:items-start">
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="space-y-5"
          >
            <div className={`rounded-2xl p-6 backdrop-blur-sm sm:p-8 ${landingPalette.cardSolid}`}>
              <h3 className="text-lg font-semibold text-white sm:text-xl">Our story</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
                Schools juggle attendance registers, fee collection, report cards, timetables, and parent updates —
                often across spreadsheets, paper, and disconnected tools. EduManage brings it all into one secure,
                cloud-based system.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
                Whether you are a single private school or a growing institution with hundreds of students, EduManage
                scales with flexible subscription plans, role-based access, and integrations for payments and SMS.
              </p>
            </div>

            <Link
              to="/auth"
              className={`group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${landingPalette.btnPrimary}`}
            >
              Start with EduManage
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
          >
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  variants={fadeIn}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={`group rounded-2xl p-5 backdrop-blur-sm sm:p-6 ${landingPalette.card}`}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-green-500/30 bg-green-500/10 transition-transform group-hover:scale-105">
                    <Icon className={`h-5 w-5 ${landingPalette.icon}`} />
                  </div>
                  <h4 className="text-sm font-semibold text-white sm:text-base">{value.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{value.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
