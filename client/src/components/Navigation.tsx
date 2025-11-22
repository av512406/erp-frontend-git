import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  DollarSign,
  FileText,
  BookOpen,
  Database,
  Library,
  LogOut,
  Settings,
  UserX
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';

interface NavigationProps {
  userRole: 'admin' | 'teacher';
  userEmail: string;
  onLogout: () => void;
}

export default function Navigation({ userRole, userEmail, onLogout }: NavigationProps) {
  const [location] = useLocation();
  // Fetch school config globally so logo/phone persist across reloads
  const { config } = useSchoolConfig();

  // Core admin links (Students & Withdrawn consolidated into dropdown; Settings & Subjects in another)
  const adminLinks = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/fees", label: "Fees", icon: DollarSign },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/grades", label: "Grades", icon: BookOpen },
    { path: "/data-tools", label: "Data Tools", icon: Database },
  ];

  const teacherLinks = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/grades", label: "Grades", icon: BookOpen },
  ];

  const links = userRole === 'admin' ? adminLinks : teacherLinks;

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 hover-elevate rounded-md px-3 py-2">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded" />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
              <span className="font-semibold text-lg truncate max-w-[200px]" title={config.name}>{config.name || 'School ERP'}</span>
            </Link>
            
            <div className="flex items-center gap-1">
              {/* Dashboard always first */}
              {links.filter(l => l.path === '/').map(link => {
                const Icon = link.icon;
                const isActive = location === link.path;
                return (
                  <Link key={link.path} href={link.path}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                      data-testid={`link-${link.label.toLowerCase()}`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              {userRole === 'admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={["/students","/students-withdrawn"].includes(location) ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                      data-testid="link-students-dropdown"
                    >
                      <Users className="w-4 h-4" />
                      Students
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link href="/students" className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> Enrolled
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/students-withdrawn" className="flex items-center gap-2">
                        <UserX className="w-4 h-4" /> Withdrawn
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Remaining links (excluding Dashboard) */}
              {links.filter(l => l.path !== '/').map(link => {
                const Icon = link.icon;
                const isActive = location === link.path;
                return (
                  <Link key={link.path} href={link.path}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                      data-testid={`link-${link.label.toLowerCase()}`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              {userRole === 'admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={["/admin-settings","/subjects"].includes(location) ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                      data-testid="link-settings-dropdown"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link href="/admin-settings" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" /> School Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/subjects" className="flex items-center gap-2">
                        <Library className="w-4 h-4" /> Subjects
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Phone number hidden as per requirement */}
            <div className="text-sm">
              <p className="font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
