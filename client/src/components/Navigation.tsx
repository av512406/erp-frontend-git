import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  UserX,
  Menu
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle
} from "@/components/ui/sheet";
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { useState } from "react";
import { SchoolLogo } from "@/components/ui/SchoolLogo";

interface NavigationProps {
  userRole: 'admin' | 'teacher' | 'superadmin' | 'accountant' | string;
  userEmail: string;
  onLogout: () => void;
  sessions?: { id: string; name: string }[];
  selectedSessionId?: string;
  onSessionChange?: (id: string) => void;
}

export default function Navigation({ userRole, userEmail, onLogout, sessions = [], selectedSessionId, onSessionChange }: NavigationProps) {
  const [location] = useLocation();
  const { config } = useSchoolConfig();
  const [isOpen, setIsOpen] = useState(false);

  // Core admin links
  const adminLinks = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/fees", label: "Fees", icon: DollarSign },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/grades", label: "Grades", icon: BookOpen },
    { path: "/data-tools", label: "Data Tools", icon: Database },
  ];

  if (config.features?.attendance) {
    adminLinks.splice(1, 0, { path: "/attendance", label: "Attendance", icon: Users });
  }




  const teacherLinks = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/grades", label: "Grades", icon: BookOpen },
  ];

  const superAdminLinks = [
    { path: "/super-admin", label: "Super Admin", icon: LayoutDashboard },
    { path: "/", label: "School Dashboard", icon: LayoutDashboard },
  ];

  const accountantLinks = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/fees", label: "Fees", icon: DollarSign },
  ];

  const links = userRole === 'teacher' ? teacherLinks :
    (userRole === 'accountant' ? accountantLinks :
      (userRole === 'superadmin' ? superAdminLinks : adminLinks));

  const NavLink = ({ link, mobile = false }: { link: any, mobile?: boolean }) => {
    const Icon = link.icon;
    const isActive = location === link.path;
    return (
      <Link href={link.path} onClick={() => mobile && setIsOpen(false)}>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          size={mobile ? "default" : "sm"}
          className={`gap-2 justify-start ${mobile ? 'w-full' : ''}`}
          data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
        >
          <Icon className="w-4 h-4" />
          {link.label}
        </Button>
      </Link>
    );
  };

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 whitespace-nowrap">

          {/* Mobile Menu Trigger */}
          <div className="md:hidden flex items-center">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
                <SheetTitle className="text-left mb-4 flex items-center gap-2">
                  <SchoolLogo url={config.logoUrl} name={config.name} className="h-8 w-8" fallbackClassName="w-8 h-8" />
                  <span className="font-bold truncate">
                    {userRole === 'superadmin' ? 'School ERP' : (config.name || 'School ERP')}
                  </span>
                </SheetTitle>
                <div className="flex flex-col gap-2 mt-4">
                  {/* Dashboard & Main Links */}
                  {links.filter(l => l.path === '/' || l.path === '/super-admin').map(link => (
                    <NavLink key={link.path} link={link} mobile />
                  ))}

                  {(userRole === 'admin' || userRole === 'superadmin') && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground mt-4 mb-2 px-2">Students</div>
                      <NavLink link={{ path: "/students", label: "Enrolled", icon: Users }} mobile />
                      <NavLink link={{ path: "/students-withdrawn", label: "Withdrawn", icon: UserX }} mobile />
                    </>
                  )}

                  {links.filter(l => l.path !== '/' && l.path !== '/super-admin').map(link => (
                    <NavLink key={link.path} link={link} mobile />
                  ))}

                  {(userRole === 'admin' || userRole === 'superadmin') && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground mt-4 mb-2 px-2">Settings</div>
                      <NavLink link={{ path: "/admin-settings", label: "Admin Settings", icon: Settings }} mobile />
                      <NavLink link={{ path: "/admin/classes", label: "Classes", icon: GraduationCap }} mobile />
                      <NavLink link={{ path: "/subjects", label: "Subjects", icon: Library }} mobile />
                    </>
                  )}

                  {/* Mobile Session Selector */}
                  {sessions.length > 0 && onSessionChange && (
                    <div className="px-2 mt-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Academic Session</div>
                      <Select value={selectedSessionId} onValueChange={onSessionChange}>
                        <SelectTrigger className="w-full bg-background border-input">
                          <SelectValue placeholder="Session" />
                        </SelectTrigger>
                        <SelectContent>
                          {sessions.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="border-t my-4 pt-4">
                    <div className="px-2 mb-2">
                      <p className="font-medium text-sm truncate">{userEmail}</p>
                      <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="default"
                      onClick={onLogout}
                      className="gap-2 w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover-elevate rounded-md px-3 py-2 mr-auto md:mr-0">
            <SchoolLogo url={config.logoUrl} name={config.name} />
            <span className="font-semibold text-lg truncate max-w-[150px] md:max-w-[200px]" title={userRole === 'superadmin' ? 'School ERP' : config.name}>
              {userRole === 'superadmin' ? 'School ERP' : (config.name || 'School ERP')}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 ml-6">
            {links.filter(l => l.path === '/' || l.path === '/super-admin').map(link => (
              <NavLink key={link.path} link={link} />
            ))}

            {(userRole === 'admin' || userRole === 'superadmin') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={["/students", "/students-withdrawn"].includes(location) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
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

            {links.filter(l => l.path !== '/' && l.path !== '/super-admin').map(link => (
              <NavLink key={link.path} link={link} />
            ))}

            {(userRole === 'admin' || userRole === 'superadmin') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={["/admin-settings", "/subjects"].includes(location) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild>
                    <Link href="/admin-settings" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Admin Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/classes" className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Classes
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

          {/* Right Side Items (Desktop Only) */}
          <div className="hidden md:flex items-center gap-4">
            {/* User Profile */}
            <div className="text-sm text-right">
              <p className="font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>

            {/* Session Selector */}
            {sessions.length > 0 && onSessionChange && (
              <Select value={selectedSessionId} onValueChange={onSessionChange}>
                <SelectTrigger className="w-[140px] h-8 bg-background border-input">
                  <SelectValue placeholder="Session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2"
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
