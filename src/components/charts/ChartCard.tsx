import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DashboardChartCard } from "@/components/metronic/DashboardStatCard";

type ChartCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Dashboard-format chart shell (kt-card) used across reports & analytics pages. */
export function ChartCard({
  title,
  description,
  icon: _icon,
  action,
  children,
  className,
  delay = 0,
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <DashboardChartCard
        title={title}
        description={description}
        action={action}
        className={cn(className)}
      >
        {children}
      </DashboardChartCard>
    </motion.div>
  );
}
