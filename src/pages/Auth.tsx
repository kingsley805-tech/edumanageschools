import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  GraduationCap, 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff,
  Shield,
  BookOpen,
  Users,
  ArrowRight,
  CheckCircle
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSchoolCode, setLoginSchoolCode] = useState("");

  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [adminKey, setAdminKey] = useState("");
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

    // Verify school code exists before attempting login
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

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!signupRole) {
      toast.error("Please select your role");
      setIsLoading(false);
      return;
    }

    if (signupRole === "super_admin") {
      if (!adminKey) {
        toast.error("Super Admin key is required for super administrator accounts");
        setIsLoading(false);
        return;
      }
    } else if (signupRole === "admin") {
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
    } else {
      if (!schoolCode) {
        toast.error("Please enter your school code");
        setIsLoading(false);
        return;
      }
    }

    const { error } = await signUp(
      signupEmail,
      signupPassword,
      signupFullName,
      signupRole,
      schoolCode,
      adminKey,
      schoolName
    );

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    toast.success("Account created successfully!");
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth?tab=reset-password`,
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

  const roleConfig = {
    super_admin: { icon: Shield, label: "Super Admin", description: "Multi-school management" },
    admin: { icon: Shield, label: "Administrator", description: "Full system access" },
    teacher: { icon: BookOpen, label: "Teacher", description: "Class and grade management" },
    parent: { icon: Users, label: "Parent", description: "Student progress tracking" },
    student: { icon: GraduationCap, label: "Student", description: "Learning portal access" }
  };



  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{
        backgroundImage: `url(${schoolPicture})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      
      {/* Gradient overlay for aesthetic enhancement */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/30 to-accent/20"></div>
      
      {/* Animated Background Elements */}
      <div className="absolute top-1/4 -left-20 h-80 w-80 rounded-full bg-primary/10 blur-2xl animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-accent/10 blur-2xl animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/5 blur-2xl"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>

      <Card className="w-full max-w-md relative z-10 backdrop-blur-xl bg-white/50 border-white/25 shadow-2xl rounded-3xl overflow-hidden border">
        {/* Header Gradient Bar */}
        <div className="h-1 bg-gradient-to-r from-primary to-accent"></div>
        
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            EduManage Portal
          </CardTitle>
          <CardDescription className="text-base">
            Secure access for your educational institution
          </CardDescription>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mx-6 mb-2 gap-2">
            <TabsTrigger 
              value="login"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all duration-200"
            >
              Login
            </TabsTrigger>
            <TabsTrigger 
              value="signup"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all duration-200"
            >
              Create Account
            </TabsTrigger>
          </TabsList>

          {/* LOGIN TAB */}
          <TabsContent value="login" className="animate-fade-in">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="login-email" className="text-sm font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@school.edu"
                      className="pl-10 pr-4 py-6"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-12 py-6"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="login-school-code" className="text-sm font-medium">School Code</Label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-school-code"
                      type="text"
                      placeholder="Enter your school code"
                      className="pl-10 pr-4 py-6 uppercase"
                      value={loginSchoolCode}
                      onChange={(e) => setLoginSchoolCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 py-6 text-base font-semibold group"
                  disabled={isLoading}
                >
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

                <Button 
                  variant="link" 
                  type="button" 
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => setActiveTab("forgot-password")}
                >
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
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@school.edu"
                      className="pl-10 pr-4 py-6"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 py-6 text-base font-semibold group"
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

                <Button 
                  variant="link" 
                  type="button" 
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => setActiveTab("login")}
                >
                  Back to Login
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          {/* SIGN UP TAB */}
          <TabsContent value="signup" className="animate-fade-in">
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="signup-name" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10 pr-4 py-6"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="signup-email" className="text-sm font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@school.edu"
                      className="pl-10 pr-4 py-6"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-12 py-6"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  
              
                </div>

                {signupRole === "super_admin" ? (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 animate-fade-in">
                    <p className="text-sm text-muted-foreground">
                      Super admins manage multiple schools. You'll be able to assign schools after account creation.
                    </p>
                  </div>
                ) : signupRole === "admin" ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="space-y-3">
                      <Label htmlFor="school-name" className="text-sm font-medium">School Name</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="school-name"
                          type="text"
                          placeholder="Enter your school name"
                          className="pl-10 pr-4 py-6"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          required={signupRole === "admin"}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="school-code" className="text-sm font-medium">School Code</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="school-code"
                          type="text"
                          placeholder="Create a unique school code"
                          className="pl-10 pr-4 py-6 uppercase"
                          value={schoolCode}
                          onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                          required={signupRole === "admin"}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create a unique code for your school (e.g., SCHOOL2025)
                      </p>
                    </div>
                  </div>
                ) : signupRole ? (
                  <div className="space-y-3 animate-fade-in">
                    <Label htmlFor="school-code" className="text-sm font-medium">School Code</Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="school-code"
                        type="text"
                        placeholder="Enter your school code"
                        className="pl-10 pr-4 py-6 uppercase"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        required={signupRole !== "admin" && signupRole !== "super_admin"}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get this code from your school administrator
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <Label htmlFor="signup-role" className="text-sm font-medium">Account Type</Label>
                  <Select value={signupRole} onValueChange={setSignupRole} required>
                    <SelectTrigger id="signup-role" className="py-6 pl-10">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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

                {(signupRole === "admin" || signupRole === "super_admin") && (
                  <div className="space-y-3 animate-fade-in">
                    <Label htmlFor="admin-key" className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {signupRole === "super_admin" ? "Super Admin Key" : "Admin Key"} (Required)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-key"
                        type="password"
                        placeholder={signupRole === "super_admin" ? "Enter super admin key" : "Enter admin key"}
                        className="pl-10 pr-4 py-6"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        required={signupRole === "admin" || signupRole === "super_admin"}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {signupRole === "super_admin" 
                        ? "This special key is required to create a super administrator account"
                        : "This special key is required to create an administrator account"}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 py-6 text-base font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : (
                    "Create Account"
                  )}
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
