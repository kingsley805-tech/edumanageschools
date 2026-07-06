import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { fadeUp } from "@/components/landing/landingMotion";
import { landingPalette } from "@/components/landing/landingPalette";

type Props = {
  badge: string;
  badgeIcon: LucideIcon;
  title: string;
  highlight: string;
  description: string;
};

export default function SectionHeading({ badge, badgeIcon: Icon, title, highlight, description }: Props) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 ${landingPalette.badge}`}
      >
        <Icon className={`h-3.5 w-3.5 ${landingPalette.badgeIcon}`} />
        <span className={`text-[11px] font-medium sm:text-xs ${landingPalette.badgeText}`}>{badge}</span>
      </motion.div>

      <motion.h2
        custom={1}
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl"
      >
        {title} <span className={landingPalette.highlight}>{highlight}</span>
      </motion.h2>

      <motion.p
        custom={2}
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-3 text-sm leading-relaxed text-white/55 sm:mt-4 sm:text-base"
      >
        {description}
      </motion.p>
    </div>
  );
}
