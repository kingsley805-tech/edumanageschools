import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Lock,
  School,
  TrendingUp,
  CheckCircle2,
  CreditCard,
  Calendar,
  Award,
} from "lucide-react";

export function AuthHeroPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#060c1d] via-[#09112a] to-[#040816] text-white lg:flex lg:w-[44%] xl:w-[42%] lg:flex-col lg:justify-between lg:p-7 xl:p-8 select-none shrink-0 border-r border-white/10">
      {/* Background ambient lighting and fine mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
      />

      {/* ── Top Brand Header ─────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between">
        <Link to="/landing" className="inline-flex items-center group">
          <img
            src="/assets/edumanageLogo.png"
            alt="EduManage"
            className="h-8 w-auto object-contain brightness-0 invert drop-shadow-sm group-hover:opacity-90 transition-opacity"
            draggable={false}
          />
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10 text-[11px] font-medium text-blue-200">
          <Lock className="size-3 text-emerald-400" />
          <span>SSL 256-Bit Encrypted</span>
        </div>
      </div>

      {/* ── Main Content Body (Compacted Layout without big empty gaps) ─ */}
      <div className="relative z-10 my-auto py-4 space-y-4">
        {/* Shimmer Badge & Headline */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950/60 backdrop-blur-md border border-blue-500/30 text-[11px] font-semibold text-blue-300 shadow-xs">
            <School className="size-3 text-blue-400" />
            <span>Next-Gen School Operations</span>
          </div>

          <h1 className="text-2xl xl:text-3xl font-black leading-[1.16] tracking-tight text-white">
            Your school,{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent block xl:inline">
              organized in real-time.
            </span>
          </h1>
          <p className="text-xs leading-relaxed text-white/70 max-w-md font-normal">
            Attendance, examination grades, billing invoices, and communication — seamlessly synchronized across all campus portals.
          </p>
        </div>

        {/* ── Mini Glassmorphic Dashboard Preview Showcase ─────────────── */}
        <div className="relative rounded-2xl border border-white/15 bg-[#0b0f19]/90 p-2 shadow-xl shadow-black/60 backdrop-blur-xl overflow-hidden group">
          {/* Mini Browser Bar */}
          <div className="flex items-center justify-between px-2 pb-1.5 mb-1.5 border-b border-white/10 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500/80" />
              <span className="size-2 rounded-full bg-amber-500/80" />
              <span className="size-2 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 font-mono text-[9px] text-white/60 border border-white/10">
              <Lock className="size-2.5 text-emerald-400" />
              <span>portal.edumanage.io/admin</span>
            </div>
            <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          {/* Mini Dashboard Screenshot with Blurred Sidebar */}
          <div className="relative aspect-[16/8.2] w-full overflow-hidden rounded-lg bg-[#0d1117]">
            <img
              src="/assets/media/dashboard-preview-dark.png"
              alt="EduManage Mini Dashboard"
              className="w-full h-full object-cover object-top"
            />

            {/* Sidebar Privacy Blur */}
            <div className="absolute inset-y-0 left-0 w-[19%] backdrop-blur-md bg-black/55 border-r border-white/10 flex flex-col items-center justify-center">
              <ShieldCheck className="size-3.5 text-blue-400" />
            </div>

            {/* Floating Live Pill on Top Right of Mini Mockup */}
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-black/85 px-2 py-0.5 shadow-md backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[8px] font-bold text-white font-mono">Fee received · GH₵555.00</span>
            </div>

            {/* Floating Live Pill on Bottom Left of Mini Mockup */}
            <div className="absolute bottom-1.5 left-[22%] flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-black/85 px-2 py-0.5 shadow-md backdrop-blur-md">
              <TrendingUp className="size-2.5 text-blue-400" />
              <span className="text-[8px] font-bold text-white">100% Attendance Rate</span>
            </div>
          </div>
        </div>

        {/* ── Compact 2x2 Feature Highlights Grid ─────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-blue-500/25 bg-blue-950/30 backdrop-blur-md">
            <div className="p-1 rounded-md bg-blue-500/20 text-blue-300 shrink-0 mt-0.5">
              <ShieldCheck className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Role-Based Access</p>
              <p className="text-[9px] text-white/50 leading-tight mt-0.5 truncate">Strictly isolated scopes</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-emerald-500/25 bg-emerald-950/30 backdrop-blur-md">
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
              <CreditCard className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">GH₵ Smart Billing</p>
              <p className="text-[9px] text-white/50 leading-tight mt-0.5 truncate">Instant MoMo invoicing</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-purple-500/25 bg-purple-950/30 backdrop-blur-md">
            <div className="p-1 rounded-md bg-purple-500/20 text-purple-300 shrink-0 mt-0.5">
              <Calendar className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Live Class Registers</p>
              <p className="text-[9px] text-white/50 leading-tight mt-0.5 truncate">SMS parent notifications</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-amber-500/25 bg-amber-950/30 backdrop-blur-md">
            <div className="p-1 rounded-md bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
              <Award className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Automated Grades</p>
              <p className="text-[9px] text-white/50 leading-tight mt-0.5 truncate">Terminal report cards</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Trust & Compliance Footer ─────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/50">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Multi-Tenant Architecture · ISO 27001 Standards</span>
        </div>
        <span className="font-semibold text-emerald-400">99.99% Uptime</span>
      </div>
    </aside>
  );
}
