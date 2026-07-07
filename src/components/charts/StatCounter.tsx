import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

type StatCounterProps = {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  className?: string;
};

/** Animated count-up number for KPI cards. */
export function StatCounter({ value, duration = 1.1, formatter, className }: StatCounterProps) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{formatter ? formatter(display) : Math.round(display).toLocaleString()}</span>;
}
