import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Mail, Phone, MapPin, Send, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Call the edge function to send email
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          subject: formData.subject,
          message: formData.message,
        },
      });

      if (error) throw error;

      toast.success("Message sent successfully! We'll get back to you soon.");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message. Please try again or email us directly at animanthony7@gmail.com");
    }
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
        <div className="container px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="text-center mb-8 md:mb-16 animate-fade-up">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-white drop-shadow-lg">
                Get in <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Touch</span>
              </h1>
              <p className="text-base md:text-lg lg:text-xl text-white/80 max-w-2xl mx-auto drop-shadow-lg px-4">
                Have questions about EduManage? We're here to help! Reach out to our team and we'll respond as soon as possible.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 mb-8 md:mb-16">
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
                  <CardHeader className="p-4 md:p-6">
                    <div className="inline-flex p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mx-auto mb-3 md:mb-4 shadow-lg shadow-cyan-500/20">
                      <item.icon className="h-6 w-6 md:h-8 md:w-8 text-cyan-300" />
                    </div>
                    <CardTitle className="text-lg md:text-xl text-white">{item.title}</CardTitle>
                    <CardDescription className="text-sm md:text-base font-medium text-cyan-300 break-all">{item.detail}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0">
                    <p className="text-sm md:text-base text-white/70">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Contact Form */}
            <Card className="max-w-3xl mx-auto backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl shadow-blue-500/20 animate-scale-in">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-2xl md:text-3xl text-white drop-shadow-lg">Send Us a Message</CardTitle>
                <CardDescription className="text-sm md:text-base text-white/80">
                  Fill out the form below and our team will get back to you within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white text-sm md:text-base">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-base py-5 md:py-6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white text-sm md:text-base">Email Address *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-base py-5 md:py-6"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-white text-sm md:text-base">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={handleChange}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-base py-5 md:py-6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-white text-sm md:text-base">Subject *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="How can we help?"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-base py-5 md:py-6"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white text-sm md:text-base">Message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      required
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-base resize-none"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200 py-5 md:py-6 text-base md:text-lg">
                    <Send className="mr-2 h-4 w-4 md:h-5 md:w-5" />
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
    </div>
  );
};

export default Contact;
