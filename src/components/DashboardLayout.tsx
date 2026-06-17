// @ts-nocheck
import { ReactNode, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  DollarSign,
  LogOut,
  PanelLeft,
  PanelRight,
  Copy,
  Check,
  UserCircle,
  FileText,
  Award,
  Settings,
  Clock,
  Megaphone,
  MonitorPlay,
  MessageSquare,
  Shield,
  Building,
  Hash,
  UserCheck,
  Link as LinkIcon,
  ClipboardList,
  BarChart3,
  Wallet,
  UserCog,
  PenLine,
  CreditCard,
  Palette,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { NotificationCenter } from "./NotificationCenter";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuGroup } from "@/components/SidebarMenuGroup";
import { DynamicAdminSidebarNav } from "@/components/layout/DynamicAdminSidebarNav";
import { ensurePaymentGatewaysInNav, ensureClassTeacherActivityInNav } from "@/lib/rbac/adminNavConfig";
import { usePortalAccess } from "@/hooks/usePortalAccess";
import { ADMIN_SHELL_ROLES } from "@/lib/rbac/routeGuards";
import { toast } from "sonner";
import { ParentAdmissionNav } from "@/components/parent/ParentAdmissionNav";
import SubscriptionExpiryBanner from "@/subscription/components/SubscriptionExpiryBanner";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { PortalSidebarSearch } from "@/components/PortalSidebarSearch";
import { useTheme } from "@/contexts/ThemeContext";
import {
  PORTAL_ROLE_META,
  portalNavLinkActive,
  portalNavLinkBase,
  portalNavSubLinkBase,
} from "@/lib/portalNavStyles";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";

const SIDEBAR_WIDTH_KEY = "portal-sidebar-width";
const SIDEBAR_OPEN_KEY = "portal-sidebar-open";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 280;

function readSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
  if (saved !== null) return saved === "true";
  return window.innerWidth >= 1024;
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT;
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const n = saved ? parseInt(saved, 10) : SIDEBAR_DEFAULT;
  if (!Number.isFinite(n)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

type MenuLinkDef = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  permission?: string;
  showBadge?: boolean;
};

type MenuItemDef =
  | MenuLinkDef
  | { type: "group"; label: string; icon: typeof Users; items: MenuLinkDef[] };

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "parent" | "student" | "super_admin" | "accountant" | "auditor";
  hideSidebar?: boolean;
}

function navMatchesQuery(label: string, query: string) {
  return label.toLowerCase().includes(query);
}

function filterStaticMenu(items: MenuItemDef[], query: string): MenuItemDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items
    .map((item) => {
      if (item.type === "group") {
        const childMatches = item.items.filter((sub) => navMatchesQuery(sub.label, q));
        if (childMatches.length) return { ...item, items: childMatches };
        if (navMatchesQuery(item.label, q)) return item;
        return null;
      }
      return navMatchesQuery(item.label, q) ? item : null;
    })
    .filter(Boolean) as MenuItemDef[];
}

