// @ts-nocheck
import { ReactNode, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { ensurePaymentGatewaysInNav } from "@/lib/rbac/adminNavConfig";
import { usePortalAccess } from "@/hooks/usePortalAccess";
import { ADMIN_SHELL_ROLES } from "@/lib/rbac/routeGuards";
import { toast } from "sonner";
import { ParentAdmissionNav } from "@/components/parent/ParentAdmissionNav";

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

const DashboardLayout = ({ children, role, hideSidebar = false }: DashboardLayoutProps) => {
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile
  const [schoolCodeCopied, setSchoolCodeCopied] = useState(false);
  const unreadMessages = useUnreadMessages();
  const { currentSchool } = useSchoolInfo();
  const { role: userRole } = useUserRole();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();
  const isSuperAdmin = userRole === "super_admin" || isSuperAdminPerm;
  const { navItems: dynamicNavItems } = usePortalAccess();
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

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // On desktop, keep sidebar state as is (don't auto-open/close)
        // User can toggle with hamburger menu
      } else {
        // On mobile, close sidebar when resizing to mobile
        setSidebarOpen(false);
      }
    };
    
    // Set initial state: open on desktop, closed on mobile
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
            ...(isSuperAdmin
              ? [
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

  /** Flat sidebar nav — no pill backgrounds */
  const navLinkBase =
    "group flex items-center gap-3 border-l-2 border-transparent py-2.5 pl-3 pr-2 text-sm text-sidebar-foreground/85 transition-colors hover:text-sidebar-foreground";
  const navLinkActive =
    "border-[hsl(var(--sidebar-primary))] text-sidebar-foreground font-medium !bg-transparent";
  const navSubLinkBase =
    "group flex items-center gap-2.5 border-l-2 border-transparent py-2 pl-8 pr-2 text-sm text-sidebar-foreground/85 transition-colors hover:text-sidebar-foreground";
  // Guard against invalid or missing role
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative" data-portal-layout>
      {/* Mobile overlay */}
      {sidebarOpen && !hideSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - hidden when hideSidebar is true */}
      {!hideSidebar && (
        <aside 
          className={`fixed left-0 top-0 z-40 h-screen transition-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } w-64 border-r bg-sidebar text-sidebar-foreground border-sidebar-border`}
        >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
            <GraduationCap className="h-6 w-6 text-[hsl(var(--sidebar-primary))]" />
            <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
              EduManage
            </span>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {usesDynamicAdminNav ? (
              <DynamicAdminSidebarNav
                items={ensurePaymentGatewaysInNav(dynamicNavItems)}
                unreadMessages={unreadMessages}
                navLinkBase={navLinkBase}
                navLinkActive={navLinkActive}
                navSubLinkBase={navSubLinkBase}
              />
            ) : (
              config.menuItems.map((item: MenuItemDef, index: number) => {
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
                    <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-70 group-hover:opacity-100" />
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
          </nav>

          {/* User Section */}
          <div className="border-t border-sidebar-border px-2 py-3">
            {role === "parent" && <ParentAdmissionNav variant="sidebar" />}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Logout
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <div
        className={`transition-all bg-background ${!hideSidebar && sidebarOpen ? "lg:ml-64" : "lg:ml-0"} relative z-10`}
      >
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-background/95 backdrop-blur px-3 md:px-6 ${hideSidebar ? "justify-end" : ""}`}>
          {!hideSidebar && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted border border-border/60"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
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
            <div className="flex-1 flex items-center gap-2 md:gap-4 min-w-0">
              {isSuperAdmin ? (
                <SchoolSwitcher />
              ) : currentSchool ? (
                <>
                  {currentSchool.logo_url && (
                    <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-primary/20 shadow-sm flex-shrink-0">
                      <AvatarImage src={currentSchool.logo_url} alt={currentSchool.school_name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-bold text-xs md:text-sm">
                        {currentSchool.school_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex items-center gap-1 md:gap-2 min-w-0">
                    <h1 className="text-base md:text-xl font-bold truncate">{currentSchool.school_name}</h1>
                  </div>
                  <span className="text-muted-foreground hidden sm:inline">-</span>
                  <h2 className="text-sm md:text-lg font-semibold hidden sm:block">
                    {role === "admin" || role === "super_admin" ? "Admin" : config.title}
                  </h2>
                </>
              ) : (
                <h2 className="text-sm md:text-lg font-semibold">
                  {role === "admin" || role === "super_admin" ? "Admin" : config.title}
                </h2>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 md:h-10 md:w-10"
              title="Logout"
            >
              <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 md:p-6 relative z-10 bg-background min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;