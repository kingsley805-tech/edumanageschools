import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Lock, Mail, User, Eye, EyeOff, Shield, BookOpen, Users, ArrowRight, Hash, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import schoolPicture from "@/assets/School Picture.webp";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { role } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
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
      
      // Check if student with this admission number exists
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

    // Super admin validation
    if (signupRole === "super_admin") {
      if (!adminKey) {
        toast.error("Super Admin key is required for super administrator accounts");
        setIsLoading(false);
        return;
      }
    } 
    // Admin validation - creating new school
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
    // Student/Teacher/Parent - need existing school
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

      // Validate registration number for student/teacher
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

        // Validate gender for students
        if (signupRole === "student" && !gender) {
          toast.error("Please select your gender");
          setIsLoading(false);
          return;
        }
      }

      // Validate child student numbers for parents
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

    // Proceed with signup - pass registration number and gender via metadata
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

    // After successful signup - the handle_new_user trigger now handles:
    // - Creating the student/teacher record with admission_no/employee_no and gender
    // - The mark_student/teacher_registration_used triggers will mark the number as used
    
    if (schoolId && signupRole === "parent") {
      // Link parent to children - wait for trigger to create parent record
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        // Get the parent record
        const { data: parentRecord } = await supabase
          .from("parents")
          .select("id")
          .eq("user_id", newUser.id)
          .single();

        if (parentRecord) {
          for (const childNum of childStudentNumbers) {
            if (!childNum.trim()) continue;

            // Get student by admission number
            const { data: student } = await supabase
              .from("students")
              .select("id")
              .eq("admission_no", childNum.toUpperCase())
              .eq("school_id", schoolId)
              .single();

            if (student) {
              // Create parent-student link
              await supabase.from("parent_student_links").insert({
                parent_id: parentRecord.id,
                student_id: student.id,
              });

              // Also update guardian_id on first child
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-3 sm:p-4" style={{
      backgroundImage: `url(${schoolPicture})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="absolute inset-0 bg-black/5"></div>

      <Card className="w-full max-w-md relative z-10 backdrop-blur-xl bg-white/50 border-white/25 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden border max-h-[90vh] overflow-y-auto">
        <div className="h-1 bg-gradient-to-r from-primary to-accent"></div>
        
        <CardHeader className="text-center space-y-2 md:space-y-3 pb-4 md:pb-6 px-4 md:px-6">
          <div className="mx-auto mb-2 flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <GraduationCap className="h-6 w-6 md:h-8 md:w-8 text-white" />
          </div>
          <CardTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            EduManage Portal
          </CardTitle>
          <CardDescription className="text-sm md:text-base">
            Secure access for your educational institution
          </CardDescription>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mx-4 md:mx-6 mb-2 gap-2">
            <TabsTrigger value="login" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all duration-200">
              Login
            </TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all duration-200">
              Create Account
            </TabsTrigger>
          </TabsList>

          {/* LOGIN TAB */}
          <TabsContent value="login" className="animate-fade-in">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 md:space-y-5 px-4 md:px-6">
                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="login-email" className="text-sm md:text-base font-semibold text-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 md:h-6 md:w-6 text-foreground/70" />
                    <Input id="login-email" type="email" placeholder="you@school.edu" className="pl-10 pr-4 py-5 md:py-6 text-base" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="login-password" className="text-sm md:text-base font-semibold text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 md:h-6 md:w-6 text-foreground/70" />
                    <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-12 py-5 md:py-6 text-base" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="login-school-code" className="text-sm md:text-base font-semibold text-foreground">School Code</Label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="login-school-code" type="text" placeholder="Enter your school code" className="pl-10 pr-4 py-5 md:py-6 uppercase text-base" value={loginSchoolCode} onChange={e => setLoginSchoolCode(e.target.value.toUpperCase())} required />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-3 md:space-y-4 pt-2 px-4 md:px-6 pb-4 md:pb-6 overflow-hidden">
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 py-5 md:py-6 text-base md:text-lg font-bold group overflow-hidden" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </div>
                  ) : (
                    <>
                      Sign In to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <Button variant="link" type="button" className="text-sm text-muted-foreground hover:text-primary" onClick={() => setActiveTab("forgot-password")}>
                  Forgot your password?
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          {/* FORGOT PASSWORD TAB */}
          <TabsContent value="forgot-password" className="animate-fade-in">
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-5">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="reset-email" className="text-sm font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 md:h-6 md:w-6 text-foreground/70" />
                    <Input id="reset-email" type="email" placeholder="you@school.edu" className="pl-10 pr-4 py-6" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 py-6 text-base font-semibold group" disabled={isLoading}>
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

                <Button variant="link" type="button" className="text-sm text-muted-foreground hover:text-primary" onClick={() => setActiveTab("login")}>
                  Back to Login
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          {/* SIGN UP TAB */}
          <TabsContent value="signup" className="animate-fade-in">
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-4 px-4 md:px-6">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-sm font-semibold text-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-foreground/70" />
                    <Input id="signup-name" type="text" placeholder="John Doe" className="pl-10 pr-4 py-5" value={signupFullName} onChange={e => setSignupFullName(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-foreground/70" />
                    <Input id="signup-email" type="email" placeholder="you@school.edu" className="pl-10 pr-4 py-5" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-semibold text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-foreground/70" />
                    <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-12 py-5" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                {/* Account Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="signup-role" className="text-sm font-medium">Account Type</Label>
                  <Select value={signupRole} onValueChange={setSignupRole} required>
                    <SelectTrigger id="signup-role" className="py-5">
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
                  <div className="space-y-3 animate-fade-in">
                    <div className="space-y-2">
                      <Label htmlFor="school-name" className="text-sm font-medium">School Name</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="school-name" type="text" placeholder="Enter your school name" className="pl-10 pr-4 py-5" value={schoolName} onChange={e => setSchoolName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school-code" className="text-sm font-medium">School Code</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="school-code" type="text" placeholder="Create a unique school code" className="pl-10 pr-4 py-5 uppercase" value={schoolCode} onChange={e => setSchoolCode(e.target.value.toUpperCase())} required />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create a unique code for your school (e.g., SCHOOL2025)
                      </p>
                    </div>
                  </div>
                )}

                {/* Teacher/Student - School Code + Registration Number */}
                {(signupRole === "teacher" || signupRole === "student") && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="space-y-2">
                      <Label htmlFor="school-code" className="text-sm font-medium">School Code</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="school-code" type="text" placeholder="Enter your school code" className="pl-10 pr-4 py-5 uppercase" value={schoolCode} onChange={e => setSchoolCode(e.target.value.toUpperCase())} required />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get this code from your school administrator
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-number" className="text-sm font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4 text-primary" />
                        {signupRole === "student" ? "Student Number" : "Employee Number"} (Required)
                      </Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="reg-number" 
                          type="text" 
                          placeholder={`Enter your ${signupRole === "student" ? "student" : "employee"} number`}
                          className="pl-10 pr-4 py-5 uppercase" 
                          value={registrationNumber} 
                          onChange={e => setRegistrationNumber(e.target.value.toUpperCase())} 
                          required 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This number is provided by your school administrator
                      </p>
                    </div>
                    
                    {/* Gender for students */}
                    {signupRole === "student" && (
                      <div className="space-y-2">
                        <Label htmlFor="gender" className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          Gender (Required)
                        </Label>
                        <Select value={gender} onValueChange={setGender} required>
                          <SelectTrigger id="gender" className="py-5">
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
                  <div className="space-y-3 animate-fade-in">
                    <div className="space-y-2">
                      <Label htmlFor="school-code" className="text-sm font-medium">School Code</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="school-code" type="text" placeholder="Enter your school code" className="pl-10 pr-4 py-5 uppercase" value={schoolCode} onChange={e => setSchoolCode(e.target.value.toUpperCase())} required />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Children's Student Numbers
                      </Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Enter your children's student numbers to link your account
                      </p>
                      
                      {childStudentNumbers.map((num, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="relative flex-1">
                            <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder={`Child ${index + 1} student number`}
                              className="pl-10 pr-4 py-5 uppercase"
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
                          className="w-full"
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
                    <Label htmlFor="admin-key" className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {signupRole === "super_admin" ? "Super Admin Key" : "Admin Key"} (Required)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-foreground/70" />
                      <Input id="admin-key" type="password" placeholder={signupRole === "super_admin" ? "Enter super admin key" : "Enter admin key"} className="pl-10 pr-4 py-5" value={adminKey} onChange={e => setAdminKey(e.target.value)} required />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {signupRole === "super_admin" ? "This special key is required to create a super administrator account" : "This special key is required to create an administrator account"}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-2 px-4 md:px-6 pb-4 md:pb-6">
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 py-5 text-base font-semibold" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : "Create Account"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;