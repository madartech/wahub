import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useGatewayAuth } from '@/contexts/GatewayAuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, LogOut, MessageSquare, Activity } from 'lucide-react';
import { InstallButton } from '@/components/InstallButton';
import SidebarWatchdogWidget from '@/components/layout/SidebarWatchdogWidget';
import UsersCounterWidget from '@/components/layout/UsersCounterWidget';
import { ThemeToggle } from '@/components/ThemeToggle';

interface GatewayLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/admin/operations', label: 'Operations', icon: Activity },
];

export default function GatewayLayout({ children }: GatewayLayoutProps) {
  const { logout } = useGatewayAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-3 border-b border-border bg-sidebar safe-top">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-sidebar-foreground">WA Hub</h1>
            <p className="text-xs text-muted-foreground">Gateway Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UsersCounterWidget />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-semibold text-sidebar-foreground">WA Hub</h1>
                <p className="text-xs text-muted-foreground">Gateway Admin</p>
              </div>
            </div>
          </div>
          {/* Users counter */}
          <div className="mt-4">
            <UsersCounterWidget />
          </div>
          {/* Install Button */}
          <div className="mt-3">
            <InstallButton />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Theme
            </span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-border flex items-stretch h-16 z-50 safe-bottom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 flex-1 min-w-[80px] min-h-[48px] text-xs font-medium transition-colors active:bg-sidebar-accent/50',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-6 w-6" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  );
}