import { motion } from "framer-motion";

const particles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${6 + (i * 5.4) % 88}%`,
  top: `${10 + (i * 7.1) % 80}%`,
  size: 2 + (i % 2),
  duration: 4 + (i % 4),
  delay: (i % 6) * 0.4,
}));

export default function AnimatedBackground() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#121418]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Subtle Ash Geometric Grid */}
      <motion.div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#4a505f 1px, transparent 1px), linear-gradient(90deg, #4a505f 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        animate={{ backgroundPosition: ["0px 0px", "48px 48px"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      {/* Subtle ash / white particles */}
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-[#9ba1b0]"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
          }}
          animate={{
            opacity: [0.1, 0.4, 0.1],
            y: [0, -10, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}
