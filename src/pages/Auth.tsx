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
import schoolPicture from "@/assets/School Picture.webp";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { role } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "forgot-password">("login");
  const [showPassword, setShowPassword] = useState(false);
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSchoolCode, setLoginSchoolCode] = useState("");
  
  // Signup fields
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [adminKey, setAdminKey] = useState("");
  
  // Registration number for students/employees
  const [registrationNumber, setRegistrationNumber] = useState("");
  
  // Gender for students
  const [gender, setGender] = useState("");
  
  // Parent child linking
  const [childStudentNumbers, setChildStudentNumbers] = useState<string[]>([""]);
  
  // Reset password
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    if (user && role) {
      const roleRoutes: Record<string, string> = {
        admin: "/admin",
        super_admin: "/admin",
        teacher: "/teacher",
        parent: "/parent",
        student: "/student"
      };
      navigate(roleRoutes[role] || "/admin");
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!loginSchoolCode.trim()) {
      toast.error("Please enter your school code");
      setIsLoading(false);
      return;
    }

    const { data: schoolData, error: schoolError } = await supabase
      .from("schools")
      .select("id")
      .eq("school_code", loginSchoolCode.toUpperCase())
      .maybeSingle();
      
    if (schoolError || !schoolData) {
      toast.error("Invalid school code. Please check and try again.");
      setIsLoading(false);
      return;
    }
    
    const { error, data: signInData } = await signIn(loginEmail, loginPassword);
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }
    
    if (signInData?.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", signInData.user.id)
        .single();
      
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signInData.user.id)
        .single();
      
      if (roleData?.role !== "super_admin" && profileData?.school_id !== schoolData.id) {
        await supabase.auth.signOut();
        toast.error("School code doesn't match your account. Please use the correct school code.");
        setIsLoading(false);
        return;
      }
    }
    
    toast.success("Welcome back!");
    setIsLoading(false);
  };

  const validateRegistrationNumber = async (number: string, type: "student" | "employee", schoolId: string) => {
    const { data, error } = await supabase
      .from("registration_numbers")
      .select("*")
      .eq("registration_number", number.toUpperCase())
      .eq("school_id", schoolId)
      .eq("number_type", type)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, error: "Registration number not found. Please contact your administrator." };
    }

    if (data.status === "used") {
      return { valid: false, error: "This registration number has already been used." };
    }

    return { valid: true, data };
  };

  const validateChildStudentNumbers = async (numbers: string[], schoolId: string) => {
    const validNumbers: string[] = [];
    
    for (const num of numbers) {
      if (!num.trim()) continue;
      
      const { data: student, error } = await supabase
        .from("students")
        .select("id, school_id, user_id, profiles:user_id(full_name)")
        .eq("admission_no", num.toUpperCase())
        .maybeSingle();

      if (error || !student) {
        return { valid: false, error: `Student with number ${num} not found.` };
      }

      if (student.school_id !== schoolId) {
        return { valid: false, error: `Student ${num} belongs to a different school.` };
      }

      validNumbers.push(student.id);
    }

    if (validNumbers.length === 0) {
      return { valid: false, error: "Please enter at least one valid student number." };
    }

    return { valid: true, studentIds: validNumbers };
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!signupRole) {
      toast.error("Please select your role");
      setIsLoading(false);
      return;
    }

    let schoolId: string | null = null;

    if (signupRole === "super_admin") {
      if (!adminKey) {
        toast.error("Super Admin key is required for super administrator accounts");
        setIsLoading(false);
        return;
      }
    } 
    else if (signupRole === "admin") {
      if (!adminKey) {
        toast.error("Admin key is required for administrator accounts");
        setIsLoading(false);
        return;
      }
      if (!schoolName || !schoolCode) {
        toast.error("Please enter both school name and code");
        setIsLoading(false);
        return;
      }
      const { data: existingSchool } = await supabase
        .from("schools")
        .select("id")
        .eq("school_code", schoolCode.toUpperCase())
        .maybeSingle();
      
      if (existingSchool) {
        toast.error("This school code already exists. Please choose a different unique code for your school.");
        setIsLoading(false);
        return;
      }
    } 
    else {
      if (!schoolCode) {
        toast.error("Please enter your school code");
        setIsLoading(false);
        return;
      }

      const { data: schoolExists } = await supabase
        .from("schools")
        .select("id")
        .eq("school_code", schoolCode.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      
      if (!schoolExists) {
        toast.error("Invalid school code. Please check with your school administrator for the correct code.");
        setIsLoading(false);
        return;
      }
      
      schoolId = schoolExists.id;

      if (signupRole === "student" || signupRole === "teacher") {
        if (!registrationNumber.trim()) {
          toast.error(`Please enter your ${signupRole === "student" ? "Student" : "Employee"} registration number`);
          setIsLoading(false);
          return;
        }

        const numberType = signupRole === "student" ? "student" : "employee";
        const validation = await validateRegistrationNumber(registrationNumber, numberType, schoolId);
        
        if (!validation.valid) {
          toast.error(validation.error);
          setIsLoading(false);
          return;
        }

        if (signupRole === "student" && !gender) {
          toast.error("Please select your gender");
          setIsLoading(false);
          return;
        }
      }

      if (signupRole === "parent") {
        const nonEmptyNumbers = childStudentNumbers.filter(n => n.trim());
        if (nonEmptyNumbers.length === 0) {
          toast.error("Please enter at least one child's student number");
          setIsLoading(false);
          return;
        }

        const validation = await validateChildStudentNumbers(nonEmptyNumbers, schoolId);
        if (!validation.valid) {
          toast.error(validation.error);
          setIsLoading(false);
          return;
        }
      }
    }

    const { error, data } = await signUp(
      signupEmail, 
      signupPassword, 
      signupFullName, 
      signupRole, 
      schoolCode.toUpperCase(), 
      adminKey, 
      schoolName,
      registrationNumber.toUpperCase(),
      gender
    );
    
    if (error) {
      if (error.message?.includes("School code already exists")) {
        toast.error("This school code is already taken. Please choose a different unique code.");
      } else if (error.message?.includes("Invalid school code")) {
        toast.error("The school code you entered doesn't exist. Please check with your administrator.");
      } else if (error.message?.includes("Invalid admin key")) {
        toast.error("The admin key you entered is incorrect. Please check and try again.");
      } else if (error.message?.includes("Invalid super admin key")) {
        toast.error("The super admin key you entered is incorrect.");
      } else {
        toast.error(error.message || "Failed to create account. Please try again.");
      }
      setIsLoading(false);
      return;
    }
    
    if (schoolId && signupRole === "parent") {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        const { data: parentRecord } = await supabase
          .from("parents")
          .select("id")
          .eq("user_id", newUser.id)
          .single();

        if (parentRecord) {
          for (const childNum of childStudentNumbers) {
            if (!childNum.trim()) continue;

            const { data: student } = await supabase
              .from("students")
              .select("id")
              .eq("admission_no", childNum.toUpperCase())
              .eq("school_id", schoolId)
              .single();

            if (student) {
              await supabase.from("parent_student_links").insert({
                parent_id: parentRecord.id,
                student_id: student.id,
              });

              await supabase
                .from("students")
                .update({ guardian_id: parentRecord.id })
                .eq("id", student.id)
                .is("guardian_id", null);
            }
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
    updated[index] = value.toUpperCase();
    setChildStudentNumbers(updated);
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
                Join with your school code
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
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
                <Label htmlFor="login-email" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@school.edu"
                    className="pl-10 h-12 border-2 focus:border-primary"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
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

              <div className="space-y-2">
                <Label htmlFor="login-school-code" className="text-sm font-medium text-foreground">
                  School Code
                </Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-school-code"
                    type="text"
                    placeholder="ENTER YOUR SCHOOL CODE"
                    className="pl-10 h-12 border-2 focus:border-primary uppercase"
                    value={loginSchoolCode}
                    onChange={e => setLoginSchoolCode(e.target.value.toUpperCase())}
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
            <form onSubmit={handleSignup} className="space-y-4 animate-fade-in max-h-[60vh] overflow-y-auto pr-2">
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
                        onChange={e => setSchoolName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school-code" className="text-sm font-medium text-foreground">
                      School Code
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-code"
                        type="text"
                        placeholder="Create a unique school code"
                        className="pl-10 h-12 border-2 focus:border-primary uppercase"
                        value={schoolCode}
                        onChange={e => setSchoolCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Create a unique code for your school (e.g., SCHOOL2025)
                    </p>
                  </div>
                </div>
              )}

              {/* Teacher/Student - School Code + Registration Number */}
              {(signupRole === "teacher" || signupRole === "student") && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="school-code" className="text-sm font-medium text-foreground">
                      School Code
                    </Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-code"
                        type="text"
                        placeholder="Enter your school code"
                        className="pl-10 h-12 border-2 focus:border-primary uppercase"
                        value={schoolCode}
                        onChange={e => setSchoolCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get this code from your school administrator
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-number" className="text-sm font-medium text-foreground">
                      {signupRole === "student" ? "Student Number" : "Employee Number"}
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
                      This number is provided by your school administrator
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

              {/* Parent - School Code + Children Numbers */}
              {signupRole === "parent" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="school-code" className="text-sm font-medium text-foreground">
                      School Code
                    </Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-code"
                        type="text"
                        placeholder="Enter your school code"
                        className="pl-10 h-12 border-2 focus:border-primary uppercase"
                        value={schoolCode}
                        onChange={e => setSchoolCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      Children's Student Numbers
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Enter your children's student numbers to link your account
                    </p>
                    
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
