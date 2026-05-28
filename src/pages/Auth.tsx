import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Lock, Mail, User, Eye, EyeOff, Shield, BookOpen, Users, ArrowRight, Hash, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { logLoginActivity } from "@/lib/auditLog";
import {
  normalizeAdmissionNumber,
  resolveSchoolIdFromAdmissionNumber,
  derivePrefixFromSchoolName,
} from "@/lib/admission-numbers";
import {
  linkParentToStudents,
  resolveLoginIdentifier,
  resolveStudentByAdmissionNumber,
  type StudentAdmissionPreview,
} from "@/lib/auth-api";
import schoolPicture from "@/assets/School Picture.webp";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { role } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "forgot-password">("login");
  const [showPassword, setShowPassword] = useState(false);
  
  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup fields
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupRole, setSignupRole] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [admissionPrefix, setAdmissionPrefix] = useState("");
  const [admissionPrefixManual, setAdmissionPrefixManual] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [adminKey, setAdminKey] = useState("");
  
  // Registration number for students/employees
  const [registrationNumber, setRegistrationNumber] = useState("");
  
  // Gender for students
  const [gender, setGender] = useState("");
  
  // Parent child linking
  const [childStudentNumbers, setChildStudentNumbers] = useState<string[]>([""]);
  const [childPreview, setChildPreview] = useState<StudentAdmissionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [parentSchoolId, setParentSchoolId] = useState<string | null>(null);
  
  // Reset password
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    if (user && role) {
      const roleRoutes: Record<string, string> = {
        admin: "/admin",
        super_admin: "/admin",
        accountant: "/accountant",
        auditor: "/auditor",
        teacher: "/teacher",
        parent: "/parent",
        student: "/student",
      };
      navigate(roleRoutes[role] || "/admin");
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const resolved = await resolveLoginIdentifier(loginIdentifier);
    if (!resolved.ok || !resolved.email) {
      toast.error(resolved.error ?? "Could not sign in with those credentials.");
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(resolved.email, loginPassword);
    if (error) {
      await logLoginActivity(false, loginIdentifier, error.message);
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    await logLoginActivity(true, resolved.email);
    toast.success("Welcome back!");
    setIsLoading(false);
  };

  const validateRegistrationNumber = async (number: string, type: "student" | "employee") => {
    const num = normalizeAdmissionNumber(number);

    let schoolId: string | null = null;
    const fromPrefix = await resolveSchoolIdFromAdmissionNumber(num);
    if (fromPrefix) schoolId = fromPrefix.schoolId;

    let query = supabase
      .from("registration_numbers")
      .select("*")
      .eq("registration_number", num)
      .eq("number_type", type)
      .eq("status", "unused");

    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return {
        valid: false,
        error: "Admission number not found or already used. Contact your school administrator.",
      };
    }

    return { valid: true, data, schoolId: data.school_id as string };
  };

  const lookupChildAdmission = async (admissionNumber: string) => {
    const num = normalizeAdmissionNumber(admissionNumber);
    if (!num) {
      setChildPreview(null);
      setParentSchoolId(null);
      return;
    }
    setPreviewLoading(true);
    const preview = await resolveStudentByAdmissionNumber(num);
    setChildPreview(preview);
    setParentSchoolId(preview.valid && preview.school_id ? preview.school_id : null);
    setPreviewLoading(false);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!signupRole) {
      toast.error("Please select your role");
      setIsLoading(false);
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    let schoolId: string | null = null;
    let regNumber = registrationNumber ? normalizeAdmissionNumber(registrationNumber) : "";

    if (signupRole === "super_admin") {
      if (!adminKey) {
        toast.error("Super Admin key is required");
        setIsLoading(false);
        return;
      }
    } else if (signupRole === "admin") {
      if (!adminKey || !schoolName || !schoolCode) {
        toast.error("Please complete all school administrator fields");
        setIsLoading(false);
        return;
      }
      const { data: existingSchool } = await supabase
        .from("schools")
        .select("id")
        .eq("school_code", schoolCode.toUpperCase())
        .maybeSingle();
      if (existingSchool) {
        toast.error("This school code already exists.");
        setIsLoading(false);
        return;
      }
    } else if (signupRole === "parent") {
      if (!signupPhone.trim()) {
        toast.error("Phone number is required");
        setIsLoading(false);
        return;
      }
      const numbers = childStudentNumbers.filter((n) => n.trim());
      if (numbers.length === 0) {
        toast.error("Enter at least one child's admission number");
        setIsLoading(false);
        return;
      }
      const firstPreview = await resolveStudentByAdmissionNumber(numbers[0]);
      if (!firstPreview.valid || !firstPreview.school_id) {
        toast.error(firstPreview.error ?? "Invalid student admission number");
        setIsLoading(false);
        return;
      }
      if (firstPreview.has_guardian) {
        toast.error("This student already has a linked parent account. Contact your school if you need access.");
        setIsLoading(false);
        return;
      }
      schoolId = firstPreview.school_id;
      for (let i = 1; i < numbers.length; i++) {
        const p = await resolveStudentByAdmissionNumber(numbers[i]);
        if (!p.valid) {
          toast.error(p.error ?? `Invalid admission number: ${numbers[i]}`);
          setIsLoading(false);
          return;
        }
        if (p.school_id !== schoolId) {
          toast.error("All children must belong to the same school");
          setIsLoading(false);
          return;
        }
      }
    } else if (signupRole === "student" || signupRole === "teacher") {
      if (!regNumber) {
        toast.error("Admission number is required");
        setIsLoading(false);
        return;
      }
      const poolType = signupRole === "student" ? "student" : "employee";
      const validation = await validateRegistrationNumber(regNumber, poolType);
      if (!validation.valid) {
        toast.error(validation.error);
        setIsLoading(false);
        return;
      }
      schoolId = validation.schoolId ?? null;
      if (signupRole === "student" && !gender) {
        toast.error("Please select your gender");
        setIsLoading(false);
        return;
      }
    }

    const { error } = await signUp({
      email: signupEmail,
      password: signupPassword,
      fullName: signupFullName,
      role: signupRole,
      schoolCode: signupRole === "admin" ? schoolCode.toUpperCase() : "",
      schoolId: schoolId ?? undefined,
      adminKey,
      schoolName,
      admissionPrefix:
        admissionPrefix.toUpperCase() ||
        derivePrefixFromSchoolName(schoolName) ||
        schoolCode.toUpperCase(),
      registrationNumber: regNumber,
      gender,
      phone: signupPhone,
    });

    if (error) {
      const msg = (error as { message?: string }).message ?? "Failed to create account";
      toast.error(msg);
      setIsLoading(false);
      return;
    }

    if (signupRole === "parent" && schoolId) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        const { data: parentRecord } = await supabase
          .from("parents")
          .select("id")
          .eq("user_id", newUser.id)
          .single();
        if (parentRecord) {
          const linkResult = await linkParentToStudents(
            parentRecord.id,
            schoolId,
            childStudentNumbers.filter((n) => n.trim())
          );
          if (!linkResult.ok) {
            toast.error(linkResult.error ?? "Account created but child linking failed");
            setIsLoading(false);
            return;
          }
        }
      }
    }

    toast.success("Account created successfully!");
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth?tab=reset-password`
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent to your email!");
      setResetEmail("");
      setActiveTab("login");
    }
    setIsLoading(false);
  };

  const addChildNumberField = () => {
    if (childStudentNumbers.length < 10) {
      setChildStudentNumbers([...childStudentNumbers, ""]);
    }
  };

  const removeChildNumberField = (index: number) => {
    if (childStudentNumbers.length > 1) {
      setChildStudentNumbers(childStudentNumbers.filter((_, i) => i !== index));
    }
  };

  const updateChildNumber = (index: number, value: string) => {
    const updated = [...childStudentNumbers];
    updated[index] = normalizeAdmissionNumber(value);
    setChildStudentNumbers(updated);
    if (index === 0) {
      void lookupChildAdmission(updated[0]);
    }
  };

  const roleConfig = {
    super_admin: {
      icon: Shield,
      label: "Super Admin",
      description: "Multi-school management"
    },
    admin: {
      icon: Shield,
      label: "Administrator",
      description: "Full system access"
    },
    teacher: {
      icon: BookOpen,
      label: "Teacher",
      description: "Class and grade management"
    },
    parent: {
      icon: Users,
      label: "Parent",
      description: "Student progress tracking"
    },
    student: {
      icon: GraduationCap,
      label: "Student",
      description: "Learning portal access"
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[hsl(200,25%,18%)]">
      {/* Left Panel - Hero Section */}
      <div className="relative lg:w-1/2 min-h-[300px] lg:min-h-screen flex flex-col">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${schoolPicture})` }}
        />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-6 lg:p-10">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-accent/20 backdrop-blur-sm">
              <GraduationCap className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
            </div>
            <div>
              <span className="text-xs lg:text-sm font-medium tracking-widest text-accent uppercase">
                EDUMANAGE
              </span>
              <h1 className="text-xl lg:text-2xl font-bold text-white">
                Your school, organized.
              </h1>
            </div>
          </div>
          
          {/* Main Content - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <p className="text-lg text-white/90 text-center max-w-md leading-relaxed">
              All-in-one portal for teachers, students, and parents.
            </p>
          </div>
          
          {/* Feature Badges */}
          <div className="flex flex-wrap gap-3 mt-auto">
            <div className="flex-1 min-w-[140px] bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <span className="text-[10px] lg:text-xs font-medium tracking-widest text-accent uppercase block mb-1">
                SECURE ACCESS
              </span>
              <span className="text-sm lg:text-base font-semibold text-white">
                Role-based dashboards
              </span>
            </div>
            <div className="flex-1 min-w-[140px] bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <span className="text-[10px] lg:text-xs font-medium tracking-widest text-accent uppercase block mb-1">
                SCHOOLS
              </span>
              <span className="text-sm lg:text-base font-semibold text-white">
                Smart admission-based access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-background">
        <div className="w-full max-w-md space-y-6 bg-card rounded-2xl p-6 shadow-md border border-border">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                WELCOME TO EDUMANAGE
              </span>
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                Access your school portal
              </h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-muted">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {/* Tab Toggle */}
          {activeTab !== "forgot-password" && (
            <div className="flex bg-muted rounded-full p-1">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === "login"
                    ? "bg-[hsl(200,35%,20%)] text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("signup")}
                className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === "signup"
                    ? "bg-[hsl(200,35%,20%)] text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Login Form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="login-identifier" className="text-sm font-medium text-foreground">
                  Email or admission number
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-identifier"
                    type="text"
                    placeholder="you@school.edu or MINGO-Stu-2026-001"
                    className="pl-10 h-12 border-2 focus:border-primary"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  No school code needed — we detect your school automatically.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-12 h-12 border-2 focus:border-primary"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[hsl(200,35%,20%)] hover:bg-[hsl(200,35%,25%)] text-white font-semibold text-base group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  className="text-sm font-medium text-[hsl(200,35%,25%)] hover:underline"
                  onClick={() => setActiveTab("forgot-password")}
                >
                  Forgot your password?
                </button>
                <p className="text-xs text-muted-foreground">
                  Having trouble? The account may exist but be incomplete. Try password reset or contact support.
                </p>
              </div>
            </form>
          )}

          {/* Forgot Password Form */}
          {activeTab === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@school.edu"
                    className="pl-10 h-12 border-2 focus:border-primary"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[hsl(200,35%,20%)] hover:bg-[hsl(200,35%,25%)] text-white font-semibold text-base group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </div>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <button
                type="button"
                className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setActiveTab("login")}
              >
                Back to Login
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4 animate-fade-in max-h-[64vh] overflow-y-auto pr-3 pb-2 custom-scrollbar">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-sm font-medium text-foreground">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    className="pl-10 h-12 border-2 focus:border-primary"
                    value={signupFullName}
                    onChange={e => setSignupFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@school.edu"
                    className="pl-10 h-12 border-2 focus:border-primary"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-12 h-12 border-2 focus:border-primary"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Account Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="signup-role" className="text-sm font-medium text-foreground">
                  Account Type
                </Label>
                <Select value={signupRole} onValueChange={setSignupRole} required>
                  <SelectTrigger id="signup-role" className="h-12 border-2 focus:border-primary">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleConfig).map(([key, config]) => {
                      const IconComponent = config.icon;
                      return (
                        <SelectItem key={key} value={key} className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <IconComponent className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">{config.label}</span>
                              <span className="text-xs text-muted-foreground">{config.description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Super Admin Info */}
              {signupRole === "super_admin" && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 animate-fade-in">
                  <p className="text-sm text-muted-foreground">
                    Super admins manage multiple schools. You'll be able to assign schools after account creation.
                  </p>
                </div>
              )}

              {/* Admin - New School Creation */}
              {signupRole === "admin" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="school-name" className="text-sm font-medium text-foreground">
                      School Name
                    </Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-name"
                        type="text"
                        placeholder="Enter your school name"
                        className="pl-10 h-12 border-2 focus:border-primary"
                        value={schoolName}
                        onChange={(e) => {
                          const name = e.target.value;
                          setSchoolName(name);
                          if (!admissionPrefixManual) {
                            setAdmissionPrefix(derivePrefixFromSchoolName(name));
                          }
                        }}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school-code" className="text-sm font-medium text-foreground">
                      School Code (login)
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-code"
                        type="text"
                        placeholder="Create a unique school code"
                        className="pl-10 h-12 border-2 focus:border-primary uppercase"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admission-prefix" className="text-sm font-medium text-foreground">
                      Admission number prefix
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="admission-prefix"
                        type="text"
                        placeholder="MINGO"
                        className="pl-10 h-12 border-2 focus:border-primary uppercase"
                        value={admissionPrefix}
                        onChange={(e) => {
                          setAdmissionPrefixManual(true);
                          setAdmissionPrefix(
                            e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
                          );
                        }}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-filled from school name (first 3 letters), not school code. Example:{" "}
                      {admissionPrefix || derivePrefixFromSchoolName(schoolName) || "MIN"}-Stu-2026-001
                    </p>
                  </div>
                </div>
              )}

              {/* Teacher/Student — admission number only (school auto-detected) */}
              {(signupRole === "teacher" || signupRole === "student") && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="reg-number" className="text-sm font-medium text-foreground">
                      {signupRole === "student" ? "Admission Number" : "Employee Number"}
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="reg-number"
                        type="text"
                        placeholder={`Enter your ${signupRole === "student" ? "student" : "employee"} number`}
                        className="pl-10 h-12 border-2 focus:border-primary uppercase"
                        value={registrationNumber}
                        onChange={e => setRegistrationNumber(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format: SCHOOL-Stu-2026-001 — school is detected from your number
                    </p>
                  </div>
                  
                  {signupRole === "student" && (
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium text-foreground">
                        Gender
                      </Label>
                      <Select value={gender} onValueChange={setGender} required>
                        <SelectTrigger id="gender" className="h-12 border-2 focus:border-primary">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {signupRole === "parent" && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="signup-phone" className="text-sm font-medium text-foreground">
                    Phone Number
                  </Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+233..."
                    className="h-12 border-2"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-sm font-medium text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 h-12 border-2 focus:border-primary"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Parent — admission number links child & school */}
              {signupRole === "parent" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      Child&apos;s admission number
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Enter your child&apos;s admission number — school and class are detected automatically
                    </p>

                    {previewLoading && (
                      <p className="text-sm text-muted-foreground">Verifying admission number…</p>
                    )}
                    {childPreview?.valid && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm space-y-1">
                        <p className="font-semibold text-foreground">{childPreview.student_name}</p>
                        <p className="text-muted-foreground">School: {childPreview.school_name}</p>
                        <p className="text-muted-foreground">Class: {childPreview.class_name}</p>
                        <p className="font-mono text-xs">{childPreview.admission_number}</p>
                      </div>
                    )}
                    {childPreview && !childPreview.valid && !previewLoading && (
                      <p className="text-sm text-destructive">{childPreview.error}</p>
                    )}
                    
                    {childStudentNumbers.map((num, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="relative flex-1">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder={`Child ${index + 1} student number`}
                            className="pl-10 h-12 border-2 focus:border-primary uppercase"
                            value={num}
                            onChange={e => updateChildNumber(index, e.target.value)}
                            required={index === 0}
                          />
                        </div>
                        {childStudentNumbers.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                            onClick={() => removeChildNumberField(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    
                    {childStudentNumbers.length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addChildNumberField}
                        className="w-full h-10"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Child
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Key for Admin/Super Admin */}
              {(signupRole === "admin" || signupRole === "super_admin") && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="admin-key" className="text-sm font-medium text-foreground">
                    {signupRole === "super_admin" ? "Super Admin Key" : "Admin Key"}
                  </Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="admin-key"
                      type="password"
                      placeholder={signupRole === "super_admin" ? "Enter super admin key" : "Enter admin key"}
                      className="pl-10 h-12 border-2 focus:border-primary"
                      value={adminKey}
                      onChange={e => setAdminKey(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {signupRole === "super_admin" 
                      ? "This special key is required to create a super administrator account" 
                      : "This special key is required to create an administrator account"}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-[hsl(200,35%,20%)] hover:bg-[hsl(200,35%,25%)] text-white font-semibold text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </div>
                ) : "Create Account"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
