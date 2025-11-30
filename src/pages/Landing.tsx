import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Users,
  BookOpen,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  Building,
  Target,
  Clock
} from "lucide-react";
import heroImage from "@/assets/hero-education.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Multi-Role Access",
      description: "Admins, teachers, parents & students in one secure ecosystem.",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: BookOpen,
      title: "Academics & Results",
      description: "Attendance, assignments, report cards & student analytics.",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: TrendingUp,
      title: "Smart Finance",
      description: "Automated invoicing, real-time payments & receipts.",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "Role-based access with full data encryption.",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Zap,
      title: "Real-Time System",
      description: "Instant updates, notifications & fast performance.",
      gradient: "from-yellow-500 to-amber-500"
    },
    {
      icon: GraduationCap,
      title: "Growth Insights",
      description: "Advanced reports to drive smarter school decisions.",
      gradient: "from-indigo-500 to-purple-500"
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: "Save Time",
      description: "Reduce administrative work by 60% with automated processes"
    },
    {
      icon: Target,
      title: "Improve Results",
      description: "Track student performance and identify areas for improvement"
    },
    {
      icon: Building,
      title: "Scale Easily",
      description: "Grow your institution without adding administrative overhead"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b supports-[backdrop-filter]:bg-background/60">
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
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth")}
              className="border-2 hover:border-primary/50 transition-all duration-200"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 group"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-1/4 -left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
        
        <div className="container relative">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div className="space-y-8 animate-fade-up">
              <div className="inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary border border-primary/20">
                Trusted by 500+ Schools Worldwide
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight">
                  School Management
                  <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Made Simple
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Comprehensive school management platform that handles academics, finance, communication, and operations in one integrated system.
                </p>
              </div>

              <div className="flex gap-4 flex-wrap">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-gradient-to-r from-primary to-accent text-lg px-8 hover:shadow-xl hover:scale-105 transition-all duration-200 group"
                >
                  Get Started Now
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 border-2 hover:border-primary/50 transition-all duration-200"
                  onClick={() => navigate("/auth")}
                >
                  Sign In to Portal
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 pt-8">
                {[
                  { number: "500+", label: "Schools" },
                  { number: "50k+", label: "Students" },
                  { number: "99.9%", label: "Reliability" }
                ].map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">{stat.number}</div>
                    <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative animate-scale-in">
              <div className="absolute -inset-8 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl opacity-60"></div>
              <div className="relative rounded-3xl shadow-2xl overflow-hidden border border-border/50">
                <img
                  src={heroImage}
                  alt="Education Management System"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">
              Why Schools Choose EduManage
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your school operations with our comprehensive management platform
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="text-center p-6 animate-fade-in"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-6">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80"></div>
        <div className="container relative">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Everything You Need
              <span className="block text-primary">In One Platform</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Comprehensive tools designed specifically for educational institutions of all sizes
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-background rounded-2xl p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-border/50 hover:border-primary/20 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                <div className="relative z-10">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-12 md:p-16 text-center shadow-2xl border border-primary/20">
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl sm:text-5xl font-bold text-white">
                  Ready to Get Started?
                </h2>
                <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Join hundreds of schools already using EduManage to streamline their operations and enhance educational outcomes.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 hover:scale-105 transition-all duration-200 font-semibold shadow-lg"
                  onClick={() => navigate("/auth")}
                >
                  Create Your Account
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 text-lg px-8 py-6 hover:scale-105 transition-all duration-200 font-semibold"
                  onClick={() => navigate("/auth")}
                >
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
      <footer className="border-t py-12 bg-muted/20">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-30"></div>
                <GraduationCap className="h-6 w-6 text-primary relative" />
              </div>
              <span className="font-semibold text-lg">EduManage</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 EduManage. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
