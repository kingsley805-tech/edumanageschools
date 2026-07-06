import { motion } from "framer-motion";
import { fadeIn } from "@/components/landing/landingMotion";
import { landingPalette } from "@/components/landing/landingPalette";

export type PartnerItem = {
  name: string;
  tagline: string;
  initials: string;
};

type Props = {
  partner: PartnerItem;
};

export default function PartnerLogo({ partner }: Props) {
  return (
    <motion.div
      variants={fadeIn}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={`group flex flex-col items-center justify-center rounded-2xl px-4 py-6 backdrop-blur-sm transition-colors sm:px-6 sm:py-8 ${landingPalette.card}`}
    >
      <div
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-green-500/30 bg-green-500 text-sm font-bold text-white shadow-lg shadow-green-500/20 transition-transform group-hover:scale-105 sm:h-16 sm:w-16 sm:text-base"
        aria-hidden
      >
        {partner.initials}
      </div>
      <p className="text-center text-sm font-semibold text-white">{partner.name}</p>
      <p className="mt-1 text-center text-[11px] text-white/45 sm:text-xs">{partner.tagline}</p>
    </motion.div>
  );
}
