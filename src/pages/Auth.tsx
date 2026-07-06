// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Lock, Mail, User, Eye, EyeOff, Shield, BookOpen, Users, ArrowRight, Hash, Plus, X, Sparkles, CheckCircle2, TrendingUp, Bell, MessageSquare, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
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
import schoolPicture from "@/assets/School Picture.webp";
import { motion, AnimatePresence } from "framer-motion";

const EducationHubAnimation = () => {
  return (
    <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center scale-95 sm:scale-100">
      {/* Background glow in center */}
      <div className="absolute w-40 h-40 rounded-full bg-green-500/10 blur-3xl opacity-60 pointer-events-none" />

      {/* Orbit 3 (Outer) */}
      <motion.div 
        className="absolute w-[300px] h-[300px] rounded-full border border-dashed border-white/15"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />

      {/* Orbit 2 (Middle) */}
      <motion.div 
        className="absolute w-[220px] h-[220px] rounded-full border border-dashed border-white/10"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />

      {/* Orbit 1 (Inner) */}
      <motion.div 
        className="absolute w-[140px] h-[140px] rounded-full border border-dashed border-white/5"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Center Cap */}
      <div className="absolute z-20 flex flex-col items-center">
        <motion.div 
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500 shadow-xl shadow-green-500/30 border border-green-400/30 relative"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <GraduationCap className="h-8 w-8 text-white" />
          
          {/* Pulsing rings */}
          <motion.div 
            className="absolute -inset-3 rounded-2xl border border-green-400/40 pointer-events-none"
            animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute -inset-6 rounded-[1.5rem] border border-green-500/20 pointer-events-none"
            animate={{ scale: [0.9, 1.3, 0.9], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
        </motion.div>
      </div>

      {/* Icon 1: Academics (BookOpen) - Top Left */}
      <motion.div 
        className="absolute top-2 left-6 z-10"
        animate={{ y: [0, -8, 0], x: [0, 4, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl relative group">
          <div className="absolute -inset-0.5 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity" />
          <div className="absolute w-5 h-5 rounded-full bg-white/20 blur-md pointer-events-none" />
          <BookOpen className="h-5 w-5 text-white relative z-10" />
        </div>
      </motion.div>

      {/* Icon 2: Administration (Shield) - Bottom Left */}
      <motion.div 
        className="absolute bottom-6 left-8 z-10"
        animate={{ y: [0, 6, 0], x: [0, -4, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl relative group">
          <div className="absolute -inset-0.5 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity" />
          <div className="absolute w-5 h-5 rounded-full bg-white/20 blur-md pointer-events-none" />
          <Shield className="h-5 w-5 text-white relative z-10" />
        </div>
      </motion.div>

      {/* Icon 3: Communication (MessageSquare) - Top Right */}
      <motion.div 
        className="absolute top-8 right-6 z-10"
        animate={{ y: [0, -6, 0], x: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl relative group">
          <div className="absolute -inset-0.5 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity" />
          <div className="absolute w-5 h-5 rounded-full bg-white/20 blur-md pointer-events-none" />
          <MessageSquare className="h-5 w-5 text-white relative z-10" />
        </div>
      </motion.div>

      {/* Icon 4: Analytics (TrendingUp) - Bottom Right */}
      <motion.div 
        className="absolute bottom-10 right-8 z-10"
        animate={{ y: [0, 8, 0], x: [0, 4, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl relative group">
          <div className="absolute -inset-0.5 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity" />
          <div className="absolute w-5 h-5 rounded-full bg-white/20 blur-md pointer-events-none" />
          <TrendingUp className="h-5 w-5 text-white relative z-10" />
        </div>
      </motion.div>

      {/* Icon 5: Calendar (Calendar) - Top Center (offset) */}
      <motion.div 
        className="absolute -top-6 left-1/2 -translate-x-1/2 z-10"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl relative group">
          <div className="absolute -inset-0.5 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity" />
          <div className="absolute w-5 h-5 rounded-full bg-white/20 blur-md pointer-events-none" />
          <Calendar className="h-5 w-5 text-white relative z-10" />
        </div>
      </motion.div>
    </div>
  );
};

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setTimeout(() => setResetCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [resetCooldown]);

  useEffect(() => {
    if (user && role && (location.pathname === "/auth" || location.pathname.startsWith("/auth?"))) {
      const roleRoutes: Record<string, string> = {
        admin: "/admin",
        super_admin: "/platform",
        accountant: "/accountant",
        auditor: "/auditor",
        teacher: "/teacher",
        parent: "/parent",
        student: "/student",
      };
      navigate(roleRoutes[role] || "/admin");
    }
  }, [user, role, navigate, location.pathname]);

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
      let msg = err.message ?? "Failed to create account";
      if (msg.toLowerCase().includes("database error")) {
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-black text-white font-sans relative overflow-hidden">
      {/* Background Mesh Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[40%] w-[40%] h-[40%] rounded-full bg-green-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Left Panel - Hero Section */}
      <div className="relative lg:w-1/2 min-h-[360px] lg:min-h-screen flex flex-col justify-between p-8 lg:p-12 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/15 z-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: `url(${schoolPicture})` }}
        />
        <div className="absolute inset-0 bg-black pointer-events-none" />

        <div className="relative z-20 flex flex-col h-full justify-between gap-12">
          {/* Logo & Title */}
          <Link to="/" className="flex items-center gap-3.5 group w-fit">
            <div className="flex h-11 w-11 lg:h-13 lg:w-13 items-center justify-center rounded-2xl bg-green-500 shadow-md shadow-green-500/20 ring-1 ring-green-400/30 transition-transform group-hover:scale-105 duration-300">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] tracking-[4px] font-bold text-white block uppercase font-mono">
                EDUMANAGE
              </span>
              <h1 className="text-lg lg:text-xl font-bold text-white tracking-tight">
                Your school, organized.
              </h1>
            </div>
          </Link>
          
          {/* Center Animation */}
          <div className="flex flex-1 items-center justify-center min-h-[300px] lg:min-h-0 relative">
            <EducationHubAnimation />
          </div>
          
          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-4 mt-auto">
            <div className="bg-white/5 border border-white/15 backdrop-blur-md rounded-2xl p-4 lg:p-5 hover:border-green-500/30 transition-colors duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 mb-3 border border-green-500/30">
                <Shield className="h-4.5 w-4.5 text-green-400" />
              </div>
              <span className="text-[9px] font-bold tracking-[2px] text-white uppercase block mb-1 font-mono">
                SECURE ACCESS
              </span>
              <span className="text-xs lg:text-sm font-semibold text-white">
                Role-based dashboards
              </span>
            </div>
            <div className="bg-white/5 border border-white/15 backdrop-blur-md rounded-2xl p-4 lg:p-5 hover:border-green-500/30 transition-colors duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 mb-3 border border-green-500/30">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-400" />
              </div>
              <span className="text-[9px] font-bold tracking-[2px] text-white uppercase block mb-1 font-mono">
                SCHOOLS
              </span>
              <span className="text-xs lg:text-sm font-semibold text-white">
                Admission-based access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-lg space-y-6 bg-white/5 border border-white/15 backdrop-blur-xl rounded-3xl p-6 lg:p-8 shadow-2xl relative">
          <div className="absolute top-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent blur-[1px]" />
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] tracking-[2px] font-bold text-white uppercase block font-mono">
                WELCOME TO EDUMANAGE
              </span>
              <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight mt-1">
                Access your school portal
              </h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black border border-white/15">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Tab Toggle */}
          {activeTab !== "forgot-password" && (
            <div className="flex bg-black/60 border border-white/15 rounded-xl p-1 relative">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold relative z-10 transition-colors duration-200"
                style={{ color: activeTab === "login" ? "#ffffff" : "rgba(255,255,255,0.5)" }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("signup")}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold relative z-10 transition-colors duration-200"
                style={{ color: activeTab === "signup" ? "#ffffff" : "rgba(255,255,255,0.5)" }}
              >
                Create Account
              </button>
              
              {/* Sliding active tab indicator */}
              <motion.div
                className="absolute top-1 bottom-1 rounded-lg bg-green-500 shadow-md shadow-green-500/20"
                layout
                initial={false}
                animate={{
                  left: activeTab === "login" ? "4px" : "50%",
                  right: activeTab === "login" ? "50%" : "4px"
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            </div>
          )}

          {/* Login Form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="login-identifier" className="text-xs font-semibold text-white/80">
                  Admission number or email
                </Label>
                <div className="relative group">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                  <Input
                    id="login-identifier"
                    type="text"
                    placeholder="MINGO-Stu-2026-001"
                    className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[11px] text-white/50 leading-normal">
                  Students: use your admission number and password. Staff and parents may use email.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-xs font-semibold text-white/80">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-12 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-green-500 hover:bg-green-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 group"
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
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>

              <div className="text-center space-y-3 pt-2">
                <button
                  type="button"
                  className="text-xs font-bold text-green-400 hover:text-green-300 hover:underline transition-all"
                  onClick={() => setActiveTab("forgot-password")}
                >
                  Forgot your password?
                </button>
                <p className="text-[10px] text-white/50 leading-normal max-w-sm mx-auto">
                  Having trouble? The account may exist but be incomplete. Try password reset or contact support.
                </p>
              </div>
            </form>
          )}

          {/* Forgot Password */}
          {activeTab === "forgot-password" && resetStep === "request" && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex bg-black/60 border border-white/15 rounded-xl p-1 relative">
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode("staff")}
                  className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold relative z-10 transition-colors duration-200"
                  style={{ color: forgotPasswordMode === "staff" ? "#ffffff" : "rgba(255,255,255,0.5)" }}
                >
                  Staff / Parent
                </button>
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode("student")}
                  className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold relative z-10 transition-colors duration-200"
                  style={{ color: forgotPasswordMode === "student" ? "#ffffff" : "rgba(255,255,255,0.5)" }}
                >
                  Student
                </button>
                <motion.div
                  className="absolute top-1 bottom-1 rounded-lg bg-green-500 shadow-md shadow-green-500/20"
                  layout
                  initial={false}
                  animate={{
                    left: forgotPasswordMode === "staff" ? "4px" : "50%",
                    right: forgotPasswordMode === "staff" ? "50%" : "4px",
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              </div>

              {forgotPasswordMode === "student" ? (
                <form onSubmit={handleStudentResetRequest} className="space-y-5">
                  <div className="text-center py-1 space-y-2">
                    <p className="text-sm font-semibold text-white">Student password recovery</p>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Enter your admission number. Your school administrator will verify it and send a temporary password to your parent/guardian.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-reset-admission" className="text-xs font-semibold text-white/80">
                      Admission number
                    </Label>
                    <div className="relative group">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                      <Input
                        id="student-reset-admission"
                        type="text"
                        placeholder="MINGO-Stu-2026-001"
                        className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl uppercase"
                        value={studentResetAdmission}
                        onChange={(e) => setStudentResetAdmission(normalizeAdmissionNumber(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-green-500 hover:bg-green-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 group"
                    disabled={isLoading}
                  >
                    {isLoading ? "Submitting request..." : (<>Submit reset request <ArrowRight className="h-4 w-4" /></>)}
                  </Button>

                  <button
                    type="button"
                    className="w-full text-xs font-semibold text-white/60 hover:text-white transition-colors py-1"
                    onClick={() => { resetReset(); setActiveTab("login"); }}
                  >
                    Back to Login
                  </button>
                </form>
              ) : (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="text-center py-1 space-y-2">
                <p className="text-sm font-semibold text-white">Reset your password</p>
                <p className="text-xs text-white/60 leading-relaxed">
                  Enter your registered email. We'll send an 8-digit code to your email and phone.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-xs font-semibold text-white/80">
                  Registered email or staff number
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                  <Input
                    id="reset-email"
                    type="text"
                    placeholder="you@school.edu"
                    className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-green-500 hover:bg-green-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 group"
                disabled={isLoading}
              >
                {isLoading ? "Sending code..." : (<>Send OTP code <ArrowRight className="h-4 w-4" /></>)}
              </Button>

              <button
                type="button"
                className="w-full text-xs font-semibold text-white/60 hover:text-white transition-colors py-1"
                onClick={() => { resetReset(); setActiveTab("login"); }}
              >
                Back to Login
              </button>
            </form>
              )}
            </div>
          )}

          {activeTab === "forgot-password" && resetStep === "verify" && (
            <form onSubmit={handleVerifyAndReset} className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-white">Enter your code</p>
                <p className="text-[11px] text-white/60">
                  Sent to {resetMaskedEmail ?? "your email"}{resetMaskedPhone ? ` and ${resetMaskedPhone}` : ""}. Expires in 15 minutes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-otp" className="text-xs font-semibold text-white/80">8-digit code</Label>
                <Input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{8}"
                  maxLength={8}
                  placeholder="••••••••"
                  className="h-12 text-center tracking-[0.6em] text-lg font-mono border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white rounded-xl"
                  value={resetOtp}
                  onChange={e => setResetOtp(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-new" className="text-xs font-semibold text-white/80">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  <Input
                    id="reset-new"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="pl-10 pr-12 h-12 border-white/15 bg-black/40 text-white rounded-xl"
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm" className="text-xs font-semibold text-white/80">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  <Input
                    id="reset-confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="pl-10 h-12 border-white/15 bg-black/40 text-white rounded-xl"
                    value={resetConfirmPassword}
                    onChange={e => setResetConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-green-500 hover:bg-green-400 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Verify & Reset Password"}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  className="font-semibold text-white/60 hover:text-white"
                  onClick={() => { setResetStep("request"); setResetOtp(""); }}
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  disabled={resetCooldown > 0 || isLoading}
                  className="font-semibold text-green-400 hover:text-green-300 hover:underline disabled:text-white/40 disabled:no-underline"
                  onClick={handleResendOtp}
                >
                  {resetCooldown > 0 ? `Resend in ${resetCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}


          {/* Signup Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4 animate-fade-in max-h-[60vh] overflow-y-auto pr-2 pb-2 scrollbar-thin scrollbar-thumb-white/20">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-xs font-semibold text-white/80">
                  Full Name
                </Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={signupFullName}
                    onChange={e => setSignupFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {signupRole !== "student" && (
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-xs font-semibold text-white/80">
                    Email Address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@school.edu"
                      className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required={signupRole !== "" && signupRole !== "student"}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-xs font-semibold text-white/80">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-12 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Account Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="signup-role" className="text-xs font-semibold text-white/80">
                  Account Type
                </Label>
                <Select value={signupRole} onValueChange={setSignupRole} required>
                  <SelectTrigger id="signup-role" className="h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white rounded-xl">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/15 text-white">
                    {Object.entries(roleConfig).map(([key, config]) => {
                      const IconComponent = config.icon;
                      return (
                        <SelectItem key={key} value={key} className="py-2.5 hover:bg-white/10 text-white focus:bg-white/10 focus:text-white rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/20">
                              <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-xs text-white">{config.label}</span>
                              <span className="text-[10px] text-white/50">{config.description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Admin - New School Creation */}
              {signupRole === "admin" && (
                <div className="space-y-4 animate-fade-in border-t border-white/15 pt-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="school-name" className="text-xs font-semibold text-white/80">
                      School Name
                    </Label>
                    <div className="relative group">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                      <Input
                        id="school-name"
                        type="text"
                        placeholder="Enter your school name"
                        className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
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
                    <Label htmlFor="school-code" className="text-xs font-semibold text-white/80">
                      School Code (login)
                    </Label>
                    <div className="relative group">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                      <Input
                        id="school-code"
                        type="text"
                        placeholder="Create a unique school code"
                        className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl uppercase"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admission-prefix" className="text-xs font-semibold text-white/80">
                      Admission number prefix
                    </Label>
                    <div className="relative group">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                      <Input
                        id="admission-prefix"
                        type="text"
                        placeholder="MINGO"
                        className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl uppercase"
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
                    <p className="text-[10px] text-white/50 leading-normal">
                      Auto-filled from school name (first 3 letters), not school code. Example:{" "}
                      {admissionPrefix || derivePrefixFromSchoolName(schoolName) || "MIN"}-Stu-2026-001
                    </p>
                  </div>
                </div>
              )}

              {/* Teacher/Student — admission number only (school auto-detected) */}
              {(signupRole === "teacher" || signupRole === "student") && (
                <div className="space-y-4 animate-fade-in border-t border-white/15 pt-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-number" className="text-xs font-semibold text-white/80">
                      {signupRole === "student" ? "Admission Number" : "Employee Number"}
                    </Label>
                    <div className="relative group">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                      <Input
                        id="reg-number"
                        type="text"
                        placeholder={`Enter your ${signupRole === "student" ? "student" : "employee"} number`}
                        className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl uppercase"
                        value={registrationNumber}
                        onChange={e => setRegistrationNumber(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <p className="text-[10px] text-white/50 leading-normal">
                      {signupRole === "student"
                        ? "This is your login ID. You will sign in with this number and your password — no personal email."
                        : "Format: SCHOOL-Stu-2026-001 — school is detected from your number"}
                    </p>
                  </div>
                  
                  {signupRole === "student" && (
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-xs font-semibold text-white/80">
                        Gender
                      </Label>
                      <Select value={gender} onValueChange={setGender} required>
                        <SelectTrigger id="gender" className="h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white rounded-xl">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/15 text-white">
                          <SelectItem value="male" className="hover:bg-white/10 text-white focus:bg-white/10 focus:text-white rounded-lg">Male</SelectItem>
                          <SelectItem value="female" className="hover:bg-white/10 text-white focus:bg-white/10 focus:text-white rounded-lg">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {(signupRole === "parent" || signupRole === "admin") && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="signup-phone" className="text-xs font-semibold text-white/80">
                    Phone Number
                  </Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+233..."
                    className="h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-xs font-semibold text-white/80">
                  Confirm Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                  <Input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Parent — admission number links child & school */}
              {signupRole === "parent" && (
                <div className="space-y-4 animate-fade-in border-t border-white/15 pt-4 mt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-white/80">
                      Child&apos;s admission number
                    </Label>
                    <p className="text-[10px] text-white/50 leading-normal mb-2">
                      Enter your child&apos;s admission number — school and class are detected automatically
                    </p>

                    {previewLoading && (
                      <p className="text-[11px] text-white/60">Verifying admission number…</p>
                    )}
                    {childPreview?.valid && (
                      <div className="rounded-xl border border-white/30 bg-white/5 p-4 text-xs space-y-1 animate-fade-in">
                        <p className="font-semibold text-white">{childPreview.student_name}</p>
                        <p className="text-white/60">School: {childPreview.school_name}</p>
                        <p className="text-white/60">Class: {childPreview.class_name}</p>
                        <p className="font-mono text-[10px] text-white/50">{childPreview.admission_number}</p>
                      </div>
                    )}
                    {childPreview && !childPreview.valid && !previewLoading && (
                      <p className="text-xs text-white bg-white/5 border border-white/25 rounded-xl p-3">{childPreview.error}</p>
                    )}
                    
                    {childStudentNumbers.map((num, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="relative flex-1 group">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-green-400 transition-colors" />
                          <Input
                            type="text"
                            placeholder={`Child ${index + 1} student number`}
                            className="pl-10 h-12 border-white/15 focus:border-green-500/50 focus:ring-green-500/20 bg-black/40 text-white placeholder-white/40 rounded-xl uppercase"
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
                            className="h-12 w-12 border-white/15 hover:bg-white/10 text-white/60 hover:text-white rounded-xl shrink-0"
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
                        className="w-full h-11 border-dashed border-white/20 hover:bg-black/60 hover:text-white rounded-xl text-white/60 mt-2 flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Child
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-green-500 hover:bg-green-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 group mt-2"
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