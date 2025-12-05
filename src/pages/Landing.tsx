import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, BookOpen, TrendingUp, Shield, Zap, CheckCircle, ArrowRight, Building, Target, Clock } from "lucide-react";
import heroImage from "@/assets/hero-education.jpg";
const Landing = () => {
  const navigate = useNavigate();
  const features = [{
    icon: Users,
    title: "Multi-Role Access",
    description: "Admins, teachers, parents & students in one secure ecosystem.",
    gradient: "from-blue-500 to-cyan-500"
  }, {
    icon: BookOpen,
    title: "Academics & Results",
    description: "Attendance, assignments, report cards & student analytics.",
    gradient: "from-purple-500 to-pink-500"
  }, {
    icon: TrendingUp,
    title: "Smart Finance",
    description: "Automated invoicing, real-time payments & receipts.",
    gradient: "from-green-500 to-emerald-500"
  }, {
    icon: Shield,
    title: "Bank-Grade Security",
    description: "Role-based access with full data encryption.",
    gradient: "from-orange-500 to-red-500"
  }, {
    icon: Zap,
    title: "Real-Time System",
    description: "Instant updates, notifications & fast performance.",
    gradient: "from-yellow-500 to-amber-500"
  }, {
    icon: GraduationCap,
    title: "Growth Insights",
    description: "Advanced reports to drive smarter school decisions.",
    gradient: "from-indigo-500 to-purple-500"
  }];
  const benefits = [{
    icon: Clock,
    title: "Save Time",
    description: "Reduce administrative work by 60% with automated processes"
  }, {
    icon: Target,
    title: "Improve Results",
    description: "Track student performance and identify areas for improvement"
  }, {
    icon: Building,
    title: "Scale Easily",
    description: "Grow your institution without adding administrative overhead"
  }];
  return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(236,72,153,0.2),transparent_50%)]"></div>
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/20 border-b border-white/10 supports-[backdrop-filter]:bg-background/10 shadow-lg shadow-black/10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-30"></div>
              <GraduationCap className="h-8 w-8 text-primary relative" />
            </div>
            <span className="text-xl font-bold tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/auth")} className="border-2 hover:border-primary/50 transition-all duration-200">
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 group">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Glowing Background Elements */}
        <div className="absolute top-1/4 -left-10 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-10 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Glowing orbs */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-cyan-400/40 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 bg-violet-400/40 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        
        <div className="container relative">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div className="space-y-8 animate-fade-up relative z-10">
              <div className="inline-block rounded-full backdrop-blur-xl bg-white/10 px-4 py-2 text-sm font-medium text-white border border-white/20 shadow-lg shadow-blue-500/20">
                <span className="relative flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Trusted by 500+ Schools Worldwide
                </span>
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight text-white drop-shadow-2xl">
                  School Management
                  <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
                    Made Simple
                  </span>
                </h1>
                <p className="text-xl text-white/80 max-w-xl leading-relaxed drop-shadow-lg">
                  Comprehensive school management platform that handles academics, finance, communication, and operations in one integrated system.
                </p>
              </div>

              <div className="flex gap-4 flex-wrap">
                <Button size="lg" onClick={() => navigate("/auth")} className="relative bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-lg px-8 hover:shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200 group overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative z-10 flex items-center">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 border-2 border-white/30 text-white backdrop-blur-xl bg-white/10 hover:bg-white/20 hover:border-white/50 hover:shadow-lg hover:shadow-white/20 transition-all duration-200" onClick={() => navigate("/auth")}>
                  Sign In to Portal
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 pt-8">
                {[{
                number: "500+",
                label: "Schools"
              }, {
                number: "50k+",
                label: "Students"
              }, {
                number: "99.9%",
                label: "Reliability"
              }].map((stat, index) => <div key={index} className="text-center backdrop-blur-xl bg-white/10 rounded-2xl p-4 border border-white/20 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105">
                    <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2 drop-shadow-lg">{stat.number}</div>
                    <div className="text-sm text-white/70 font-medium">{stat.label}</div>
                  </div>)}
              </div>
            </div>

            <div className="relative animate-scale-in">
              {/* Glowing effect around image */}
              <div className="absolute -inset-8 rounded-3xl bg-gradient-to-r from-cyan-500/40 via-blue-500/40 to-purple-500/40 blur-3xl opacity-60 animate-pulse"></div>
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-400/20 to-purple-400/20 blur-xl"></div>
              <div className="relative rounded-3xl shadow-2xl overflow-hidden border border-white/20 backdrop-blur-xl bg-white/5">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10"></div>
                <img src={heroImage} alt="Education Management System" className="w-full h-auto object-cover relative z-0" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/20 to-transparent"></div>
        <div className="container relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 text-white drop-shadow-lg">
              Why Schools Choose <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">EduManage</span>
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Transform your school operations with our comprehensive management platform
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit, index) => <div key={index} className="text-center p-8 backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 animate-fade-in group" style={{
            animationDelay: `${index * 0.2}s`
          }}>
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-6 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-all duration-300 shadow-lg shadow-cyan-500/20">
                  <benefit.icon className="h-8 w-8 text-cyan-300" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">{benefit.title}</h3>
                <p className="text-white/70">{benefit.description}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent"></div>
        <div className="container relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white drop-shadow-lg">
              Everything You Need
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">In One Platform</span>
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
              Comprehensive tools designed specifically for educational institutions of all sizes
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => <div key={index} className="group relative backdrop-blur-xl bg-white/10 rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 hover:scale-105 animate-fade-in overflow-hidden" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl`}></div>
                <div className={`absolute -inset-1 bg-gradient-to-br ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-sm`}></div>
                <div className="relative z-10">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg group-hover:shadow-xl`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-cyan-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-white/70 leading-relaxed">{feature.description}</p>
                </div>
              </div>)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/30 to-transparent"></div>
        <div className="container relative z-10">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-blue-600 to-purple-600 p-12 md:p-16 text-center shadow-2xl border border-white/20 backdrop-blur-xl">
            {/* Glowing effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-cyan-400 via-blue-400 to-purple-400 rounded-3xl blur-xl opacity-50 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20"></div>
            
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl sm:text-5xl font-bold text-white drop-shadow-lg">
                  Ready to Get Started?
                </h2>
                <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Join hundreds of schools already using EduManage to streamline their operations and enhance educational outcomes.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-white/90 text-lg px-8 py-6 hover:scale-105 transition-all duration-200 font-semibold shadow-xl hover:shadow-2xl hover:shadow-white/20" onClick={() => navigate("/auth")}>
                  Create Your Account
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="border-2 border-white/50 text-white backdrop-blur-xl bg-white/10 hover:bg-white/20 text-lg px-8 py-6 hover:scale-105 transition-all duration-200 font-semibold">
                  Sign In to Portal
                </Button>
              </div>
              
              <p className="text-white/70 text-sm">
                Setup takes less than 10 minutes • No credit card required
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-12 backdrop-blur-xl bg-black/20">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-lg blur opacity-50 animate-pulse"></div>
                <GraduationCap className="h-6 w-6 text-cyan-300 relative" />
              </div>
              <span className="font-semibold text-lg text-white">EduManage</span>
            </div>
            <div className="flex gap-6 text-sm text-white/70">
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/privacy")}>Privacy</span>
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/terms")}>Terms</span>
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/contact")}>Contact</span>
            </div>
            <p className="text-sm text-white/60">
              © 2025 EduManage. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Landing;