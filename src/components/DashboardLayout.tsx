import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  Menu,
  UserCircle,
  FileText,
  Award,
  Settings,
  Clock,
  Megaphone,
  ClipboardList,
  MonitorPlay,
  MessageSquare,
  Shield,
  Building
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { NotificationCenter } from "./NotificationCenter";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useUserRole } from "@/hooks/useUserRole";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "parent" | "student" | "super_admin";
}

const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const unreadMessages = useUnreadMessages();
  const { currentSchool } = useSchoolInfo();
  const { role: userRole } = useUserRole();
  const isSuperAdmin = userRole === "super_admin";

  const roleConfig = {
    admin: {
      title: "Admin",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
        { icon: Users, label: "Students", path: "/admin/students" },
        { icon: GraduationCap, label: "Teachers", path: "/admin/teachers" },
        { icon: BookOpen, label: "Classes", path: "/admin/classes" },
        { icon: BookOpen, label: "Subjects", path: "/admin/subjects" },
        { icon: Users, label: "Parent-Student Link", path: "/admin/parent-student-link" },
        { icon: BookOpen, label: "Teacher-Class Link", path: "/admin/teacher-class-link" },
        { icon: ClipboardList, label: "Exam Types", path: "/admin/exam-types" },
        { icon: Award, label: "Grade Scales", path: "/admin/grade-scales" },
        { icon: DollarSign, label: "Invoices", path: "/admin/fees" },
        { icon: DollarSign, label: "Fee Structures", path: "/admin/fee-structures" },
        { icon: Calendar, label: "Attendance", path: "/admin/attendance" },
        { icon: Clock, label: "Schedule", path: "/admin/schedule" },
        { icon: FileText, label: "Reports", path: "/admin/reports" },
        { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
        { icon: FileText, label: "Report Cards", path: "/admin/report-cards" },
        { icon: Building, label: "School Settings", path: "/admin/school-settings" },
        ...(isSuperAdmin ? [{ icon: Shield, label: "Super Admin", path: "/admin/super-admin-management" }] : []),
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    },
    teacher: {
      title: "Teacher",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/teacher" },
        { icon: BookOpen, label: "My Classes", path: "/teacher/classes" },
        { icon: Calendar, label: "Attendance", path: "/teacher/attendance" },
        { icon: FileText, label: "Assignments", path: "/teacher/assignments" },
        { icon: Award, label: "Grades", path: "/teacher/grades" },
        { icon: FileText, label: "Exams", path: "/teacher/exams" },
        { icon: ClipboardList, label: "Question Bank", path: "/teacher/question-bank" },
        { icon: MonitorPlay, label: "Online Exams", path: "/teacher/online-exams" },
        { icon: BookOpen, label: "Resources", path: "/teacher/resources" },
        { icon: MessageSquare, label: "Messages", path: "/messages", showBadge: true },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    },
    parent: {
      title: "Parent",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/parent" },
        { icon: UserCircle, label: "My Children", path: "/parent/children" },
        { icon: Calendar, label: "Attendance", path: "/parent/attendance" },
        { icon: Award, label: "Grades", path: "/parent/grades" },
        { icon: DollarSign, label: "Payments", path: "/parent/payments" },
        { icon: MessageSquare, label: "Messages", path: "/messages", showBadge: true },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    },
    student: {
      title: "Student",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/student" },
        { icon: Calendar, label: "Schedule", path: "/student/schedule" },
        { icon: FileText, label: "Assignments", path: "/student/assignments" },
        { icon: Award, label: "Grades", path: "/student/grades" },
        { icon: MonitorPlay, label: "Online Exams", path: "/student/online-exams" },
        { icon: BookOpen, label: "Resources", path: "/student/resources" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    }
  };

  // Map super_admin to admin config
  const effectiveRole = role === "super_admin" ? "admin" : role;
  const config = roleConfig[effectiveRole];

  const handleLogout = async () => {
    await signOut();
  };

  // Guard against invalid or missing role
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Watermark overlay - covers entire viewport behind all content */}
      {currentSchool?.logo_url && (
        <div 
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${currentSchool.logo_url})`,
            backgroundSize: '400px 400px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.15,
            zIndex: 0,
          }}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 z-40 h-screen transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } w-64 border-r bg-card`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <GraduationCap className="h-7 w-7 text-primary" />
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduManage
            </span>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {config.menuItems.map((item: any) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === `/${role}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {item.showBadge && unreadMessages > 0 && (
                  <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User Section */}
          <div className="border-t p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all ${sidebarOpen ? "ml-64" : "ml-0"} relative z-10`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 flex items-center gap-4">
            {isSuperAdmin ? (
              <SchoolSwitcher />
            ) : currentSchool ? (
              <>
                {currentSchool.logo_url && (
                  <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
                    <AvatarImage src={currentSchool.logo_url} alt={currentSchool.school_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-bold text-sm">
                      {currentSchool.school_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{currentSchool.school_name}</h1>
                  {currentSchool.school_code && (
                    <span className="text-sm text-muted-foreground font-medium">
                      ({currentSchool.school_code})
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">-</span>
                <h2 className="text-lg font-semibold">
                  {role === "admin" || role === "super_admin" ? "Admin" : config.title}
                </h2>
              </>
            ) : (
              <h2 className="text-lg font-semibold">
                {role === "admin" || role === "super_admin" ? "Admin" : config.title}
              </h2>
            )}
          </div>

          <div className="ml-auto">
            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;