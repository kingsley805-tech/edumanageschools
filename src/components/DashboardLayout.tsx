import { ReactNode } from "react";
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
  Megaphone
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { NotificationCenter } from "./NotificationCenter";
import { useState } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "parent" | "student";
}

const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const roleConfig = {
    admin: {
      title: "Admin Dashboard",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
        { icon: Users, label: "Students", path: "/admin/students" },
        { icon: GraduationCap, label: "Teachers", path: "/admin/teachers" },
        { icon: BookOpen, label: "Classes", path: "/admin/classes" },
        { icon: DollarSign, label: "Invoices", path: "/admin/fees" },
        { icon: DollarSign, label: "Fee Structures", path: "/admin/fee-structures" },
        { icon: Calendar, label: "Attendance", path: "/admin/attendance" },
        { icon: Clock, label: "Schedule", path: "/admin/schedule" },
        { icon: FileText, label: "Reports", path: "/admin/reports" },
        { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
        { icon: FileText, label: "Report Cards", path: "/admin/report-cards" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    },
    teacher: {
      title: "Teacher Portal",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/teacher" },
        { icon: BookOpen, label: "My Classes", path: "/teacher/classes" },
        { icon: Calendar, label: "Attendance", path: "/teacher/attendance" },
        { icon: FileText, label: "Assignments", path: "/teacher/assignments" },
        { icon: Award, label: "Grades", path: "/teacher/grades" },
        { icon: FileText, label: "Exams", path: "/teacher/exams" },
        { icon: BookOpen, label: "Resources", path: "/teacher/resources" },
        { icon: UserCircle, label: "Messages", path: "/messages" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    },
    parent: {
      title: "Parent Portal",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/parent" },
        { icon: UserCircle, label: "My Children", path: "/parent/children" },
        { icon: Calendar, label: "Attendance", path: "/parent/attendance" },
        { icon: Award, label: "Grades", path: "/parent/grades" },
        { icon: DollarSign, label: "Payments", path: "/parent/payments" },
        { icon: UserCircle, label: "Messages", path: "/messages" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    },
    student: {
      title: "Student Portal",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/student" },
        { icon: Calendar, label: "Schedule", path: "/student/schedule" },
        { icon: FileText, label: "Assignments", path: "/student/assignments" },
        { icon: Award, label: "Grades", path: "/student/grades" },
        { icon: BookOpen, label: "Resources", path: "/student/resources" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    }
  };

  const config = roleConfig[role];

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
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
            {config.menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === `/${role}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <item.icon className="h-5 w-5" />
                {item.label}
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
      <div className={`transition-all ${sidebarOpen ? "ml-64" : "ml-0"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{config.title}</h1>
          </div>

          <NotificationCenter />
          
          <div className="flex items-center gap-2 text-sm">
            <UserCircle className="h-5 w-5" />
            <span className="hidden md:inline">{user?.email}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;