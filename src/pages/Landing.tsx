import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Users,
  BookOpen,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle
} from "lucide-react";
import heroImage from "@/assets/hero-education.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Multi-Role Access",
      description: "Admins, teachers, parents & students in one secure ecosystem."
    },
    {
      icon: BookOpen,
      title: "Academics & Results",
      description: "Attendance, assignments, report cards & student analytics."
    },
    {
      icon: TrendingUp,
      title: "Smart Finance",
      description: "Automated invoicing, real-time payments & receipts."
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "Role-based access with full data encryption."
    },
    {
      icon: Zap,
      title: "Real-Time System",
      description: "Instant updates, notifications & fast performance."
    },
    {
      icon: GraduationCap,
      title: "Growth Insights",
      description: "Advanced reports to drive smarter school decisions."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold tracking-wide">EduManage</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="py-24">
        <div className="container grid gap-16 lg:grid-cols-2 items-center">
          <div>
            <span className="inline-block mb-6 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              All-In-One School Management Platform
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
              Run Your School
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Smarter & Faster
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-8">
              EduManage helps schools automate academics, finance, communication and growth — all in one powerful system.
            </p>

            <div className="flex gap-4 flex-wrap">
              <Button size="lg" onClick={() => navigate("/auth")}>
                Start Now
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                Want to Try?
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-8 mt-12">
              <div>
                <h3 className="text-3xl font-bold text-primary">500+</h3>
                <p className="text-sm text-muted-foreground">Schools</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-primary">50k+</h3>
                <p className="text-sm text-muted-foreground">Students</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-primary">99.9%</h3>
                <p className="text-sm text-muted-foreground">Uptime</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl opacity-60"></div>
            <img
              src={heroImage}
              alt="Education Management System"
              className="relative rounded-3xl shadow-2xl w-full"
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Powerful Modules Built for Schools
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything your institution needs to operate professionally in the digital age.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded-2xl p-6 bg-background shadow hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple & Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-12">
            Pay only for what your school needs.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {["Basic", "Standard", "Enterprise"].map((plan, i) => (
              <div
                key={i}
                className="rounded-2xl border bg-background p-8 shadow hover:shadow-xl transition"
              >
                <h3 className="text-xl font-bold mb-4">{plan}</h3>
                <p className="text-3xl font-bold mb-6">
                  {i === 0 ? "Free" : i === 1 ? "$49/mo" : "Custom"}
                </p>
                <ul className="space-y-3 mb-6 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Student Portal
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Attendance & Grades
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Fee Payments
                  </li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Choose Plan
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="rounded-3xl bg-gradient-to-r from-primary to-accent p-16 text-center text-white shadow-xl">
            <h2 className="text-4xl font-bold mb-4">
              Transform Your School Today
            </h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto text-white/90">
              Join hundreds of institutions using EduManage to simplify operations and boost student success.
            </p>
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90"
              onClick={() => navigate("/auth")}
            >
              Launch Your School Portal
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-semibold">EduManage</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 EduManage. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
