/**
 * Header Component
 * Enterprise-grade header with navigation, search, and user actions
 */

import { useState, useEffect, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Avatar } from '../../ui/avatar';
import { Dropdown, DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '../../ui/Dropdown';
import { ThemeToggle } from '../../ThemeToggle';
import { LanguageSelector } from '../../LanguageSelector';
import { NotificationBell } from '../../NotificationBell';
import { Search, Menu, X, ChevronDown, User, Settings, LogOut } from 'lucide-react';

export interface HeaderProps {
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
    initials?: string;
  } | null;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  showNotifications?: boolean;
  actions?: ReactNode;
  className?: string;
  logo?: ReactNode;
  siteName?: string;
  navigation?: { label: string; href: string; external?: boolean }[];
}

export function Header({
  user,
  onSearchChange,
  searchValue = '',
  showNotifications = true,
  actions,
  className,
  logo,
  siteName = 'DealXStocks',
  navigation = [],
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const siteParts = siteName.split(' ');

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/98 dark:bg-gray-900/98 shadow-md'
          : 'bg-white/95 dark:bg-gray-900/95',
        'backdrop-blur-xl border-b border-gray-100/80 dark:border-gray-800/80',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            {logo || (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-white font-extrabold text-sm">DX</span>
              </div>
            )}
            <span className="text-[17px] font-extrabold text-gray-900 dark:text-white tracking-tight hidden sm:block leading-none">
              {siteParts.length > 1 ? (
                <>
                  {siteParts[0]}
                  <span className="text-purple-600 dark:text-purple-400">
                    {" "}{siteParts.slice(1).join(" ")}
                  </span>
                </>
              ) : (
                siteName
              )}
            </span>
          </a>

          {/* Search bar - desktop */}
          <div className="hidden md:block flex-1 max-w-xl mx-4">
            <Input
              type="search"
              placeholder="Search services, marketplaces, resources..."
              value={searchValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange?.(e.target.value)}
              leftIcon={<Search className="h-4.5 w-4.5 text-gray-400" />}
              className="w-full"
            />
          </div>

          {/* Navigation - desktop */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-shrink-0">
            {navigation.map(link => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all"
              >
                {link.label}
                {link.external && <ChevronDown className="h-3 w-3 opacity-40" />}
              </a>
            ))}
          </nav>

          {/* Right-side actions */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            {actions}

            {/* Notifications */}
            {showNotifications && <NotificationBell />}

            {/* Language Selector */}
            <LanguageSelector />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Auth buttons or User Menu */}
            {user ? (
              <Dropdown
                trigger={
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar
                      src={user.avatar}
                      name={user.name || user.initials}
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
                  <DropdownItem icon={<LogOut className="h-4 w-4" />} destructive onClick={() => window.location.href = '/logout'}>
                    Sign Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-gray-200 dark:border-gray-700">
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/login'}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => window.location.href = '/register'}>
                  Get Started
                </Button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 duration-200">
          {/* Mobile Search */}
          <div className="px-4 pt-3 pb-2">
            <Input
              type="search"
              placeholder="Search services, marketplaces, resources..."
              value={searchValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange?.(e.target.value)}
              leftIcon={<Search className="h-4.5 w-4.5 text-gray-400" />}
              className="w-full"
            />
          </div>

          <div className="px-4 py-2 space-y-0.5">
            {navigation.map(link => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 rounded-xl transition-colors"
              >
                {link.label}
                {link.external && <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </a>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { window.location.href = '/login'; setMobileMenuOpen(false); }}>
              Sign In
            </Button>
            <Button className="flex-1" onClick={() => { window.location.href = '/register'; setMobileMenuOpen(false); }}>
              Get Started
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}