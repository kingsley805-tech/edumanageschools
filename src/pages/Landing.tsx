import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  TrendingUp, 
  Shield, 
  Zap, 
  ArrowRight, 
  Building, 
  Target, 
  Clock,
  CheckCircle,
  Sparkles,
  BarChart3,
  Globe
} from "lucide-react";
import { useState, useEffect } from "react";

const Landing = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: Users,
      title: "Multi-Role Access",
      description: "Admins, teachers, parents & students in one secure ecosystem.",
      gradient: "from-blue-500 to-cyan-500",
      color: "text-blue-600"
    },
    {
      icon: BookOpen,
      title: "Academics & Results",
      description: "Attendance, assignments, report cards & student analytics.",
      gradient: "from-purple-500 to-pink-500",
      color: "text-purple-600"
    },
    {
      icon: TrendingUp,
      title: "Smart Finance",
      description: "Automated invoicing, real-time payments & receipts.",
      gradient: "from-green-500 to-emerald-500",
      color: "text-green-600"
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "Role-based access with full data encryption.",
      gradient: "from-orange-500 to-red-500",
      color: "text-orange-600"
    },
    {
      icon: Zap,
      title: "Real-Time System",
      description: "Instant updates, notifications & fast performance.",
      gradient: "from-yellow-500 to-amber-500",
      color: "text-yellow-600"
    },
    {
      icon: BarChart3,
      title: "Growth Insights",
      description: "Advanced reports to drive smarter school decisions.",
      gradient: "from-indigo-500 to-purple-500",
      color: "text-indigo-600"
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: "Save Time",
      description: "Reduce administrative work by 60% with automated processes",
      stat: "60%",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      icon: Target,
      title: "Improve Results",
      description: "Track student performance and identify areas for improvement",
      stat: "95%",
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      icon: Building,
      title: "Scale Easily",
      description: "Grow your institution without adding administrative overhead",
      stat: "500+",
      color: "text-green-600",
      bg: "bg-green-50"
    }
  ];

  const testimonials = [
    {
      quote: "EduManage transformed how we run our school. The efficiency gains are remarkable.",
      author: "Dr. Amara Okafor",
      role: "Principal, Lagos Academy",
      image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop"
    },
    {
      quote: "Finally, a system that understands African schools' unique needs.",
      author: "Prof. Kwame Mensah",
      role: "Director, Accra International School",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"
    },
    {
      quote: "Our parents love the transparency and real-time updates.",
      author: "Ms. Fatima Hassan",
      role: "Administrator, Nairobi Elite School",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm transition-all duration-300">
        <div className="container flex h-16 md:h-20 items-center justify-between px-4 md:px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
           
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Features</a>
            <a href="#benefits" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Benefits</a>
            <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Testimonials</a>
          </nav>

          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/auth")} 
              className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate("/auth")} 
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-300 group"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-40 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse"
            style={{ transform: `translateY(${scrollY * 0.1}px)` }}
          ></div>
          <div 
            className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-100 rounded-full blur-3xl opacity-30 animate-pulse"
            style={{ animationDelay: '1s', transform: `translateY(${scrollY * -0.1}px)` }}
          ></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-50 rounded-full blur-3xl opacity-20"></div>
        </div>

        <div className="container relative z-10 px-4 md:px-6 max-w-7xl mx-auto">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            {/* Left Content */}
            <div 
              className={`space-y-8 transition-all duration-1000 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-2 group hover:bg-blue-100 transition-colors cursor-pointer">
                <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                <span className="text-sm font-medium text-blue-700">Trusted by 500+ Schools Across Africa</span>
              </div>

              <div className="space-y-6">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                  Transform Your
                  <span className="block bg-gradient-to-r from-blue-600 via-cyan-600 to-purple-600 bg-clip-text text-transparent">
                    School Management
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
                  The all-in-one platform designed for African schools. Manage academics, finance, and communication seamlessly.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")} 
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-lg px-8 py-6 shadow-xl shadow-blue-200 hover:shadow-2xl hover:shadow-blue-300 transition-all duration-300 group"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6 border-2 border-gray-300 hover:border-blue-600 hover:bg-blue-50 transition-all duration-300"
                  onClick={() => navigate("/auth")}
                >
                  Watch Demo
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">Setup in 10 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">24/7 Support</span>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div 
              className={`relative transition-all duration-1000 delay-300 ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
              }`}
            >
              <div className="relative">
                {/* Floating cards animation */}
                <div className="absolute -top-8 -left-8 bg-white rounded-2xl shadow-2xl p-4 border border-gray-100 animate-float z-20">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-3 rounded-xl">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Student Growth</p>
                      <p className="text-xl font-bold text-gray-900">+32%</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-8 -right-8 bg-white rounded-2xl shadow-2xl p-4 border border-gray-100 animate-float z-20" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-xl">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Active Users</p>
                      <p className="text-xl font-bold text-gray-900">50k+</p>
                    </div>
                  </div>
                </div>

                {/* Main Image */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent z-10"></div>
                  <img 
                    src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=600&fit=crop&q=80" 
                    alt="African students using technology in classroom" 
                    className="w-full h-auto object-cover"
                  />
                </div>

                {/* Decorative elements */}
                <div className="absolute -z-10 top-10 right-10 w-72 h-72 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20"></div>
                <div className="absolute -z-10 bottom-10 left-10 w-72 h-72 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20"></div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 md:mt-32">
            {[
              { number: "500+", label: "Schools", icon: Building },
              { number: "50k+", label: "Students", icon: Users },
              { number: "99.9%", label: "Uptime", icon: Shield },
              { number: "24/7", label: "Support", icon: Globe }
            ].map((stat, index) => (
              <div 
                key={index} 
                className="text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <stat.icon className="h-8 w-8 text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS SECTION */}
      <section id="benefits" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-2 mb-6">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Why Choose Us</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">
              Built for <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">African Schools</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the difference with a platform designed specifically for the unique needs of African educational institutions
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 mb-16">
            {benefits.map((benefit, index) => (
              <div 
                key={index} 
                className={`group p-8 rounded-3xl border-2 border-gray-100 hover:border-blue-200 ${benefit.bg} hover:shadow-2xl transition-all duration-500 hover:-translate-y-2`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-4 rounded-2xl bg-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}>
                    <benefit.icon className={`h-8 w-8 ${benefit.color}`} />
                  </div>
                  <div className={`text-4xl font-bold ${benefit.color}`}>{benefit.stat}</div>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1503676382389-4809596d5290?w=400&h=400&fit=crop&q=80"
            ].map((img, index) => (
              <div 
                key={index} 
                className="relative rounded-2xl overflow-hidden aspect-square group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-blue-600/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                <img 
                  src={img} 
                  alt={`African education ${index + 1}`} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-20 md:py-32 bg-white">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-2 mb-6">
              <Zap className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Powerful Features</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">
              Everything You Need
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                In One Platform
              </span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive tools designed to streamline every aspect of school management
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="group relative p-8 rounded-3xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 hover:border-transparent hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                
                <div className="relative z-10">
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-blue-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-4">{feature.description}</p>
                  <div className={`inline-flex items-center gap-2 ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                    <span className="text-sm font-medium">Learn more</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section id="testimonials" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-2 mb-6">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Testimonials</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">
              Trusted by <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Education Leaders</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              See what school administrators across Africa are saying about EduManage
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className="bg-white p-8 rounded-3xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 text-lg mb-6 leading-relaxed italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.author}
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-100"
                  />
                  <div>
                    <p className="font-bold text-gray-900">{testimonial.author}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-cyan-600 to-purple-600 p-12 md:p-20 text-center shadow-2xl">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 space-y-8 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white">
                Ready to Transform Your School?
              </h2>
              <p className="text-lg md:text-xl text-white/90 leading-relaxed">
                Join hundreds of schools across Africa using EduManage to streamline operations and enhance educational outcomes.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                  onClick={() => navigate("/auth")}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-white/50 text-white hover:bg-white/10 hover:border-white text-lg px-8 py-6 backdrop-blur-sm transition-all duration-300"
                  onClick={() => navigate("/auth")}
                >
                  Schedule Demo
                </Button>
              </div>
              
              <p className="text-white/80 text-sm">
                ✓ No credit card required  •  ✓ Setup in 10 minutes  •  ✓ Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-gray-50 py-12">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-2 rounded-xl">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  EduManage
                </span>
              </div>
              <p className="text-gray-600 max-w-md mb-4">
                The leading school management platform designed specifically for African educational institutions.
              </p>
              <div className="flex gap-4">
                {/* Social icons would go here */}
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Security</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2">
                <li><span className="text-gray-600 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => navigate("/about")}>About</span></li>
                <li><span className="text-gray-600 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => navigate("/contact")}>Contact</span></li>
                <li><span className="text-gray-600 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => navigate("/careers")}>Careers</span></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-200 gap-4">
            <p className="text-sm text-gray-600">
              © 2025 EduManage. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-600">
              <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => navigate("/privacy")}>Privacy Policy</span>
              <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => navigate("/terms")}>Terms of Service</span>
              <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => navigate("/cookies")}>Cookie Policy</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default Landing;