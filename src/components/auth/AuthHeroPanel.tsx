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
    <aside className="relative hidden overflow-hidden bg-[#13151a] text-white lg:flex lg:w-[44%] xl:w-[42%] lg:flex-col lg:justify-between lg:p-7 xl:p-8 select-none shrink-0 border-r border-[#292d37]">
      {/* Background subtle architectural grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#4b5161 1px, transparent 1px), linear-gradient(90deg, #4b5161 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* ── Top Brand Header ─────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center group">
          <img
            src="/assets/edumanageLogo.png"
            alt="EduManage"
            className="h-8 w-auto object-contain brightness-0 invert drop-shadow-sm group-hover:opacity-90 transition-opacity"
            draggable={false}
          />
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1f27] border border-[#343a47] text-[11px] font-medium text-[#c1c6d4]">
          <Lock className="size-3 text-white" />
          <span>SSL 256-Bit Encrypted</span>
        </div>
      </div>

      {/* ── Main Content Body ────────────────────────────────────────── */}
      <div className="relative z-10 my-auto py-4 space-y-4">
        {/* Badge & Headline */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1f232c] border border-[#393f4e] text-[11px] font-semibold text-white shadow-xs">
            <School className="size-3 text-white" />
            <span>Next-Gen School Operations</span>
          </div>

          <h1 className="text-2xl xl:text-3xl font-black leading-[1.16] tracking-tight text-white">
            Your school,{" "}
            <span className="text-[#aeb5c6] block xl:inline">
              organized in real-time.
            </span>
          </h1>
          <p className="text-xs leading-relaxed text-[#949cae] max-w-md font-normal">
            Attendance, examination grades, billing invoices, and communication — seamlessly synchronized across all campus portals.
          </p>
        </div>

        {/* ── Mini Dashboard Preview Showcase ─────────────────────────── */}
        <div className="relative rounded-2xl border border-[#313642] bg-[#171920] p-2 shadow-xl shadow-black/70 backdrop-blur-xl overflow-hidden group">
          {/* Mini Browser Bar */}
          <div className="flex items-center justify-between px-2 pb-1.5 mb-1.5 border-b border-[#282c35] text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#3d424e]" />
              <span className="size-2 rounded-full bg-[#4f5564]" />
              <span className="size-2 rounded-full bg-[#6a7285]" />
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-[#0d0e11] px-2 py-0.5 font-mono text-[9px] text-[#959cb0] border border-[#2e323b]">
              <Lock className="size-2.5 text-white" />
              <span>portal.edumanage.io/admin</span>
            </div>
            <span className="text-[9px] font-semibold text-white flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-white" />
              Live
            </span>
          </div>

          {/* Mini Dashboard Screenshot with Blurred Sidebar */}
          <div className="relative aspect-[16/8.2] w-full overflow-hidden rounded-lg bg-[#101216]">
            <img
              src="/assets/media/dashboard-preview-dark.png"
              alt="EduManage Mini Dashboard"
              className="w-full h-full object-cover object-top"
            />

            {/* Sidebar Privacy Blur */}
            <div className="absolute inset-y-0 left-0 w-[19%] backdrop-blur-md bg-[#0a0b0d]/70 border-r border-[#2c3039] flex flex-col items-center justify-center">
              <ShieldCheck className="size-3.5 text-white" />
            </div>

            {/* Floating Live Pill on Top Right of Mini Mockup */}
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5 rounded-lg border border-[#3a404e] bg-[#16181e]/95 px-2 py-0.5 shadow-md">
              <span className="size-1.5 rounded-full bg-white" />
              <span className="text-[8px] font-bold text-white font-mono">Fee received · GH₵555.00</span>
            </div>

            {/* Floating Live Pill on Bottom Left of Mini Mockup */}
            <div className="absolute bottom-1.5 left-[22%] flex items-center gap-1.5 rounded-lg border border-[#3a404e] bg-[#16181e]/95 px-2 py-0.5 shadow-md">
              <TrendingUp className="size-2.5 text-white" />
              <span className="text-[8px] font-bold text-white">100% Attendance Rate</span>
            </div>
          </div>
        </div>

        {/* ── Compact 2x2 Feature Highlights Grid ─────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-[#2c313d] bg-[#171920]">
            <div className="p-1 rounded-md bg-[#232732] text-white shrink-0 mt-0.5 border border-[#383e4e]">
              <ShieldCheck className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Role-Based Access</p>
              <p className="text-[9px] text-[#8e95a6] leading-tight mt-0.5 truncate">Strictly isolated scopes</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-[#2c313d] bg-[#171920]">
            <div className="p-1 rounded-md bg-[#232732] text-white shrink-0 mt-0.5 border border-[#383e4e]">
              <CreditCard className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">GH₵ Smart Billing</p>
              <p className="text-[9px] text-[#8e95a6] leading-tight mt-0.5 truncate">Instant MoMo invoicing</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-[#2c313d] bg-[#171920]">
            <div className="p-1 rounded-md bg-[#232732] text-white shrink-0 mt-0.5 border border-[#383e4e]">
              <Calendar className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Live Class Registers</p>
              <p className="text-[9px] text-[#8e95a6] leading-tight mt-0.5 truncate">SMS parent notifications</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-[#2c313d] bg-[#171920]">
            <div className="p-1 rounded-md bg-[#232732] text-white shrink-0 mt-0.5 border border-[#383e4e]">
              <Award className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Automated Grades</p>
              <p className="text-[9px] text-[#8e95a6] leading-tight mt-0.5 truncate">Terminal report cards</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Trust & Compliance Footer ─────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between border-t border-[#292d37] pt-3 text-[10px] text-[#8c93a4]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-white shrink-0" aria-hidden="true" />
          <span>Multi-Tenant Architecture · ISO 27001 Standards</span>
        </div>
        <span className="font-semibold text-white">99.99% Uptime</span>
      </div>
    </aside>
  );
}
