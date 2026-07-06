import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { fadeIn } from "@/components/landing/landingMotion";
import { landingPalette } from "@/components/landing/landingPalette";

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type Props = {
  feature: FeatureItem;
};

export default function FeatureCard({ feature }: Props) {
  const Icon = feature.icon;

  return (
    <motion.article
      variants={fadeIn}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl p-5 backdrop-blur-sm transition-colors sm:p-6 ${landingPalette.card}`}
    >
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-green-500/10 transition-transform group-hover:scale-105`}>
        <Icon className={`h-5 w-5 ${landingPalette.icon}`} />
      </div>

      <h3 className="text-base font-semibold text-white sm:text-lg">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{feature.description}</p>
    </motion.article>
  );
}
