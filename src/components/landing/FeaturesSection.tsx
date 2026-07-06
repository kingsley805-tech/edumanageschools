import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileText,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import FeatureCard, { type FeatureItem } from "@/components/landing/FeatureCard";
import SectionHeading from "@/components/landing/SectionHeading";
import { staggerContainer } from "@/components/landing/landingMotion";

const features: FeatureItem[] = [
  {
    icon: ClipboardCheck,
    title: "Attendance & Registers",
    description:
      "Digital class registers with teacher workflows, parent SMS alerts, and real-time absence tracking across every class.",
  },
  {
    icon: FileText,
    title: "Report Cards & Grading",
    description:
      "Build report cards, manage grade scales, archive results, and publish academic reports with approval workflows.",
  },
  {
    icon: CreditCard,
    title: "Smart Billing & Finance",
    description:
      "Fees, invoices, Paystack payments, outstanding balances, and family billing — all in one financial hub.",
  },
  {
    icon: Bell,
    title: "Parent SMS Notifications",
    description:
      "Automatic attendance SMS to parents. Configurable templates, delivery logs, and subscription-aware limits.",
  },
  {
    icon: Calendar,
    title: "Timetable & Scheduling",
    description:
      "Plan classes, subjects, and weekly timetables. Keep teachers, rooms, and academic periods organized.",
  },
  {
    icon: Users,
    title: "Multi-Portal Access",
    description:
      "Dedicated experiences for administrators, teachers, accountants, auditors, parents, and students with role-based permissions.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description:
      "Dashboard KPIs, academic reports, billing summaries, and operational visibility for data-driven school leadership.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "RBAC, audit logs, subscription packages, and secure cloud infrastructure built for schools at scale.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          badge="Platform Features"
          badgeIcon={Sparkles}
          title="Everything your school needs,"
          highlight="in one place"
          description="From daily attendance to end-of-term report cards and fee collection — EduManage brings academics, finance, and communication together."
        />

        <motion.div
          className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
