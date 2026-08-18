import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Clock,
  Building2,
  Shield,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  MessageSquare,
  Headset,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { EduManageLogo } from "@/components/EduManageLogo";
import { submitContactInquiry, type ContactInquiryPayload } from "@/lib/contactInquiriesApi";

export default function Contact() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState<ContactInquiryPayload>({
    name: "",
    email: "",
    phone: "",
    institution_name: "",
    category: "deployment",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitContactInquiry(formData);
      if (res.success) {
        setSubmitted(true);
        toast.success("Inquiry received! Our support team and system administration have been notified.");
        setFormData({
          name: "",
          email: "",
          phone: "",
          institution_name: "",
          category: "deployment",
          subject: "",
          message: "",
        });
      } else {
        toast.error("Could not send inquiry. Please try again or email us directly.");
      }
    } catch {
      toast.error("Failed to transmit inquiry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050811] text-slate-100 selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden font-sans antialiased">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full bg-indigo-600/15 blur-[130px]" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-emerald-600/10 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />
      </div>

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050811]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <EduManageLogo size="md" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Platform Overview
              </Link>
              <Link
                to="/privacy"
                className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Privacy & Security
              </Link>
              <Link
                to="/contact"
                className="px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 rounded-lg border border-blue-500/20"
              >
                Contact & Support
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white shadow-xs backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/25 active:scale-95"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/35 hover:brightness-110 active:scale-95"
            >
              Get Started
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 backdrop-blur-md mb-4 shadow-xs"
          >
            <img src="/assets/edumanageLogo.png" alt="EduManage" className="size-4 object-contain" />
            Direct Support & Deployment Desk
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            We&apos;re Here to Help Your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
              School Thrive
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed"
          >
            Have inquiries about school onboarding, bulk student records, fee automation, or enterprise deployments?
            Reach our regional support hub or submit a direct message below.
          </motion.p>
        </div>

        {/* 2-Column Grid: Contact Information & Direct Message Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Left Column: Fast Contact Channels */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-5 space-y-4"
          >
            {/* Phone Lines Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md">
                  <PhoneCall className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Direct Phone Lines</h2>
                  <p className="text-xs text-white/50">Mon–Fri: 7:30 AM – 6:00 PM GMT</p>
                </div>
              </div>
              <div className="space-y-2 mt-4 pt-3 border-t border-white/10">
                <a
                  href="tel:+233503688781"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-sm font-semibold text-emerald-300"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="size-3.5 text-emerald-400" />
                    +233 50 368 8781
                  </span>
                  <span className="text-[11px] text-white/50 font-normal">Primary Line</span>
                </a>
                <a
                  href="tel:+233503230804"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-sm font-semibold text-emerald-300"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="size-3.5 text-emerald-400" />
                    +233 50 323 0804
                  </span>
                  <span className="text-[11px] text-white/50 font-normal">Secondary Line</span>
                </a>
              </div>
            </div>

            {/* Email Support Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-md">
                  <Mail className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Email Communications</h2>
                  <p className="text-xs text-white/50">24/7 dedicated intake</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10">
                <a
                  href="mailto:edumanagesystems@gmail.com"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-sm font-semibold text-blue-300 break-all"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="size-3.5 text-blue-400 shrink-0" />
                    edumanagesystems@gmail.com
                  </span>
                  <ArrowRight className="size-3.5 text-white/40 shrink-0" />
                </a>
              </div>
            </div>

            {/* Regional HQ / Security Guarantee Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-md">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Regional Operations Hub</h2>
                  <p className="text-xs text-white/50">Accra, Ghana · West Africa</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-white/70">
                  <Clock className="size-3.5 text-blue-400 shrink-0" />
                  <span>Business Hours: Monday – Saturday (GMT)</span>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <Shield className="size-3.5 text-emerald-400 shrink-0" />
                  <span>256-Bit Encrypted Data & Tier-3 ISO Compliant Infrastructure</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Interactive Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="lg:col-span-7"
          >
            <div className="rounded-3xl border border-white/15 bg-[#0b0f1d]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Send Direct Message to Administration</h2>
                  <p className="text-xs text-white/60">Delivered straight to the Super Admin portal</p>
                </div>
              </div>

              {submitted ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h2 className="text-base font-bold text-white">Thank you! Message Dispatched</h2>
                  <p className="text-xs text-emerald-200/80 max-w-md mx-auto leading-relaxed">
                    Your inquiry has been successfully transmitted to our platform management team.
                    A representative will contact you via email or phone within 2 business hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white/80">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Kwame Mensah"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-xs sm:text-sm text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white/80">Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="you@school.edu"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-xs sm:text-sm text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white/80">Phone Number (Optional)</label>
                      <input
                        type="tel"
                        placeholder="e.g. +233 50 123 4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-xs sm:text-sm text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white/80">School / Institution Name</label>
                      <input
                        type="text"
                        placeholder="e.g. St. Peter's International Academy"
                        value={formData.institution_name}
                        onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                        className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-xs sm:text-sm text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white/80">Inquiry Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value as ContactInquiryPayload["category"] })
                        }
                        className="w-full h-11 rounded-xl border border-white/15 bg-[#0b0f1d] px-3 text-xs sm:text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      >
                        <option value="deployment">New School Setup / Onboarding</option>
                        <option value="support">Technical & Portal Support</option>
                        <option value="billing">Fee Management & Billing Setup</option>
                        <option value="partnership">Enterprise & Multi-Campus Licensing</option>
                        <option value="general">General Inquiries</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white/80">Subject</label>
                      <input
                        type="text"
                        placeholder="e.g. Inquiring about School ERP setup"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-xs sm:text-sm text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-white/80">Detailed Message *</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Please share details about your requirements, student size, or questions..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-white/[0.04] p-3.5 text-xs sm:text-sm text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 font-bold text-xs sm:text-sm text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Transmitting Inquiry…
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Send Message to Super Admin
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick FAQ Grid */}
        <div className="border-t border-white/10 pt-12 pb-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center justify-center gap-2">
              <HelpCircle className="size-5 text-blue-400" />
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-white/60 mt-1">Quick answers for school administrators and parents</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
              <h3 className="text-xs sm:text-sm font-bold text-blue-300 mb-2">How fast can our school onboard?</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Most schools are fully configured with classrooms, admission numbers, and gradebooks within 24 to 48 hours with our migration tools.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-300 mb-2">Is student data secure and private?</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Yes. All records are isolated per school tenant, encrypted in transit and at rest with AES-256 standards, with strict role-based access control.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
              <h3 className="text-xs sm:text-sm font-bold text-purple-300 mb-2">Can parents pay fees via Mobile Money?</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Yes. EduManage includes direct Paystack integration allowing instant payments via MTN MoMo, Telecel Cash, AT Money, and Cards.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer matching Landing.tsx */}
      <footer className="border-t border-white/10 bg-black/60 px-4 py-6 text-white/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span>© {new Date().getFullYear()} EduManage Cloud Platform.</span>
            <a
              href="mailto:edumanagesystems@gmail.com"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-blue-400 transition-colors"
            >
              <Mail className="size-3 text-blue-400" />
              <span>edumanagesystems@gmail.com</span>
            </a>
            <a
              href="tel:+233503688781"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-emerald-400 transition-colors"
            >
              <Phone className="size-3 text-emerald-400" />
              <span>+233 50 368 8781</span>
            </a>
            <a
              href="tel:+233503230804"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-emerald-400 transition-colors"
            >
              <Phone className="size-3 text-emerald-400" />
              <span>+233 50 323 0804</span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-white/60">
              <Shield className="size-3 text-emerald-400" />
              256-bit Encrypted
            </span>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy & Security
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
