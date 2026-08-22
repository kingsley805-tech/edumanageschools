import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap,
  Lock,
  Mail,
  User,
  Shield,
  BookOpen,
  Users,
  Hash,
  Phone,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePublicSignup } from "@/hooks/usePublicSignup";
import { supabase } from "@/integrations/supabase/client";
import { logLoginActivity } from "@/lib/auditLog";
import { normalizeAdmissionNumber, derivePrefixFromSchoolName } from "@/lib/admission-numbers";
import { submitStudentPasswordResetRequest } from "@/lib/studentPasswordRecovery";
import {
  buildStudentAuthEmail,
  ensureParentChildrenLinked,
  resolveLoginIdentifier,
  resolveStudentByAdmissionNumber,
  validateUnusedRegistrationNumber,
  type StudentAdmissionPreview,
} from "@/lib/auth-api";
import { TEACHER_DEACTIVATED_MESSAGE } from "@/lib/teacherAccountStatus";
import { EduManageLogo } from "@/components/EduManageLogo";
import { AuthHeroPanel } from "@/components/auth/AuthHeroPanel";
import {
  AuthField,
  AuthPasswordField,
  AuthSectionDivider,
  AuthSegmentedControl,
} from "@/components/auth/AuthFormControls";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { uuid, id } = useParams<{ uuid?: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user } = useAuth();
  const { role } = useUserRole();
  const { isSignupEnabled } = usePublicSignup();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "forgot-password">("login");
  
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
  
  // Registration number for students/employees
  const [registrationNumber, setRegistrationNumber] = useState("");
  
  // Gender for students
  const [gender, setGender] = useState("");
  
  // Parent child linking
  const [childStudentNumbers, setChildStudentNumbers] = useState<string[]>([""]);
  const [childPreview, setChildPreview] = useState<StudentAdmissionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [parentSchoolId, setParentSchoolId] = useState<string | null>(null);
  
  // Reset password (OTP flow)
  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetMaskedEmail, setResetMaskedEmail] = useState<string | null>(null);
  const [resetMaskedPhone, setResetMaskedPhone] = useState<string | null>(null);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [forgotPasswordMode, setForgotPasswordMode] = useState<"staff" | "student">("staff");
  const [studentResetAdmission, setStudentResetAdmission] = useState("");
  const [deactivatedNotice, setDeactivatedNotice] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setDeactivatedNotice(params.get("deactivated") === "teacher");
  }, [location.search]);

  // If signup is disabled by super admin, ensure activeTab stays on login
  useEffect(() => {
    if (!isSignupEnabled && activeTab === "signup") {
      setActiveTab("login");
    }
  }, [isSignupEnabled, activeTab]);

  // Support school UUID passed in route / query
  useEffect(() => {
    const targetUuid = uuid || id || searchParams.get("school_id") || searchParams.get("id");
    if (targetUuid && !schoolCode) {
      supabase
        .from("schools")
        .select("school_code, school_name, admission_prefix")
        .eq("id", targetUuid)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSchoolCode(data.school_code);
            setSchoolName(data.school_name);
            if (data.admission_prefix) setAdmissionPrefix(data.admission_prefix);
          }
        });
    }
  }, [uuid, id, searchParams]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setTimeout(() => setResetCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [resetCooldown]);

  useEffect(() => {
    if (
      !user ||
      !role ||
      !(
        location.pathname === "/auth" ||
        location.pathname.startsWith("/auth/") ||
        location.pathname.startsWith("/auth?")
      )
    ) {
      return;
    }

    // Fresh admin signup must land on plan selection, never the dashboard.
    try {
      if (role === "admin" && sessionStorage.getItem("admin_post_signup") === "1") {
        sessionStorage.removeItem("admin_post_signup");
        navigate("/admin/subscription", { replace: true });
        return;
      }
    } catch {
      /* ignore */
    }

    const roleRoutes: Record<string, string> = {
      admin: "/admin",
      super_admin: "/platform",
      accountant: "/accountant",
      auditor: "/auditor",
      teacher: "/teacher",
      parent: "/parent",
      student: "/student",
    };
    navigate(roleRoutes[role] || "/admin", { replace: true });
  }, [user, role, navigate, location.pathname]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const resolved = await resolveLoginIdentifier(loginIdentifier);
    if (!resolved.ok || !resolved.email) {
      const message =
        resolved.error_code === "teacher_account_deactivated"
          ? TEACHER_DEACTIVATED_MESSAGE
          : (resolved.error ?? "Could not sign in with those credentials.");
      toast.error(message, { duration: 8000 });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(resolved.email, loginPassword);
    if (error) {
      const errMsg = String((error as { message?: string })?.message ?? error);
      const isBanned =
        errMsg.toLowerCase().includes("banned") || errMsg.toLowerCase().includes("disabled");
      await logLoginActivity(false, loginIdentifier, errMsg);
      toast.error(isBanned ? TEACHER_DEACTIVATED_MESSAGE : errMsg, { duration: isBanned ? 8000 : undefined });
      setIsLoading(false);
      return;
    }

    await logLoginActivity(true, resolved.email);
    toast.success("Welcome back!");
    setIsLoading(false);
  };

  const validateRegistrationNumber = async (number: string, type: "student" | "employee") => {
    const result = await validateUnusedRegistrationNumber(number, type);
    if (!result.valid) {
      return { valid: false as const, error: result.error };
    }
    return {
      valid: true as const,
      schoolId: result.schoolId!,
      registrationNumber: result.registrationNumber,
      data: { school_id: result.schoolId, registration_number: result.registrationNumber },
    };
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

    if (signupRole === "admin") {
      if (!schoolName || !schoolCode || !signupPhone.trim()) {
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
      regNumber =
        validation.registrationNumber ?? normalizeAdmissionNumber(regNumber);
      if (signupRole === "student" && !gender) {
        toast.error("Please select your gender");
        setIsLoading(false);
        return;
      }
    }

    let schoolCodeForMeta = signupRole === "admin" ? schoolCode.toUpperCase() : "";
    if (schoolId && signupRole !== "admin") {
      const { data: schoolRow } = await supabase
        .from("schools")
        .select("school_code")
        .eq("id", schoolId)
        .maybeSingle();
      schoolCodeForMeta = schoolRow?.school_code?.toUpperCase() ?? "";
    }

    let emailForAuth = signupEmail.trim();
    if (signupRole === "student") {
      if (!schoolId || !regNumber) {
        toast.error("Valid admission number is required");
        setIsLoading(false);
        return;
      }
      emailForAuth = buildStudentAuthEmail(regNumber, schoolId);
    } else if (!emailForAuth) {
      toast.error("Email address is required");
      setIsLoading(false);
      return;
    }

    const { error } = await signUp({
      email: emailForAuth,
      password: signupPassword,
      fullName: signupFullName,
      role: signupRole,
      schoolCode: schoolCodeForMeta,
      schoolId: schoolId ?? undefined,
      schoolName,
      admissionPrefix:
        admissionPrefix.toUpperCase() ||
        derivePrefixFromSchoolName(schoolName) ||
        schoolCode.toUpperCase(),
      registrationNumber: regNumber,
      gender,
      phone: signupPhone,
      childAdmissionNumbers:
        signupRole === "parent" ? childStudentNumbers.filter((n) => n.trim()) : undefined,
    });

    if (error) {
      const err = error as { message?: string; code?: string };
      const rawMsg = (err.message ?? "").toLowerCase();
      const alreadyExists =
        err.code === "user_already_exists" ||
        rawMsg.includes("already registered") ||
        rawMsg.includes("already been registered") ||
        rawMsg.includes("user already exists");

      // A parent whose email is already registered is almost always the same
      // guardian returning to link a child — sign them in and link instead of failing.
      if (alreadyExists && signupRole === "parent") {
        const { error: signInError } = await signIn(emailForAuth, signupPassword);
        if (!signInError) {
          const numbers = childStudentNumbers.filter((n) => n.trim());
          const linkResult = await ensureParentChildrenLinked(numbers);
          if (linkResult.ok) {
            toast.success(
              `Welcome back — ${linkResult.linked} child${linkResult.linked === 1 ? "" : "ren"} linked to your account.`,
            );
          } else {
            toast.success(
              "Signed in. Open My Children to finish linking your child.",
            );
          }
          setIsLoading(false);
          return;
        }
        toast.error(
          "An account with this email already exists. Enter the correct password to sign in and link your child, or use the Login tab.",
        );
        setIsLoading(false);
        return;
      }

      let msg = err.message ?? "Failed to create account";
      if (alreadyExists) {
        msg = "An account with this email already exists. Please use the Login tab to sign in.";
      } else if (rawMsg.includes("database error")) {
        msg =
          "Account setup failed on the server. Ask your admin to run fix-student-signup-500.sql in Supabase, then try again.";
      }
      toast.error(msg);
      setIsLoading(false);
      return;
    }

    if (signupRole === "admin") {
      const { error: signInError } = await signIn(emailForAuth, signupPassword);
      if (signInError) {
        toast.error("Account created. Please sign in to choose your subscription plan.");
        setActiveTab("login");
        setIsLoading(false);
        return;
      }
      try {
        sessionStorage.setItem("admin_post_signup", "1");
      } catch {
        /* ignore */
      }
      toast.success("Account created! Choose a subscription plan to get started.");
      navigate("/admin/subscription", { replace: true });
      setIsLoading(false);
      return;
    }

    if (signupRole === "parent") {
      const numbers = childStudentNumbers.filter((n) => n.trim());
      const linkResult = await ensureParentChildrenLinked(numbers);
      if (!linkResult.ok) {
        toast.error(
          linkResult.error ??
            "Account created. Sign in and open My Children to link your child.",
        );
      } else {
        toast.success(
          `Account created — ${linkResult.linked} child${linkResult.linked === 1 ? "" : "ren"} linked.`,
        );
        setIsLoading(false);
        return;
      }
    }

    toast.success("Account created successfully!");
    setIsLoading(false);
  };

  const resetReset = () => {
    setResetEmail("");
    setResetOtp("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetMaskedEmail(null);
    setResetMaskedPhone(null);
    setResetStep("request");
    setResetCooldown(0);
    setForgotPasswordMode("staff");
    setStudentResetAdmission("");
  };

  const invokeOtp = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("password-reset-otp", { body: payload });
    if (error) {
      return { ok: false, message: error.message } as { ok: boolean; message?: string } & Record<string, any>;
    }
    return data as { ok: boolean; message?: string } & Record<string, any>;
  };

  const handleStudentResetRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const admission = normalizeAdmissionNumber(studentResetAdmission);
    if (!admission) {
      toast.error("Enter your admission number.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await submitStudentPasswordResetRequest(admission);
      if (res.rate_limited) {
        toast.error(res.message ?? "Too many requests today.");
        return;
      }
      toast.success(
        res.message ??
          "Your request has been submitted. Your school administrator will verify your admission number and contact your parent/guardian.",
      );
      resetReset();
      setActiveTab("login");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not submit request.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setIsLoading(true);
    const res = await invokeOtp({ action: "request", identifier: resetEmail.trim() });
    setIsLoading(false);
    if (res.student) {
      toast.error("Students cannot self-reset. Please contact your school administrator.");
      return;
    }
    if (res.cooldown) {
      toast.error(res.message ?? "Please wait before requesting another code.");
      setResetCooldown(res.retry_in_seconds ?? 90);
      return;
    }
    if (res.rate_limited) {
      toast.error(res.message ?? "Too many requests. Try later.");
      return;
    }
    if (!res.ok && !res.sent) {
      toast.error(res.message ?? "Could not send code.");
      return;
    }
    setResetMaskedEmail(res.masked_email ?? null);
    setResetMaskedPhone(res.masked_phone ?? null);
    setResetStep("verify");
    setResetCooldown(90);
    toast.success(res.message ?? "Code sent.");
  };

  const handleResendOtp = async () => {
    if (resetCooldown > 0 || !resetEmail) return;
    setIsLoading(true);
    const res = await invokeOtp({ action: "request", identifier: resetEmail.trim() });
    setIsLoading(false);
    if (res.cooldown) {
      setResetCooldown(res.retry_in_seconds ?? 90);
      toast.error(res.message ?? "Please wait.");
      return;
    }
    if (res.ok && res.sent) {
      setResetCooldown(90);
      toast.success("New code sent.");
    } else {
      toast.error(res.message ?? "Could not resend.");
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resetNewPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    const res = await invokeOtp({
      action: "reset",
      identifier: resetEmail.trim(),
      code: resetOtp.trim(),
      new_password: resetNewPassword,
    });
    setIsLoading(false);
    if (!res.ok) {
      toast.error(res.message ?? "Could not reset password.");
      return;
    }
    toast.success("Password updated. Please sign in.");
    resetReset();
    setActiveTab("login");
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
    <div className="flex min-h-screen bg-[#101216] text-[#e1e4ec] font-sans antialiased">
      <AuthHeroPanel />

      <main className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <div className="w-full max-w-[580px] xl:max-w-[620px]">
          <div className="mb-6 lg:hidden flex justify-center">
            <EduManageLogo to="/" imgClassName="h-9 brightness-0 invert" />
          </div>

          <div className="w-full rounded-2xl border border-[#2d323e] bg-[#16181f] p-6 sm:p-9 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-6">
              <header className="text-center space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {activeTab === "forgot-password"
                    ? "Reset your password"
                    : activeTab === "signup"
                      ? "Create your account"
                      : "Sign in to your portal"}
                </h2>
                <p className="text-xs sm:text-sm font-normal text-[#949cae]">
                  {activeTab === "forgot-password"
                    ? "We'll help you get back into your account."
                    : activeTab === "signup"
                      ? "Set up access for your school in a few steps."
                      : "Welcome back. Enter your details to continue."}
                </p>
              </header>

              {/* Tab Toggle (Only visible if public signup is enabled) */}
              {activeTab !== "forgot-password" && isSignupEnabled && (
                <div>
                  <AuthSegmentedControl
                    ariaLabel="Authentication mode"
                    value={activeTab}
                    onChange={(value) => setActiveTab(value)}
                    options={[
                      { value: "login", label: "Sign in" },
                      { value: "signup", label: "Create account" },
                    ]}
                  />
                </div>
              )}

              {/* Login Form */}
              {activeTab === "login" && (
                <form onSubmit={handleLogin} className="animate-fade-in space-y-5">
                  {deactivatedNotice && (
                    <div
                      role="alert"
                      className="rounded-xl border border-[#3e4453] bg-[#1b1e26] px-4 py-3 text-sm text-white"
                    >
                      {TEACHER_DEACTIVATED_MESSAGE}
                    </div>
                  )}

                  <AuthField
                    id="login-identifier"
                    label="Admission number or email"
                    icon={Hash}
                    type="text"
                    autoComplete="username"
                    placeholder="MINGO-Stu-2026-001"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    hint="Students sign in with their admission number. Staff and parents may use email."
                    required
                  />

                  <div className="space-y-1.5">
                    <AuthPasswordField
                      id="login-password"
                      label="Password"
                      icon={Lock}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#cbd0dd] underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none"
                        onClick={() => setActiveTab("forgot-password")}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-md active:scale-[0.99] transition-all"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                        Signing in…
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>

                  <p className="text-center text-xs leading-relaxed text-[#8c93a4] px-2">
                    Having trouble? Your account may exist but be incomplete — try a password reset or
                    contact your school administrator.
                  </p>
                </form>
              )}

          {/* Forgot Password */}
          {activeTab === "forgot-password" && resetStep === "request" && (
            <div className="animate-fade-in space-y-6">
              <AuthSegmentedControl
                ariaLabel="Account type for password reset"
                value={forgotPasswordMode}
                onChange={(value) => setForgotPasswordMode(value)}
                options={[
                  { value: "staff", label: "Staff / Parent" },
                  { value: "student", label: "Student" },
                ]}
              />

              {forgotPasswordMode === "student" ? (
                <form onSubmit={handleStudentResetRequest} className="space-y-5">
                  <p className="text-xs sm:text-sm leading-relaxed text-[#949cae]">
                    Enter your admission number. Your school administrator will verify it and send a
                    temporary password to your parent or guardian.
                  </p>

                  <AuthField
                    id="student-reset-admission"
                    label="Admission number"
                    icon={Hash}
                    type="text"
                    autoComplete="username"
                    placeholder="MINGO-Stu-2026-001"
                    className="uppercase"
                    value={studentResetAdmission}
                    onChange={(e) => setStudentResetAdmission(normalizeAdmissionNumber(e.target.value))}
                    required
                  />

                  <Button type="submit" className="h-11 w-full rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-md active:scale-[0.99] transition-all" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Submitting request…
                      </>
                    ) : (
                      "Submit reset request"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full rounded-xl border border-[#2e3340] bg-[#111317] hover:bg-[#1f232c] text-white transition-all"
                    onClick={() => {
                      resetReset();
                      setActiveTab("login");
                    }}
                  >
                    Back to sign in
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <p className="text-xs sm:text-sm leading-relaxed text-[#949cae]">
                    Enter your registered email and we'll send an 8-digit verification code to your
                    email and phone.
                  </p>

                  <AuthField
                    id="reset-email"
                    label="Registered email or staff number"
                    icon={Mail}
                    type="text"
                    autoComplete="username"
                    placeholder="you@school.edu"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />

                  <Button type="submit" className="h-11 w-full rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-md active:scale-[0.99] transition-all" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Sending code…
                      </>
                    ) : (
                      "Send verification code"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full rounded-xl border border-[#2e3340] bg-[#111317] hover:bg-[#1f232c] text-white transition-all"
                    onClick={() => {
                      resetReset();
                      setActiveTab("login");
                    }}
                  >
                    Back to sign in
                  </Button>
                </form>
              )}
            </div>
          )}

          {activeTab === "forgot-password" && resetStep === "verify" && (
            <form onSubmit={handleVerifyAndReset} className="animate-fade-in space-y-5">
              <div className="rounded-xl border border-[#2e3340] bg-[#111317] px-4 py-3">
                <p className="text-xs sm:text-sm text-[#949cae]">
                  We sent a code to{" "}
                  <span className="font-medium text-white">
                    {resetMaskedEmail ?? "your email"}
                  </span>
                  {resetMaskedPhone ? (
                    <>
                      {" "}
                      and{" "}
                      <span className="font-medium text-white">{resetMaskedPhone}</span>
                    </>
                  ) : null}
                  . It expires in 15 minutes.
                </p>
              </div>

              <AuthField
                id="reset-otp"
                label="8-digit verification code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{8}"
                maxLength={8}
                placeholder="00000000"
                className="text-center font-mono text-lg tracking-[0.5em]"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                required
              />

              <AuthPasswordField
                id="reset-new"
                label="New password"
                icon={Lock}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                minLength={8}
                required
              />

              <AuthPasswordField
                id="reset-confirm"
                label="Confirm new password"
                icon={Lock}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                minLength={8}
                required
              />

              <Button type="submit" className="h-11 w-full rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-md active:scale-[0.99] transition-all" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                    Verifying…
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetStep("request");
                    setResetOtp("");
                  }}
                >
                  Change email
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  disabled={resetCooldown > 0 || isLoading}
                  onClick={handleResendOtp}
                >
                  {resetCooldown > 0 ? `Resend in ${resetCooldown}s` : "Resend code"}
                </Button>
              </div>
            </form>
          )}


          {/* Signup Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignup} className="animate-fade-in space-y-5">
              {/* Account Type Selection — first so remaining fields can adapt */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="signup-role" className="text-xs font-semibold text-white">
                  Account type
                </Label>
                <Select value={signupRole} onValueChange={setSignupRole} required>
                  <SelectTrigger id="signup-role" className="h-11 rounded-xl border-[#2e3340] bg-[#111317] text-white focus:border-white focus:ring-0">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="border-[#2e3340] bg-[#16181f] text-white">
                    {Object.entries(roleConfig).map(([key, config]) => {
                      const IconComponent = config.icon;
                      return (
                        <SelectItem key={key} value={key} className="py-2.5 hover:bg-[#20242c] focus:bg-[#20242c] text-white">
                          <div className="flex items-center gap-3">
                            <IconComponent
                              className="h-4 w-4 text-white"
                              aria-hidden="true"
                            />
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-medium text-white">{config.label}</span>
                              <span className="text-xs text-[#8c93a4]">
                                {config.description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <AuthField
                id="signup-name"
                label="Full name"
                icon={User}
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                value={signupFullName}
                onChange={(e) => setSignupFullName(e.target.value)}
                required
              />

              {signupRole !== "student" && (
                <AuthField
                  id="signup-email"
                  label="Email address"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required={signupRole !== "" && signupRole !== "student"}
                />
              )}

              <AuthPasswordField
                id="signup-password"
                label="Password"
                icon={Lock}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
              />

              <AuthPasswordField
                id="signup-confirm-password"
                label="Confirm password"
                icon={Lock}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                required
              />

              {/* Admin - New School Creation */}
              {signupRole === "admin" && (
                <div className="animate-fade-in space-y-5">
                  <AuthSectionDivider>School setup</AuthSectionDivider>

                  <AuthField
                    id="school-name"
                    label="School name"
                    icon={GraduationCap}
                    type="text"
                    placeholder="Enter your school name"
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

                  <AuthField
                    id="school-code"
                    label="School code (login)"
                    icon={Hash}
                    type="text"
                    placeholder="Create a unique school code"
                    className="uppercase"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    required
                  />

                  <AuthField
                    id="admission-prefix"
                    label="Admission number prefix"
                    icon={Hash}
                    type="text"
                    placeholder="MINGO"
                    className="uppercase"
                    value={admissionPrefix}
                    onChange={(e) => {
                      setAdmissionPrefixManual(true);
                      setAdmissionPrefix(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12),
                      );
                    }}
                    hint={`Auto-filled from school name, not school code. Example: ${admissionPrefix || derivePrefixFromSchoolName(schoolName) || "MIN"}-Stu-2026-001`}
                    required
                  />
                </div>
              )}

              {/* Teacher/Student — admission number only (school auto-detected) */}
              {(signupRole === "teacher" || signupRole === "student") && (
                <div className="animate-fade-in space-y-5">
                  <AuthSectionDivider>
                    {signupRole === "student" ? "Student details" : "Staff details"}
                  </AuthSectionDivider>

                  <AuthField
                    id="reg-number"
                    label={signupRole === "student" ? "Admission number" : "Employee number"}
                    icon={Hash}
                    placeholder={`Enter your ${signupRole === "student" ? "student" : "employee"} number`}
                    className="uppercase"
                    autoComplete="off"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                    hint={
                      signupRole === "student"
                        ? "This is your login ID. You will sign in with this number and your password — no personal email."
                        : "Format: SCHOOL-Stu-2026-001 — your school is detected from this number."
                    }
                    required
                  />

                  {signupRole === "student" && (
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium">
                        Gender
                      </Label>
                      <Select value={gender} onValueChange={setGender} required>
                        <SelectTrigger id="gender" className="h-11">
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

              {(signupRole === "parent" || signupRole === "admin") && (
                <div className="animate-fade-in">
                  <AuthField
                    id="signup-phone"
                    label="Phone number"
                    type="tel"
                    icon={Phone}
                    placeholder="+233 20 123 4567"
                    autoComplete="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Parent — admission number links child & school */}
              {signupRole === "parent" && (
                <div className="animate-fade-in space-y-4">
                  <AuthSectionDivider>Link your children</AuthSectionDivider>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Enter your child&apos;s admission number — the school and class are detected
                    automatically.
                  </p>

                  {previewLoading && (
                    <p className="text-xs text-muted-foreground" role="status">
                      Verifying admission number…
                    </p>
                  )}
                  {childPreview?.valid && (
                    <div className="animate-fade-in space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
                      <p className="font-medium text-foreground">{childPreview.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        School: {childPreview.school_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Class: {childPreview.class_name}
                      </p>
                      <p className="pt-1 font-mono text-xs text-muted-foreground">
                        {childPreview.admission_number}
                      </p>
                    </div>
                  )}
                  {childPreview && !childPreview.valid && !previewLoading && (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                    >
                      {childPreview.error}
                    </p>
                  )}

                  <div className="space-y-3">
                    {childStudentNumbers.map((num, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex-1">
                          <AuthField
                            id={`child-admission-${index}`}
                            label={`Child ${index + 1} admission number`}
                            icon={Hash}
                            placeholder="SCHOOL-Stu-2026-001"
                            className="uppercase"
                            autoComplete="off"
                            value={num}
                            onChange={(e) => updateChildNumber(index, e.target.value)}
                            required={index === 0}
                          />
                        </div>
                        {childStudentNumbers.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0"
                            aria-label={`Remove child ${index + 1}`}
                            onClick={() => removeChildNumberField(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {childStudentNumbers.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addChildNumberField}
                      className="h-11 w-full border-dashed"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add another child
                    </Button>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-md active:scale-[0.99] transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>

              <p className="text-center text-xs leading-relaxed text-[#8c93a4]">
                By creating an account you agree to your school&apos;s acceptable use policy.
              </p>
            </form>
          )}

          {/* Fallback when signup is visited while disabled */}
          {activeTab === "signup" && !isSignupEnabled && (
            <div className="rounded-2xl border border-[#2e3340] bg-[#111317] p-6 text-center space-y-3">
              <div className="size-10 rounded-full bg-[#1e222a] border border-[#393f4e] text-white mx-auto flex items-center justify-center">
                <Lock className="size-5" />
              </div>
              <h3 className="font-bold text-white text-sm">Public Registration Disabled</h3>
              <p className="text-xs text-[#8c93a4] leading-relaxed max-w-sm mx-auto">
                Self-service account registration is currently disabled by system administration. Please contact your school administrator to obtain an account.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 rounded-xl border border-[#2e3340] bg-[#16181f] text-white hover:bg-[#20242c]"
                onClick={() => setActiveTab("login")}
              >
                Return to Sign in
              </Button>
            </div>
          )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;