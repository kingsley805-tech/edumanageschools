import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Mail, Phone, MapPin, Send, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent successfully! We'll get back to you soon.");
    setFormData({
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(236,72,153,0.2),transparent_50%)]"></div>
      
      {/* Glowing Background Elements */}
      <div className="absolute top-1/4 -left-10 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-10 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Glowing orbs */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-cyan-400/40 rounded-full blur-2xl animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-40 h-40 bg-violet-400/40 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/20 border-b border-white/10 supports-[backdrop-filter]:bg-background/10 shadow-lg shadow-black/10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-30"></div>
              <GraduationCap className="h-8 w-8 text-primary relative" />
            </div>
            <span className="text-xl font-bold tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/auth")} className="border-2 border-white/30 text-white backdrop-blur-xl bg-white/10 hover:bg-white/20 hover:border-white/50 transition-all duration-200">
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 group">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/20 border border-white/30"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <section className="py-20 relative z-10">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="text-center mb-16 animate-fade-up">
              <h1 className="text-5xl font-bold mb-6 text-white drop-shadow-lg">
                Get in <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Touch</span>
              </h1>
              <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow-lg">
                Have questions about EduManage? We're here to help! Reach out to our team and we'll respond as soon as possible.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {/* Contact Cards */}
              {[
                {
                  icon: Mail,
                  title: "Email Us",
                  detail: "support@edumanage.com",
                  description: "Send us an email anytime",
                },
                {
                  icon: Phone,
                  title: "Call Us",
                  detail: "+1 (555) 123-4567",
                  description: "Mon-Fri from 8am to 5pm",
                },
                {
                  icon: MapPin,
                  title: "Visit Us",
                  detail: "123 Education Street",
                  description: "New York, NY 10001",
                },
              ].map((item, index) => (
                <Card key={index} className="text-center backdrop-blur-xl bg-white/10 border border-white/20 shadow-lg hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mx-auto mb-4 shadow-lg shadow-cyan-500/20">
                      <item.icon className="h-8 w-8 text-cyan-300" />
                    </div>
                    <CardTitle className="text-xl text-white">{item.title}</CardTitle>
                    <CardDescription className="text-base font-medium text-cyan-300">{item.detail}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Contact Form */}
            <Card className="max-w-3xl mx-auto backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl shadow-blue-500/20 animate-scale-in">
              <CardHeader>
                <CardTitle className="text-3xl text-white drop-shadow-lg">Send Us a Message</CardTitle>
                <CardDescription className="text-base text-white/80">
                  Fill out the form below and our team will get back to you within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white">Email Address *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-white">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={handleChange}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-white">Subject *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="How can we help?"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white">Message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      required
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200">
                    <Send className="mr-2 h-5 w-5" />
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-12 backdrop-blur-xl bg-black/20 relative z-10">
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
              <a href="#" className="hover:text-cyan-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-cyan-300 transition-colors">Terms</a>
              <span className="cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => navigate("/contact")}>Contact</span>
            </div>
            <p className="text-sm text-white/60">
              © 2025 EduManage. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Contact;
