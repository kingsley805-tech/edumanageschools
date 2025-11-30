import React, { useState } from 'react';
import { GraduationCap, Users, BookOpen, TrendingUp, Shield, Zap, LogIn } from 'lucide-react';

// Simplified Button Component for single-file self-containment
const Button = ({ children, onClick, className = "", variant = "default", size = "md" }) => {
  let baseClasses = "font-medium transition-colors duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50";
  
  let sizeClasses = "px-4 py-2 text-sm";
  if (size === "lg") sizeClasses = "px-8 py-3 text-lg";

  let variantClasses = "bg-primary text-white hover:bg-primary/90";
  if (variant === "outline") variantClasses = "bg-transparent border border-gray-300 text-foreground hover:bg-muted";
  
  // Custom classes for the gradient buttons
  if (className.includes("bg-gradient-to-r")) {
      variantClasses = ""; // Override default variant classes if gradient is used
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
};

// Placeholder image URL
const heroImage = "https://placehold.co/1200x800/1e40af/ffffff?text=Education+Management";

const Landing = ({ navigateToAuth }) => {
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
    <div className="min-h-screen bg-white text-gray-800 font-sans">
      
      {/* Tailwind configuration colors for context: 
          --primary: #2563eb (Blue-700)
          --accent: #9333ea (Violet-700)
          --muted: #f3f4f6 (Gray-100)
          --background: #ffffff (White)
          --card: #ffffff (White)
      */}
      <style>{`
        /* Define custom colors and defaults for a better Tailwind simulation */
        :root {
            --primary: #2563eb;
            --accent: #9333ea;
            --muted: #f3f4f6;
            --background: #ffffff;
            --card: #ffffff;
            --foreground: #1f2937; /* Gray-800 */
            --muted-foreground: #6b7280; /* Gray-500 */
        }
        .bg-primary { background-color: var(--primary); }
        .text-primary { color: var(--primary); }
        .bg-accent { background-color: var(--accent); }
        .bg-muted\\/30 { background-color: rgba(243, 244, 246, 0.3); }
        .bg-muted { background-color: var(--muted); }
        .text-muted-foreground { color: var(--muted-foreground); }
        .bg-background { background-color: var(--background); }
        .bg-card { background-color: var(--card); }
        .border-t { border-top-width: 1px; border-color: #e5e7eb; }

        /* Custom animation keyframes */
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeUp 0.8s ease-out forwards; }

        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in { animation: scaleIn 0.8s ease-out forwards; }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto max-w-7xl flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-2xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          <Button onClick={navigateToAuth} className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="animate-fade-up" style={{animationDelay: '0.1s'}}>
              <div className="inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6 shadow-md">
                Next-Gen School Management
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl mb-8 leading-tight">
                Empower Your
                <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Educational Journey
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
                A comprehensive platform designed for modern schools. Manage students, track performance, 
                handle finances, and engage parents - all in one beautiful interface.
              </p>
              <div className="flex flex-wrap gap-4">
                {/* Changed "Get Started" to "Sign In" and removed "Watch Demo" */}
                <Button 
                  size="lg" 
                  onClick={navigateToAuth}
                  className="bg-gradient-to-r from-primary to-accent text-lg px-10 shadow-xl hover:shadow-2xl transition duration-300 transform hover:scale-[1.02]"
                >
                  Sign In
                </Button>
              </div>
              
              <div className="mt-16 grid grid-cols-3 gap-8 border-t pt-8">
                <div>
                  <div className="text-4xl font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground mt-1">Schools</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary">50K+</div>
                  <div className="text-sm text-muted-foreground mt-1">Students</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary">99.9%</div>
                  <div className="text-sm text-muted-foreground mt-1">Uptime</div>
                </div>
              </div>
            </div>
            
            <div className="relative animate-scale-in hidden lg:block" style={{animationDelay: '0.3s'}}>
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl opacity-50"></div>
              <img 
                src={heroImage} 
                alt="Students learning together" 
                className="relative rounded-3xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold sm:text-5xl mb-4">
              Everything You Need, In One Place
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Built for administrators, teachers, parents, and students with powerful features for each role, as per our architectural design.
            </p>
          </div>
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group relative bg-card border border-gray-200 rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 hover:border-primary/50 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <feature.icon className="h-10 w-10 text-primary mb-5 relative z-10 p-1 bg-primary/10 rounded-full" />
                <h3 className="text-2xl font-bold mb-3 relative z-10">{feature.title}</h3>
                <p className="text-muted-foreground relative z-10">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-accent p-12 md:p-20 text-center shadow-2xl">
            <div className="relative z-10">
              <h2 className="text-4xl font-bold text-white sm:text-5xl mb-4">
                Ready to Transform Your School?
              </h2>
              <p className="text-xl text-white/90 mb-10 max-w-3xl mx-auto">
                Join hundreds of schools using EduManage to streamline operations and improve student outcomes.
              </p>
              {/* Changed "Start Free Trial" to "Sign In" */}
              <Button 
                size="lg" 
                onClick={navigateToAuth}
                className="bg-white text-primary hover:bg-white/95 text-xl px-12 shadow-2xl"
              >
                Sign In
              </Button>
            </div>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 0 0 L 0 60 L 60 60' fill='none' stroke='white' stroke-width='1' /%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E")`
            }}></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 bg-muted/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold text-gray-700">EduManage</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 EduManage. All rights reserved. Built with passion for better education.
            </p>
            <div className="flex gap-4 text-sm text-gray-500">
                <a href="#" className="hover:text-primary transition-colors">Privacy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms</a>
                <a href="#" className="hover:text-primary transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AuthPage = ({ navigateToLanding }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
    <div className="w-full max-w-md bg-white p-8 shadow-2xl rounded-xl border border-gray-100 text-center">
        <LogIn className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Sign In to EduManage</h2>
        <p className="text-gray-500 mb-6">Access your dedicated Admin, Teacher, Parent, or Student Portal.</p>
        
        <div className="space-y-4">
            <input type="email" placeholder="Email Address" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary transition duration-150" />
            <input type="password" placeholder="Password" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary transition duration-150" />
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-lg py-3 shadow-lg hover:from-primary/90 hover:to-accent/90">
                Log In
            </Button>
        </div>
        
        <div className="mt-6 text-sm">
            <a href="#" className="font-medium text-primary hover:text-primary/80">Forgot Password?</a>
        </div>

        <Button 
            onClick={navigateToLanding} 
            variant="outline" 
            className="mt-8 w-full border-gray-200 text-gray-600 hover:bg-gray-100"
        >
            ← Back to Home
        </Button>
    </div>
    <p className="mt-8 text-sm text-gray-500">
        Note: This is a simulated login screen.
    </p>
  </div>
);

const App = () => {
  const [page, setPage] = useState('landing'); // 'landing' or 'auth'

  const navigateToAuth = () => setPage('auth');
  const navigateToLanding = () => setPage('landing');

  return (
    <div className="min-h-screen">
      {page === 'landing' ? (
        <Landing navigateToAuth={navigateToAuth} />
      ) : (
        <AuthPage navigateToLanding={navigateToLanding} />
      )}
    </div>
  );
};

export default App;
