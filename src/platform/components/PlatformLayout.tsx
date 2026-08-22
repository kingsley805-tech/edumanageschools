import { type ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Package,
  CreditCard,
  MessageSquare,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  School,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/platform", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/platform/tenants", label: "Tenants", icon: Building2 },
  { to: "/platform/plans", label: "Plans", icon: Package },
  { to: "/platform/payment-gateway", label: "Billing", icon: CreditCard },
  { to: "/platform/sms", label: "SMS", icon: MessageSquare },
  { to: "/platform/team", label: "Team", icon: Users },
  { to: "/platform/reports", label: "Reports", icon: FileText },
] as const;

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
};

export default function PlatformLayout({ children, title, description, actions }: Props) {
  const { signOut, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/platform-admin/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const SidebarNav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={"end" in item ? item.end : false}
          className={navLinkClass}
          onClick={() => setMobileOpen(false)}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
      <div className="mt-auto space-y-1 border-t border-border pt-4">
        <Link
          to="/admin"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <School className="h-4 w-4 shrink-0" />
          Open school admin
        </Link>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border px-4 py-4">
          <Link to="/platform" className="block">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Platform</p>
            <p className="truncate text-sm font-semibold text-foreground">Control Center</p>
          </Link>
        </div>
        {SidebarNav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Platform</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {SidebarNav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            {title ? (
              <div>
                <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
                {description ? (
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Platform owner</p>
            )}
          </div>
          {actions}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:inline">
            {user?.email}
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
