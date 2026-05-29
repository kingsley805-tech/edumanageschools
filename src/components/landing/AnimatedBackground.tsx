import { motion } from "framer-motion";

const orbs = [
  { size: 420, x: "8%", y: "12%", color: "rgba(22, 163, 74, 0.35)", delay: 0 },
  { size: 320, x: "72%", y: "8%", color: "rgba(59, 130, 246, 0.28)", delay: 1.2 },
  { size: 280, x: "85%", y: "58%", color: "rgba(20, 184, 166, 0.22)", delay: 0.6 },
  { size: 360, x: "15%", y: "72%", color: "rgba(22, 163, 74, 0.25)", delay: 1.8 },
];

const particles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + (i * 5.2) % 88}%`,
  top: `${12 + (i * 7.3) % 76}%`,
  size: 2 + (i % 3),
  duration: 4 + (i % 5),
  delay: (i % 7) * 0.4,
}));

export default function AnimatedBackground() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0a0a0a] to-emerald-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(22,163,74,0.18),transparent)]" />
      <motion.div
        className="absolute inset-0 opacity-40"
        animate={{
          background: [
            "linear-gradient(135deg, rgba(22,163,74,0.08) 0%, transparent 50%, rgba(59,130,246,0.06) 100%)",
            "linear-gradient(225deg, rgba(59,130,246,0.08) 0%, transparent 50%, rgba(22,163,74,0.06) 100%)",
            "linear-gradient(135deg, rgba(22,163,74,0.08) 0%, transparent 50%, rgba(59,130,246,0.06) 100%)",
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: orb.color,
          }}
          animate={{
            y: [0, -24, 0],
            x: [0, i % 2 === 0 ? 16 : -16, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 8 + i,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}

      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-white/30"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
          }}
          animate={{
            opacity: [0.15, 0.6, 0.15],
            y: [0, -12, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      <motion.div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        animate={{ backgroundPosition: ["0px 0px", "64px 64px"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}
