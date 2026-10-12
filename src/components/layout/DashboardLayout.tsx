/**
 * Dashboard Layout Component
 * Enterprise-grade dashboard layout with sidebar navigation
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Avatar } from '../ui/avatar';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';
import { LanguageSelector } from '../LanguageSelector';
import { useLocation } from 'wouter';
import { ArrowLeft, ChevronRight, LayoutDashboard, Wallet, Package, Users, BarChart3, Settings, HelpCircle, LogOut, Menu, X, ChevronDown, User } from 'lucide-react';
import { Dropdown, DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from '../ui/Dropdown';

export interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  showBack?: boolean;
  backTo?: string;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
    initials?: string;
  } | null;
  onLogout?: () => void;
  navigation?: {
    label: string;
    href: string;
    icon: ReactNode;
    badge?: string;
    children?: { label: string; href: string }[];
  }[];
}

const DEFAULT_NAVIGATION = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Wallet', href: '/dashboard/wallet', icon: <Wallet className="h-5 w-5" /> },
  { label: 'Marketplaces', href: '/dashboard/marketplaces', icon: <Package className="h-5 w-5" /> },
  { label: 'Team', href: '/dashboard/team', icon: <Users className="h-5 w-5" /> },
  { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="h-5 w-5" /> },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> },
  { label: 'Support', href: '/dashboard/support', icon: <HelpCircle className="h-5 w-5" /> },
];

export function DashboardLayout({
  children,
  title,
  actions,
  showBack,
  backTo,
  user,
  onLogout,
  navigation = DEFAULT_NAVIGATION,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [location, navigate] = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location]);

  const isActive = (href: string) => {
    if (href === '/dashboard') return location === '/dashboard';
    return location.startsWith(href);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
          'transition-all duration-300 ease-in-out flex flex-col',
          sidebarCollapsed ? 'w-16' : 'w-64',
          isMobile && !sidebarOpen && '-translate-x-full',
          isMobile && sidebarOpen && 'translate-x-0'
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <a href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-white font-extrabold text-sm">DX</span>
            </div>
            {!sidebarCollapsed && (
              <span className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight hidden sm:block leading-none">
                DealXStocks
              </span>
            )}
          </a>
          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight className={cn('h-5 w-5 transition-transform', sidebarCollapsed && 'rotate-180')} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
          {navigation.map(item => {
            const active = isActive(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const [subOpen, setSubOpen] = useState(false);

            if (hasChildren && !sidebarCollapsed) {
              return (
                <div key={item.href} className="group">
                  <button
                    onClick={() => setSubOpen(!subOpen)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                      active
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    )}
                    aria-expanded={subOpen}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!sidebarCollapsed && <ChevronRight className={cn('h-4 w-4 transition-transform', subOpen && 'rotate-90')} />}
                  </button>
                  {subOpen && (
                    <div className="mt-1 ml-8 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      {item.children!.map(child => (
                        <a
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'block px-3 py-2 rounded-lg text-sm transition-colors',
                            location === child.href
                              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                          )}
                        >
                          {child.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  active
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </a>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.avatar}
                  name={user.name}
                  initials={user.initials}
                  size="md"
                  status="online"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate('/dashboard/profile')}>
                  <User className="h-4 w-4 mr-2" /> Profile
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={onLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button className="flex-1" onClick={() => navigate('/register')}>
                Get Started
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-4 left-4 z-50 p-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-colors"
          aria-label="Open navigation"
        >
          <LayoutDashboard className="h-6 w-6" />
        </button>
      )}

      {/* Main content */}
      <main
        ref={mainRef}
        className={cn(
          'flex-1 overflow-y-auto',
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed && !isMobile ? 'lg:ml-16' : 'lg:ml-64',
          isMobile ? '' : 'lg:pl-0'
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div className="flex-1 min-w-0 px-1">
            {title ? (
              <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{title}</h1>
            ) : null}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {actions}
            <LanguageSelector />
            <ThemeToggle />
            <NotificationBell />
            {user && (
              <Dropdown
                trigger={
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar
                      src={user.avatar}
                      name={user.name}
                      initials={user.initials}
                      size="sm"
                    />
                    <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user.name}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                }
              >
                <DropdownMenu>
                  <DropdownLabel>Account</DropdownLabel>
                  <DropdownItem icon={<User className="h-4 w-4" />} onClick={() => window.location.href = '/dashboard/profile'}>
                    Profile
                  </DropdownItem>
                  <DropdownItem icon={<Settings className="h-4 w-4" />} onClick={() => window.location.href = '/dashboard/settings'}>
                    Settings
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem icon={<LogOut className="h-4 w-4" />} destructive onClick={onLogout}>
                    Sign Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}