function filterDynamicNav(items: (AdminNavItem | AdminNavGroup)[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items
    .map((item) => {
      if ("items" in item) {
        const childMatches = item.items.filter((sub) => navMatchesQuery(sub.label, q));
        if (childMatches.length) return { ...item, items: childMatches };
        if (navMatchesQuery(item.label, q)) return item;
        return null;
      }
      return navMatchesQuery(item.label, q) ? item : null;
    })
    .filter(Boolean) as (AdminNavItem | AdminNavGroup)[];
}

const DashboardLayout = ({ children, role, hideSidebar = false }: DashboardLayoutProps) => {
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [navQuery, setNavQuery] = useState("");
  const [schoolCodeCopied, setSchoolCodeCopied] = useState(false);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const unreadMessages = useUnreadMessages();
  const { currentSchool } = useSchoolInfo();
  const { role: userRole } = useUserRole();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();
  const isSuperAdmin = userRole === "super_admin" || isSuperAdminPerm;
  const { navItems: dynamicNavItems } = usePortalAccess();
  const { access: subscriptionAccess } = useOrganizationSubscription();
  const { resetPersonalTheme } = useTheme();
  const usesDynamicAdminNav = (ADMIN_SHELL_ROLES as readonly string[]).includes(role);

  const canShow = (permission?: string) =>
    !permission || isSuperAdmin || hasPermission(permission);

  const filterMenu = (items: MenuItemDef[]): MenuItemDef[] =>
    items
      .map((item) => {
        if (item.type === "group") {
          const filtered = item.items.filter((sub) => canShow(sub.permission));
          return filtered.length ? { ...item, items: filtered } : null;
        }
        return canShow(item.permission) ? item : null;
      })
      .filter(Boolean) as MenuItemDef[];

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      const next = !open;
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  }, []);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      sidebarResizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = event.clientX - sidebarResizeRef.current.startX;
      const next = Math.min(
        SIDEBAR_MAX,
        Math.max(SIDEBAR_MIN, sidebarResizeRef.current.startWidth + delta),
      );
      setSidebarWidth(next);
    };

    const onUp = () => {
      if (!sidebarResizeRef.current) return;
      sidebarResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((width) => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        return width;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const roleConfig = {
    admin: {
      title: "Admin",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: Users, label: "Students", path: "/admin/students" },
            { icon: GraduationCap, label: "Teachers", path: "/admin/teachers" },
            { icon: BookOpen, label: "Classes", path: "/admin/classes" },
            { icon: ClipboardList, label: "Subjects", path: "/admin/subjects" },
            { icon: Clock, label: "Timetable", path: "/admin/timetable" },
            { icon: FileText, label: "Lesson Notes", path: "/admin/lesson-notes" },
            { icon: Award, label: "Grade Scales", path: "/admin/grade-scales" },
          ],
        },
        {
          type: "group",
          label: "Examinations & Results",
          icon: FileText,
          items: [
            { icon: FileText, label: "Report Cards", path: "/admin/report-cards" },
            { icon: FileText, label: "Report Archive", path: "/admin/report-cards/archive" },
            { icon: BarChart3, label: "Reports", path: "/admin/reports" },
            { icon: Settings, label: "Report Settings", path: "/admin/report-settings" },
          ],
        },
        {
          type: "group",
          label: "Attendance",
          icon: Calendar,
          items: [
            { icon: ClipboardList, label: "Class Registers", path: "/admin/register" },
            { icon: Calendar, label: "Student Attendance", path: "/admin/attendance" },
          ],
        },
        {
          type: "group",
          label: "Financial Management",
          icon: DollarSign,
          items: [
            { icon: LayoutDashboard, label: "Billing overview", path: "/admin/billing" },
            { icon: Wallet, label: "Fees", path: "/admin/billing/fees" },
            { icon: DollarSign, label: "Invoices", path: "/admin/billing/invoices" },
            { icon: FileText, label: "Payments", path: "/admin/billing/payments" },
            { icon: CreditCard, label: "Payment gateways", path: "/admin/billing/settings/payments" },
            { icon: Users, label: "Paid Students", path: "/admin/billing/paid-students" },
            { icon: Users, label: "Outstanding", path: "/admin/billing/outstanding" },
            { icon: BarChart3, label: "Reports", path: "/admin/billing/reports" },
            { icon: Users, label: "Family Billing", path: "/admin/billing/family" },
            { icon: Wallet, label: "Payroll", path: "/admin/billing/payroll" },
            { icon: Settings, label: "Billing settings", path: "/admin/billing/settings" },
          ],
        },
        {
          type: "group",
          label: "Registration & Linking",
          icon: LinkIcon,
          items: [
            { icon: Hash, label: "Number Generator", path: "/admin/number-generator" },
            { icon: UserCheck, label: "Pending Approvals", path: "/admin/pending-users" },
            { icon: Users, label: "Parent–Student Link", path: "/admin/parent-student-link" },
            { icon: BookOpen, label: "Teacher–Class Link", path: "/admin/teacher-class-link" },
            { icon: UserCircle, label: "Parent Contacts", path: "/admin/parent-contacts" },
          ],
        },
        {
          type: "group",
          label: "Communication",
          icon: Megaphone,
          items: [{ icon: Megaphone, label: "Announcements", path: "/admin/announcements" }],
        },
        {
          type: "group",
          label: "Administration",
          icon: UserCog,
          items: [
            { icon: Building, label: "School Settings", path: "/admin/school-settings" },
            { icon: Shield, label: "Permission Management", path: "/admin/roles", permission: "portal.staff_access.view" },
            { icon: FileText, label: "Approvals", path: "/admin/approvals", permission: PERMISSIONS.admin.approveRequests },
            { icon: FileText, label: "Audit Logs", path: "/admin/audit-logs", permission: PERMISSIONS.admin.viewAudit },
            { icon: Shield, label: "Student Password Recovery", path: "/admin/student-password-recovery" },
            ...(isSuperAdmin
              ? [
                  { icon: Building, label: "Platform Control", path: "/platform" },
                  { icon: Shield, label: "Super Admin", path: "/admin/super-admin-management" },
                  { icon: BarChart3, label: "Report Monitor", path: "/super-admin/reports" },
                ]
              : []),
            { icon: Settings, label: "Account Settings", path: "/settings" },
          ],
        },
      ] as MenuItemDef[],
    },
    accountant: {
      title: "Accountant",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/accountant" },
        {
          type: "group",
          label: "Billing",
          icon: DollarSign,
          items: [
            { icon: LayoutDashboard, label: "Billing overview", path: "/admin/billing", permission: PERMISSIONS.invoices.view },
            { icon: Wallet, label: "Fees", path: "/admin/billing/fees", permission: PERMISSIONS.billing.feeTemplates },
            { icon: DollarSign, label: "Invoices", path: "/admin/billing/invoices", permission: PERMISSIONS.invoices.view },
            { icon: FileText, label: "Payments", path: "/admin/billing/payments", permission: PERMISSIONS.payments.view },
            { icon: CreditCard, label: "Payment gateways", path: "/admin/billing/settings/payments", permission: PERMISSIONS.payments.view },
            { icon: Users, label: "Paid Students", path: "/admin/billing/paid-students", permission: PERMISSIONS.fees.viewStatus },
            { icon: Users, label: "Outstanding", path: "/admin/billing/outstanding", permission: PERMISSIONS.invoices.view },
            { icon: BarChart3, label: "Reports", path: "/admin/billing/reports", permission: PERMISSIONS.reports.viewFinancial },
            { icon: Users, label: "Family Billing", path: "/admin/billing/family" },
            { icon: Wallet, label: "Payroll", path: "/admin/billing/payroll", permission: PERMISSIONS.payroll.view },
          ],
        },
        {
          type: "group",
          label: "Reports",
          icon: BarChart3,
          items: [
            {
              icon: BarChart3,
              label: "Financial Reports",
              path: "/admin/billing/reports",
              permission: PERMISSIONS.reports.viewFinancial,
            },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
      ] as MenuItemDef[],
    },
    auditor: {
      title: "Auditor",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/auditor" },
        {
          type: "group",
          label: "Finance",
          icon: DollarSign,
          items: [
            { icon: DollarSign, label: "Invoices", path: "/admin/billing/invoices", permission: PERMISSIONS.invoices.view },
            { icon: BarChart3, label: "Billing Reports", path: "/admin/billing/reports", permission: PERMISSIONS.reports.viewFinancial },
            {
              icon: BarChart3,
              label: "Academic Reports",
              path: "/admin/reports",
              permission: PERMISSIONS.reports.viewAcademic,
            },
            {
              icon: FileText,
              label: "Audit Logs",
              path: "/admin/audit-logs",
              permission: PERMISSIONS.admin.viewAudit,
            },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
      ] as MenuItemDef[],
    },
    teacher: {
      title: "Teacher",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/teacher" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: BookOpen, label: "My Classes", path: "/teacher/classes" },
            { icon: UserCheck, label: "My Class (Class Teacher)", path: "/teacher/my-class" },
            { icon: Clock, label: "Timetable", path: "/teacher/timetable" },
            { icon: ClipboardList, label: "Class Registers", path: "/teacher/register" },
            { icon: Calendar, label: "Attendance", path: "/teacher/attendance" },
            { icon: FileText, label: "Assignments", path: "/teacher/assignments" },
            { icon: Award, label: "Grades", path: "/teacher/grades" },
            { icon: FileText, label: "Enter Scores", path: "/teacher/scores" },
            { icon: FileText, label: "Report Cards", path: "/teacher/report-cards" },
            { icon: PenLine, label: "Signatures", path: "/teacher/signatures" },
            { icon: BookOpen, label: "Resources", path: "/teacher/resources" },
            { icon: FileText, label: "Lesson notes", path: "/teacher/lesson-notes" },
          ],
        },
        {
          type: "group",
          label: "Examinations",
          icon: MonitorPlay,
          items: [
            { icon: FileText, label: "Exams", path: "/teacher/exams" },
            { icon: ClipboardList, label: "Question Bank", path: "/teacher/question-bank" },
            { icon: MonitorPlay, label: "Online Exams", path: "/teacher/online-exams" },
          ],
        },
        {
          type: "group",
          label: "Communication",
          icon: MessageSquare,
          items: [
            { icon: MessageSquare, label: "Messages", path: "/messages", showBadge: true },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
      ] as MenuItemDef[],
    },
    parent: {
      title: "Parent",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/parent" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: UserCircle, label: "My Children", path: "/parent/children" },
            { icon: ClipboardList, label: "Class Registers", path: "/parent/register" },
            { icon: Calendar, label: "Attendance", path: "/parent/attendance" },
            { icon: Award, label: "Grades", path: "/parent/grades" },
            { icon: FileText, label: "Report Cards", path: "/parent/reports" },
            { icon: MessageSquare, label: "Recommendations", path: "/parent/recommendations" },
            { icon: Clock, label: "Timetable", path: "/parent/timetable" },
          ],
        },
        {
          type: "group",
          label: "Finance",
          icon: DollarSign,
          items: [
            { icon: DollarSign, label: "School fees", path: "/parent/payments" },
            { icon: FileText, label: "Payment history", path: "/parent/payment-history" },
          ],
        },
        {
          type: "group",
          label: "Communication",
          icon: MessageSquare,
          items: [
            { icon: MessageSquare, label: "Messages", path: "/messages", showBadge: true },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
      ] as MenuItemDef[],
    },
    student: {
      title: "Student",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/student" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: Clock, label: "Timetable", path: "/student/timetable" },
            { icon: ClipboardList, label: "Class Register", path: "/student/register" },
            { icon: FileText, label: "Assignments", path: "/student/assignments" },
            { icon: Award, label: "Grades", path: "/student/grades" },
            { icon: Award, label: "Performance", path: "/student/performance" },
            { icon: FileText, label: "Report Card", path: "/student/report-card" },
            { icon: BookOpen, label: "Resources", path: "/student/resources" },
          ],
        },
        {
          type: "group",
          label: "Examinations",
          icon: MonitorPlay,
          items: [{ icon: MonitorPlay, label: "Online Exams", path: "/student/online-exams" }],
        },
        {
          type: "group",
          label: "Finance",
          icon: DollarSign,
          items: [
            { icon: DollarSign, label: "My fees", path: "/student/billing" },
            { icon: FileText, label: "Payment history", path: "/student/payment-history" },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
      ] as MenuItemDef[],
    },
  };

  const shellTitles: Record<string, string> = {
    admin: "Admin",
    super_admin: "Admin",
    accountant: "Accountant",
    auditor: "Auditor",
  };

  // Map super_admin to admin config for shared admin shell
  const effectiveRole = role === "super_admin" ? "admin" : role;
  const baseConfig = roleConfig[effectiveRole] ?? roleConfig[role];
  const config = usesDynamicAdminNav
    ? { title: shellTitles[role] ?? "Portal", menuItems: [] as MenuItemDef[] }
    : baseConfig
      ? { ...baseConfig, menuItems: filterMenu(baseConfig.menuItems as MenuItemDef[]) }
      : undefined;

  const roleMeta = PORTAL_ROLE_META[role] ?? PORTAL_ROLE_META.admin;
  const filteredDynamicNav = useMemo(
    () =>
      filterDynamicNav(
        ensureClassTeacherActivityInNav(ensurePaymentGatewaysInNav(dynamicNavItems)),
        navQuery,
      ),
    [dynamicNavItems, navQuery],
  );
  const filteredStaticMenu = useMemo(
    () => (config?.menuItems ? filterStaticMenu(config.menuItems, navQuery) : []),
    [config?.menuItems, navQuery],
  );

  const handleLogout = async () => {
    await signOut();
  };

  const handleCopySchoolCode = async () => {
    const code = currentSchool?.school_code?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setSchoolCodeCopied(true);
      toast.success("School code copied");
      window.setTimeout(() => setSchoolCodeCopied(false), 2000);
    } catch {
      toast.error("Could not copy school code");
    }
  };

  /** Sidebar nav — shared portal design tokens */
  const navLinkBase = portalNavLinkBase;
  const navLinkActive = portalNavLinkActive;
  const navSubLinkBase = portalNavSubLinkBase;

  // Guard against invalid or missing role
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex h-screen max-h-screen w-full overflow-hidden bg-background", roleMeta.accentClass)}
      data-portal-layout
      data-portal-role={role}
      style={{ "--portal-sidebar-width": `${sidebarWidth}px` }}
    >
      {/* Sidebar — fixed height; nav scrolls inside sidebar only */}
      {!hideSidebar && (
        <aside
          className={cn(
            "flex h-full max-h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
            !sidebarOpen && "w-0 border-r-0",
          )}
          style={sidebarOpen ? { width: sidebarWidth } : undefined}
          aria-hidden={!sidebarOpen}
        >
          <div className="flex h-full min-h-0 flex-col" style={{ width: sidebarWidth }}>
            {/* Brand + role */}
            <div className="portal-sidebar-brand flex flex-col gap-3 border-b border-sidebar-border px-4 py-4">
            <div className="flex items-center gap-3">
              {currentSchool?.logo_url ? (
                <Avatar className="h-10 w-10 border border-sidebar-border">
                  <AvatarImage src={currentSchool.logo_url} alt={currentSchool.school_name} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-semibold">
                    {currentSchool.school_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-sidebar-foreground">
                  {currentSchool?.school_name ?? "EduManage"}
                </p>
                <p className="text-xs text-sidebar-foreground/65">School portal</p>
              </div>
            </div>
            <span className="portal-role-badge inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
              {roleMeta.label}
            </span>
          </div>

          <PortalSidebarSearch value={navQuery} onChange={setNavQuery} />

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1 custom-scrollbar">
            {usesDynamicAdminNav ? (
              <DynamicAdminSidebarNav
                items={filteredDynamicNav}
                unreadMessages={unreadMessages}
                navLinkBase={navLinkBase}
                navLinkActive={navLinkActive}
                navSubLinkBase={navSubLinkBase}
                emptyMessage={
                  navQuery.trim()
                    ? "No menu items match your search."
                    : "No modules assigned. Contact your administrator."
                }
              />
            ) : (
              filteredStaticMenu.map((item: MenuItemDef, index: number) => {
                if (item.type === "group") {
                  return (
                    <SidebarMenuGroup
                      key={`group-${index}-${item.label}`}
                      label={item.label}
                      icon={item.icon}
                      items={item.items}
                      unreadMessages={unreadMessages}
                      navSubLinkBase={navSubLinkBase}
                      navLinkActive={navLinkActive}
                    />
                  );
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === `/${role}`}
                    className={navLinkBase}
                    activeClassName={navLinkActive}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/70" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.showBadge && unreadMessages > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-5 min-w-5 px-1 flex items-center justify-center text-[10px] flex-shrink-0"
                      >
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </Badge>
                    )}
                  </NavLink>
                );
              })
            )}
            {!usesDynamicAdminNav && filteredStaticMenu.length === 0 && navQuery.trim() ? (
              <p className="px-3 py-6 text-center text-xs text-sidebar-foreground/60">No menu items match your search.</p>
            ) : null}
          </nav>

          {/* Sidebar footer */}
          <div className="border-t border-sidebar-border px-2 py-3 space-y-1">
            {role === "parent" && <ParentAdmissionNav variant="sidebar" />}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/90 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out
            </button>
          </div>
          </div>

          {/* Drag handle to resize sidebar */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            title="Drag to resize sidebar"
            onMouseDown={handleResizeStart}
            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-sidebar-border active:bg-sidebar-border/80"
          />
        </aside>
      )}

      {/* Main content — only this column scrolls vertically */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Top Bar */}
        <header className={`z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/95 backdrop-blur-md px-3 shadow-sm md:h-16 md:gap-4 md:px-6 ${hideSidebar ? "justify-end" : ""}`}>
          {!hideSidebar && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted border border-border/60"
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {sidebarOpen ? (
                  <PanelRight className="h-[18px] w-[18px] text-foreground/80" />
                ) : (
                  <PanelLeft className="h-[18px] w-[18px] text-foreground/80" />
                )}
              </Button>
              {role === "parent" && <ParentAdmissionNav variant="header" />}
              {currentSchool?.school_code && role !== "student" && role !== "parent" && (
                <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 pl-2.5 pr-0.5 h-9">
                  <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                    Code
                  </span>
                  <span className="text-xs font-mono font-semibold text-foreground px-1 sm:px-1.5 max-w-[100px] truncate sm:max-w-none">
                    {currentSchool.school_code}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 hover:bg-background/80"
                    onClick={handleCopySchoolCode}
                    aria-label="Copy school code"
                    title="Copy school code"
                  >
                    {schoolCodeCopied ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {!hideSidebar && (
            <div className="flex-1 flex items-center gap-2 md:gap-3 min-w-0">
              {isSuperAdmin ? (
                <SchoolSwitcher />
              ) : currentSchool ? (
                <>
                  <div className="hidden sm:flex min-w-0 flex-col">
                    <h1 className="truncate text-base font-bold md:text-lg">{currentSchool.school_name}</h1>
                    <p className="truncate text-xs text-muted-foreground md:text-sm">{roleMeta.label}</p>
                  </div>
                </>
              ) : (
                <div className="min-w-0">
                  <h2 className="text-sm font-bold md:text-lg">{config.title}</h2>
                  <p className="text-xs text-muted-foreground">{roleMeta.label}</p>
                </div>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                resetPersonalTheme();
                toast.success("Default black & white theme applied");
              }}
              title="Reset to default black & white theme"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Theme</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 md:h-10 md:w-10"
              title="Sign out"
            >
              <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main className="portal-main-scroll relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background p-3 md:p-6 lg:p-8">
          {role === "admin" && subscriptionAccess?.can_use_platform ? (
            <SubscriptionExpiryBanner access={subscriptionAccess} />
          ) : null}
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;