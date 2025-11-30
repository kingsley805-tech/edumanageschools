import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, BookOpen, TrendingUp, Shield, Zap } from "lucide-react";
import heroImage from "@/assets/hero-education.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Multi-Role Management",
      description: "Seamlessly manage admins, teachers, parents, and students in one unified platform."
    },
    {
      icon: BookOpen,
      title: "Academic Excellence",
      description: "Track attendance, assignments, grades, and performance with powerful analytics."
    },
    {
      icon: TrendingUp,
      title: "Financial Clarity",
      description: "Automated fee management, invoicing, and secure payment processing."
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with role-based access control and data encryption."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Real-time updates, instant notifications, and responsive across all devices."
    },
    {
      icon: GraduationCap,
      title: "Growth Focused",
      description: "Insights and reports to help your institution grow and improve continuously."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-accent">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="animate-fade-up">
              <div className="inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6">
                Next-Gen School Management
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl mb-6">
                Empower Your
                <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Educational Journey
                </span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
                A comprehensive platform designed for modern schools. Manage students, track performance, 
                handle finances, and engage parents - all in one beautiful interface.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-gradient-to-r from-primary to-accent text-lg px-8"
                >
                  Get Started
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => navigate("/auth")> 
                  Sign-In 
                </Button>
              </div>
              <div className="mt-12 grid grid-cols-3 gap-8">
                <div>
                  <div className="text-3xl font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground">Schools</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">50K+</div>
                  <div className="text-sm text-muted-foreground">Students</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">99.9%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
              </div>
            </div>
            <div className="relative animate-scale-in">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl opacity-50"></div>
              <img 
                src={heroImage} 
                alt="Students learning together" 
                className="relative rounded-2xl shadow-2xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl mb-4">
              Everything You Need, In One Place
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for administrators, teachers, parents, and students with powerful features for each role.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group relative bg-card rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <feature.icon className="h-12 w-12 text-primary mb-4 relative z-10" />
                <h3 className="text-xl font-semibold mb-2 relative z-10">{feature.title}</h3>
                <p className="text-muted-foreground relative z-10">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-accent p-12 md:p-16 text-center">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white sm:text-4xl mb-4">
                Ready to Transform Your School?
              </h2>
              <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
                Join hundreds of schools using EduManage to streamline operations and improve student outcomes.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="bg-white text-primary hover:bg-white/90 text-lg px-8"
              >
                Use our system 
              </Button>
            </div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-semibold">EduManage</span>
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

