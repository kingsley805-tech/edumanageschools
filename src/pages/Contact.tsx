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
    <div className="relative min-h-screen w-full bg-[#101216] text-[#e1e4ec] selection:bg-[#2e3340] selection:text-white overflow-x-hidden font-sans antialiased">
      {/* Background Architectural Grid */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#4b5161 1px, transparent 1px), linear-gradient(90deg, #4b5161 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-[#292d37] bg-[#14161d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <EduManageLogo size="md" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className="px-3 py-1.5 text-xs font-medium text-[#98a0b1] hover:text-white hover:bg-[#1f232c] rounded-lg transition-colors"
              >
                Platform Overview
              </Link>
              <Link
                to="/privacy"
                className="px-3 py-1.5 text-xs font-medium text-[#98a0b1] hover:text-white hover:bg-[#1f232c] rounded-lg transition-colors"
              >
                Privacy & Security
              </Link>
              <Link
                to="/contact"
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#222630] rounded-lg border border-[#353a47]"
              >
                Contact & Support
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl border border-[#383e4c] bg-[#1d2028] px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-[#272b36] hover:border-[#4c5466] active:scale-95"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-95"
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
            className="inline-flex items-center gap-2 rounded-full border border-[#393f4e] bg-[#1d212a] px-3.5 py-1 text-xs font-medium text-white backdrop-blur-md mb-4 shadow-xs"
          >
            <img src="/assets/edumanageLogo.png" alt="EduManage" className="size-4 object-contain brightness-0 invert" />
            Direct Support & Deployment Desk
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            We&apos;re Here to Help Your{" "}
            <span className="text-[#aeb5c6]">
              School Thrive
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4 text-sm sm:text-base text-[#949cae] leading-relaxed"
          >
            Have inquiries about school onboarding, bulk student records, fee automation, or enterprise deployments?
            Reach our regional support hub or submit a direct message below.
          </motion.p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Left Column: Fast Contact Channels */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-5 space-y-4"
          >
            {/* Phone Lines Card */}
            <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-6 backdrop-blur-xl shadow-xl hover:border-[#434a5c] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] shadow-md">
                  <PhoneCall className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Direct Phone Lines</h2>
                  <p className="text-xs text-[#8e95a6]">Mon–Fri: 7:30 AM – 6:00 PM GMT</p>
                </div>
              </div>
              <div className="space-y-2 mt-4 pt-3 border-t border-[#292d37]">
                <a
                  href="tel:+233503688781"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#1b1e26] border border-[#2d323e] hover:bg-[#242833] hover:border-[#424959] transition-all text-sm font-semibold text-white"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="size-3.5 text-white" />
                    +233 50 368 8781
                  </span>
                  <span className="text-[11px] text-[#8e95a6] font-normal">Primary Line</span>
                </a>
                <a
                  href="tel:+233503230804"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#1b1e26] border border-[#2d323e] hover:bg-[#242833] hover:border-[#424959] transition-all text-sm font-semibold text-white"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="size-3.5 text-white" />
                    +233 50 323 0804
                  </span>
                  <span className="text-[11px] text-[#8e95a6] font-normal">Secondary Line</span>
                </a>
              </div>
            </div>

            {/* Email Support Card */}
            <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-6 backdrop-blur-xl shadow-xl hover:border-[#434a5c] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] shadow-md">
                  <Mail className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Email Communications</h2>
                  <p className="text-xs text-[#8e95a6]">24/7 dedicated intake</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#292d37]">
                <a
                  href="mailto:edumanagesystems@gmail.com"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#1b1e26] border border-[#2d323e] hover:bg-[#242833] hover:border-[#424959] transition-all text-sm font-semibold text-white break-all"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="size-3.5 text-white shrink-0" />
                    edumanagesystems@gmail.com
                  </span>
                  <ArrowRight className="size-3.5 text-[#8e95a6] shrink-0" />
                </a>
              </div>
            </div>

            {/* Regional HQ */}
            <div className="rounded-2xl border border-[#2c313d] bg-[#171920] p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e] shadow-md">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Regional Operations Hub</h2>
                  <p className="text-xs text-[#8e95a6]">Accra, Ghana · West Africa</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#292d37] space-y-2.5 text-xs text-[#c1c6d4]">
                <div className="flex items-center gap-2 text-[#9da5b6]">
                  <Clock className="size-3.5 text-white shrink-0" />
                  <span>Business Hours: Monday – Saturday (GMT)</span>
                </div>
                <div className="flex items-center gap-2 text-[#9da5b6]">
                  <Shield className="size-3.5 text-white shrink-0" />
                  <span>256-Bit Encrypted Data & Tier-3 ISO Compliant Infrastructure</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Message Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="lg:col-span-7"
          >
            <div className="rounded-3xl border border-[#2d323e] bg-[#16181f] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex size-9 items-center justify-center rounded-xl bg-[#232732] text-white border border-[#383e4e]">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Send Direct Message to Administration</h2>
                  <p className="text-xs text-[#8e95a6]">Delivered straight to the Super Admin portal</p>
                </div>
              </div>

              {submitted ? (
                <div className="rounded-2xl border border-[#383e4e] bg-[#1b1e26] p-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-[#232732] text-white border border-[#383e4e] mx-auto flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h2 className="text-base font-bold text-white">Thank you! Message Dispatched</h2>
                  <p className="text-xs text-[#a4abbd] max-w-md mx-auto leading-relaxed">
                    Your inquiry has been successfully transmitted to our platform management team.
                    A representative will contact you via email or phone within 2 business hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-bold text-black hover:bg-neutral-200 transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Kwame Mensah"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-11 rounded-xl border border-[#2e3340] bg-[#111317] px-3.5 text-xs sm:text-sm text-white placeholder:text-[#5e6678] focus:border-white focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white">Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="you@school.edu"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-11 rounded-xl border border-[#2e3340] bg-[#111317] px-3.5 text-xs sm:text-sm text-white placeholder:text-[#5e6678] focus:border-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="+233 XX XXX XXXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full h-11 rounded-xl border border-[#2e3340] bg-[#111317] px-3.5 text-xs sm:text-sm text-white placeholder:text-[#5e6678] focus:border-white focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-white">School / Institution Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Achimota International"
                        value={formData.institution_name}
                        onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                        className="w-full h-11 rounded-xl border border-[#2e3340] bg-[#111317] px-3.5 text-xs sm:text-sm text-white placeholder:text-[#5e6678] focus:border-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-white">Inquiry Type</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-11 rounded-xl border border-[#2e3340] bg-[#111317] px-3.5 text-xs sm:text-sm text-white focus:border-white focus:outline-none transition-all"
                    >
                      <option value="deployment" className="bg-[#111317] text-white">New School Deployment / Onboarding</option>
                      <option value="billing" className="bg-[#111317] text-white">Tuition & Paystack Billing Inquiries</option>
                      <option value="technical" className="bg-[#111317] text-white">Technical Support & SMS Gateway</option>
                      <option value="partnership" className="bg-[#111317] text-white">Educational Partnership & Multi-Campus</option>
                      <option value="general" className="bg-[#111317] text-white">General Information</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-white">Subject</label>
                    <input
                      type="text"
                      placeholder="Brief topic summary"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full h-11 rounded-xl border border-[#2e3340] bg-[#111317] px-3.5 text-xs sm:text-sm text-white placeholder:text-[#5e6678] focus:border-white focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-white">Message Details *</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Please provide specifics regarding your student population size, required modules, or support request..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-[#2e3340] bg-[#111317] p-3.5 text-xs sm:text-sm text-white placeholder:text-[#5e6678] focus:border-white focus:outline-none transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black font-bold text-xs sm:text-sm hover:bg-neutral-200 transition-all shadow-md active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Transmitting to Administration...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Direct Message</span>
                        <Send className="size-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#292d37] bg-[#14161d]/90 backdrop-blur-xl px-4 py-6 sm:px-8 mt-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-[#8c93a4]">
          <div>
            <span>© {new Date().getFullYear()} EduManage Cloud Platform. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-[#a2a9bb] hover:text-white transition-colors">
              Platform Overview
            </Link>
            <Link to="/privacy" className="text-[#a2a9bb] hover:text-white transition-colors">
              Privacy & Security
            </Link>
            <Link to="/auth" className="text-[#a2a9bb] hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
