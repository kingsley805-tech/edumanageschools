import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, BookOpen, TrendingUp, Shield, Zap, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import heroImage from "@/assets/hero-education.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Multi-Role Management",
      description: "Seamlessly manage admins, teachers, parents, and students in one unified platform.",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: BookOpen,
      title: "Academic Excellence",
      description: "Track attendance, assignments, grades, and performance with powerful analytics.",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: TrendingUp,
      title: "Financial Clarity",
      description: "Automated fee management, invoicing, and secure payment processing.",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with role-based access control and data encryption.",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Real-time updates, instant notifications, and responsive across all devices.",
      gradient: "from-yellow-500 to-amber-500"
    },
    {
      icon: GraduationCap,
      title: "Growth Focused",
      description: "Insights and reports to help your institution grow and improve continuously.",
      gradient: "from-indigo-500 to-purple-500"
    }
  ];

  const stats = [
    { number: "500+", label: "Schools Trust Us" },
    { number: "50K+", label: "Active Students" },
    { number: "99.9%", label: "System Uptime" },
    { number: "24/7", label: "Support" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-30"></div>
              <GraduationCap className="h-8 w-8 text-primary relative" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          <Button 
            onClick={() => navigate("/auth")} 
            className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 group"
          >
            Sign In
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5"></div>
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
        
        <div className="container relative">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-20 items-center">
            <div className="animate-fade-up space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary border border-primary/20">
                <Sparkles className="h-4 w-4" />
                Next-Gen School Management
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
                  Empower
                  <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Education
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                  A comprehensive platform designed for modern schools. Manage students, track performance, 
                  handle finances, and engage parents — all in one beautiful, intuitive interface.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-gradient-to-r from-primary to-accent text-lg px-8 py-6 hover:shadow-xl hover:scale-105 transition-all duration-200 group"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6 border-2 hover:border-primary/50 transition-all duration-200"
                  onClick={() => navigate("/auth")}
                >
                  Book a Demo
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.number}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative animate-scale-in">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl opacity-50 animate-pulse"></div>
              <div className="relative rounded-2xl shadow-2xl overflow-hidden border border-border/50">
                <img 
                  src={heroImage} 
                  alt="Students learning together" 
                  className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700"
                />
                {/* Floating elements */}
                <div className="absolute top-6 right-6 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/30"></div>
        <div className="container relative">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold sm:text-5xl mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Everything You Need
              <span className="block text-primary">In One Place</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Built for administrators, teachers, parents, and students with powerful features 
              tailored for each role in your educational ecosystem.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group relative bg-card rounded-2xl p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-border/50 hover:border-primary/20 animate-fade-in"
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

      {/* CTA Section */}
      <section className="py-20 relative">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-12 md:p-16 text-center border border-primary/20 shadow-2xl">
            {/* Animated background elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-white sm:text-5xl">
                  Ready to Transform Your School?
                </h2>
                <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Join hundreds of forward-thinking schools using EduManage to streamline operations 
                  and improve student outcomes.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 hover:scale-105 transition-all duration-200 font-semibold shadow-lg"
                >
                  Start Free Trial
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white text-white hover:bg-white/10 text-lg px-8 py-6 hover:scale-105 transition-all duration-200 font-semibold"
                  onClick={() => navigate("/auth")}
                >
                  Schedule Demo
                </Button>
              </div>
              
              <p className="text-white/70 text-sm">
                No credit card required • 14-day free trial • Full feature access
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
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
              © 2024 EduManage. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
