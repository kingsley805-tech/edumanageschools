import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, X } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(236,72,153,0.2),transparent_50%)]"></div>
      
      {/* Glowing Background Elements - Hidden on mobile for performance */}
      <div className="absolute top-1/4 -left-10 w-48 h-48 md:w-72 md:h-72 bg-blue-500/30 rounded-full blur-3xl animate-pulse hidden sm:block"></div>
      <div className="absolute bottom-1/4 -right-10 w-64 h-64 md:w-96 md:h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse hidden sm:block" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-pink-500/20 rounded-full blur-3xl animate-pulse hidden md:block" style={{ animationDelay: '2s' }}></div>
      
      {/* Glowing orbs - Hidden on mobile */}
      <div className="absolute top-20 right-20 w-24 h-24 md:w-32 md:h-32 bg-cyan-400/40 rounded-full blur-2xl animate-pulse hidden lg:block"></div>
      <div className="absolute bottom-20 left-20 w-32 h-32 md:w-40 md:h-40 bg-violet-400/40 rounded-full blur-2xl animate-pulse hidden lg:block" style={{ animationDelay: '1.5s' }}></div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/20 border-b border-white/10 supports-[backdrop-filter]:bg-background/10 shadow-lg shadow-black/10">
        <div className="container flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-30"></div>
              <GraduationCap className="h-6 w-6 md:h-8 md:w-8 text-primary relative" />
            </div>
            <span className="text-lg md:text-xl font-bold tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          <div className="flex gap-2 md:gap-3">
            <Button variant="outline" onClick={() => navigate("/auth")} className="border-2 border-white/30 text-white backdrop-blur-xl bg-white/10 hover:bg-white/20 hover:border-white/50 transition-all duration-200 text-xs md:text-sm px-3 md:px-4 hidden sm:flex">
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 group text-xs md:text-sm px-3 md:px-4">
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="ml-1 md:ml-2 h-3 w-3 md:h-4 md:w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/20 border border-white/30 h-9 w-9 md:h-10 md:w-10"
            >
              <X className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <section className="py-12 md:py-20 relative z-10">
        <div className="container max-w-4xl mx-auto px-4 md:px-6">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl shadow-blue-500/20">
            <div className="text-center mb-8 md:mb-12 animate-fade-up">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-white drop-shadow-lg">
                Terms of <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Service</span>
              </h1>
              <p className="text-sm md:text-base lg:text-xl text-white/80 drop-shadow-lg">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="space-y-6 md:space-y-8 text-white/90 prose prose-invert max-w-none prose-sm md:prose-base">
              <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-cyan-300">1. Acceptance of Terms</h2>
                <p className="text-sm md:text-base text-white/80 leading-relaxed">
                  By accessing and using EduManage, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our platform.
                </p>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-cyan-300">2. Use License</h2>
                <p className="text-sm md:text-base text-white/80 leading-relaxed mb-3 md:mb-4">
                  Permission is granted to temporarily use EduManage for educational management purposes. This license does not include:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-white/80 ml-2 md:ml-4">
                  <li>Modifying or copying the materials</li>
                  <li>Using the materials for any commercial purpose</li>
                  <li>Attempting to reverse engineer any software</li>
                  <li>Removing any copyright or proprietary notations</li>
                </ul>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-cyan-300">3. User Accounts</h2>
                <p className="text-sm md:text-base text-white/80 leading-relaxed mb-3 md:mb-4">
                  To access certain features, you must register for an account. You agree to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-white/80 ml-2 md:ml-4">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and update your information to keep it accurate</li>
                  <li>Maintain the security of your password and account</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use</li>
                </ul>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-cyan-300">4. Acceptable Use</h2>
                <p className="text-sm md:text-base text-white/80 leading-relaxed mb-3 md:mb-4">
                  You agree not to use EduManage to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-white/80 ml-2 md:ml-4">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Transmit any harmful or malicious code</li>
                  <li>Interfere with or disrupt the service</li>
                  <li>Attempt to gain unauthorized access</li>
                  <li>Collect or store personal data about other users</li>
                </ul>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-cyan-300">5. Data and Content</h2>
                <p className="text-sm md:text-base text-white/80 leading-relaxed mb-3 md:mb-4">
                  You retain ownership of all data and content you upload to EduManage. By using our service, you grant us:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-white/80 ml-2 md:ml-4">
                  <li>A license to use, store, and process your data to provide the service</li>
                  <li>Permission to create backups and ensure data security</li>
                  <li>The right to access data as necessary to provide support</li>
                </ul>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
                <h2 className="text-2xl font-bold mb-4 text-cyan-300">6. Payment Terms</h2>
                <p className="text-white/80 leading-relaxed">
                  If you purchase a subscription or service, you agree to pay all fees associated with your account. Fees are billed in advance and are non-refundable except as required by law. We reserve the right to change our pricing with 30 days' notice.
                </p>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.7s' }}>
                <h2 className="text-2xl font-bold mb-4 text-cyan-300">7. Service Availability</h2>
                <p className="text-white/80 leading-relaxed">
                  We strive to provide continuous availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or experience outages. We are not liable for any damages resulting from service interruptions.
                </p>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
                <h2 className="text-2xl font-bold mb-4 text-cyan-300">8. Limitation of Liability</h2>
                <p className="text-white/80 leading-relaxed">
                  To the maximum extent permitted by law, EduManage shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.
                </p>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '0.9s' }}>
                <h2 className="text-2xl font-bold mb-4 text-cyan-300">9. Termination</h2>
                <p className="text-white/80 leading-relaxed">
                  We may terminate or suspend your account and access to the service immediately, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
                </p>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '1s' }}>
                <h2 className="text-2xl font-bold mb-4 text-cyan-300">10. Changes to Terms</h2>
                <p className="text-white/80 leading-relaxed">
                  We reserve the right to modify these terms at any time. We will notify users of material changes via email or through the platform. Continued use after changes constitutes acceptance of the new terms.
                </p>
              </section>

              <section className="animate-fade-in" style={{ animationDelay: '1.1s' }}>
                <h2 className="text-2xl font-bold mb-4 text-cyan-300">11. Contact Information</h2>
                <p className="text-white/80 leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at{" "}
                  <a href="mailto:animanthony7@gmail.com" className="text-cyan-300 hover:text-cyan-200 underline">
                    animanthony7@gmail.com
                  </a>
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-8 md:py-12 backdrop-blur-xl bg-black/20 relative z-10">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-lg blur opacity-50 animate-pulse"></div>
                <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-cyan-300 relative" />
              </div>
              <span className="font-semibold text-base md:text-lg text-white">EduManage</span>
            </div>
            <div className="flex gap-4 md:gap-6 text-xs md:text-sm text-white/70">
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/privacy")}>Privacy</span>
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/terms")}>Terms</span>
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/contact")}>Contact</span>
            </div>
            <p className="text-xs md:text-sm text-white/60 text-center md:text-left">
              © 2025 EduManage. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
