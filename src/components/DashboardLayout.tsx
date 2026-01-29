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
  MonitorPlay,
  MessageSquare,
  Shield,
  Building,
  ChevronDown,
  Hash,
  UserCheck,
  Link as LinkIcon
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { NotificationCenter } from "./NotificationCenter";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useUserRole } from "@/hooks/useUserRole";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "parent" | "student" | "super_admin";
  hideSidebar?: boolean;
}

const DashboardLayout = ({ children, role, hideSidebar = false }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const unreadMessages = useUnreadMessages();
  const { currentSchool } = useSchoolInfo();
  const { role: userRole } = useUserRole();
  const isSuperAdmin = userRole === "super_admin";

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
          label: "Personnel",
          icon: Users,
          items: [
            { icon: Users, label: "Students", path: "/admin/students" },
            { icon: GraduationCap, label: "Teachers", path: "/admin/teachers" },
          ]
        },
        { icon: BookOpen, label: "Classes", path: "/admin/classes" },
        { icon: BookOpen, label: "Subjects", path: "/admin/subjects" },
        { 
          type: "group",
          label: "Registration",
          icon: Hash,
          items: [
            { icon: Hash, label: "Number Generator", path: "/admin/number-generator" },
            { icon: UserCheck, label: "Pending Approvals", path: "/admin/pending-users" },
          ]
        },
        {
          type: "group",
          label: "Linking",
          icon: LinkIcon,
          items: [
            { icon: Users, label: "Parent-Student Link", path: "/admin/parent-student-link" },
            { icon: BookOpen, label: "Teacher-Class Link", path: "/admin/teacher-class-link" },
            { icon: Users, label: "Parent Contacts", path: "/admin/parent-contacts" },
          ]
        },
        { icon: Award, label: "Grade Scales", path: "/admin/grade-scales" },
        { 
          type: "group",
          label: "Payments",
          icon: DollarSign,
          items: [
            { icon: DollarSign, label: "Invoices", path: "/admin/fees" },
            { icon: DollarSign, label: "Fee Structures", path: "/admin/fee-structures" },
          ]
        },
        { icon: Calendar, label: "Attendance", path: "/admin/attendance" },
        { icon: Clock, label: "Timetable", path: "/admin/timetable" },
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
        { icon: Clock, label: "Timetable", path: "/teacher/timetable" },
        { icon: Calendar, label: "Attendance", path: "/teacher/attendance" },
        { icon: FileText, label: "Assignments", path: "/teacher/assignments" },
        { icon: Award, label: "Grades", path: "/teacher/grades" },
        { icon: FileText, label: "Exams", path: "/teacher/exams" },
        { icon: FileText, label: "Question Bank", path: "/teacher/question-bank" },
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
        { icon: Clock, label: "Timetable", path: "/student/timetable" },
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
      {currentSchool?.logo_url && !hideSidebar && (
        <div 
          className="fixed inset-0 pointer-events-none hidden md:block"
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
          } w-64 border-r bg-card lg:bg-primary/5`}
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
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto overflow-x-hidden">
            {config.menuItems.map((item: any, index: number) => {
              if (item.type === "group") {
                const groupKey = `group-${index}`;
                const hasActiveChild = item.items.some((subItem: any) => 
                  location.pathname === subItem.path || location.pathname.startsWith(subItem.path + "/")
                );
                const isOpen = openGroups[groupKey] ?? hasActiveChild;
                
                return (
                  <Collapsible
                    key={groupKey}
                    open={isOpen}
                    onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [groupKey]: open }))}
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-foreground overflow-hidden">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1 ml-4 pl-4 border-l-2 border-primary/20 overflow-hidden">
                      {item.items.map((subItem: any) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm md:text-base text-muted-foreground transition-all hover:bg-primary/10 hover:text-foreground overflow-hidden"
                          activeClassName="bg-primary/20 text-primary font-semibold"
                        >
                          <subItem.icon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                          <span className="flex-1 truncate">{subItem.label}</span>
                        </NavLink>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === `/${role}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm md:text-base text-muted-foreground transition-all hover:bg-primary/10 hover:text-foreground overflow-hidden"
                  activeClassName="bg-primary/20 text-primary font-semibold"
                >
                  <item.icon className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.showBadge && unreadMessages > 0 && (
                    <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center p-0 text-xs flex-shrink-0">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </Badge>
                  )}
                </NavLink>
              );
            })}
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
      )}

      {/* Main Content */}
      <div className={`transition-all ${!hideSidebar && sidebarOpen ? "lg:ml-64" : "lg:ml-0"} relative z-10`}>
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-background/95 backdrop-blur px-3 md:px-6 ${hideSidebar ? "justify-end" : ""}`}>
          {!hideSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-background/80 hover:bg-primary/10 border border-border/50"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </Button>
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
                    {currentSchool.school_code && (
                      <span className="text-xs md:text-sm text-muted-foreground font-medium hidden sm:inline">
                        ({currentSchool.school_code})
                      </span>
                    )}
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
        <main className="p-3 md:p-6 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;