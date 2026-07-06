import { motion } from "framer-motion";
import { Handshake } from "lucide-react";
import PartnerLogo, { type PartnerItem } from "@/components/landing/PartnerLogo";
import SectionHeading from "@/components/landing/SectionHeading";
import { staggerContainer } from "@/components/landing/landingMotion";

import { landingPalette } from "@/components/landing/landingPalette";

const partners: PartnerItem[] = [
  { name: "Paystack", tagline: "Online payments", initials: "PS" },
  { name: "Arkesel", tagline: "SMS delivery", initials: "AK" },
  { name: "Ghana Education Service", tagline: "Public education", initials: "GES" },
  { name: "Africa EdTech Alliance", tagline: "Innovation network", initials: "AE" },
  { name: "School Admin Guild", tagline: "Leadership community", initials: "SA" },
  { name: "CloudSecure", tagline: "Infrastructure", initials: "CS" },
];

export default function PartnersSection() {
  return (
    <section id="partners" className="relative scroll-mt-24 border-t border-white/10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          badge="Trusted Partners"
          badgeIcon={Handshake}
          title="Built with leaders who power"
          highlight="modern schools"
          description="We collaborate with payment providers, messaging platforms, and education communities to deliver a reliable experience for every stakeholder."
        />

        <motion.div
          className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {partners.map((partner) => (
            <PartnerLogo key={partner.name} partner={partner} />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mx-auto mt-10 max-w-xl text-center text-xs text-white/40 sm:text-sm"
        >
          Interested in partnering with EduManage?{" "}
          <a href="mailto:partners@edumanage.app" className={`underline-offset-2 hover:underline ${landingPalette.link}`}>
            Get in touch
          </a>
        </motion.p>
      </div>
    </section>
  );
}
