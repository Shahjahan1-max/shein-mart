/**
 * Dropdown Menu Component
 * Enterprise-grade dropdown with keyboard navigation and accessibility
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownProps {
  children: ReactNode;
  trigger: ReactNode;
  align?: 'start' | 'end';
  sideOffset?: number;
}

export interface DropdownMenuProps {
  children: ReactNode;
  className?: string;
}

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
  checked?: boolean;
}

export interface DropdownSeparatorProps {}

export interface DropdownLabelProps {
  children: ReactNode;
  className?: string;
}

export function Dropdown({ children, trigger, align = 'start', sideOffset = 4 }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const openDropdown = () => setOpen(true);
  const closeDropdown = () => setOpen(false);
  const toggleDropdown = () => setOpen(prev => !prev);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const dropdownContent = (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        'absolute z-50 min-w-[16rem] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700',
        'shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 ease-out',
        'overflow-hidden'
      )}
      style={{
        minWidth: triggerRef.current?.getBoundingClientRect().width || 256,
      }}
    >
      <div className="py-1">{children}</div>
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'px-4 py-2 text-sm font-medium',
          'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          'rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          'transition-colors'
        )}
      >
        {trigger}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export function DropdownMenu({ children, className }: DropdownMenuProps) {
  return (
    <div className={cn('py-1', className)} role="none">
      {children}
    </div>
  );
}

export function DropdownItem({
  className,
  icon,
  shortcut,
  destructive = false,
  checked,
  children,
  onClick,
  ...props
}: DropdownItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!props.disabled) {
      onClick?.(e);
    }
  };

  return (
    <button
      role="menuitem"
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm',
        'text-gray-700 dark:text-gray-300',
        'hover:bg-gray-50 dark:hover:bg-gray-800',
        'focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800',
        'transition-colors',
        destructive && 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
        props.disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0 w-5 h-5">{icon}</span>}
      {children}
      {shortcut && (
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-mono">{shortcut}</span>
      )}
      {checked && <Check className="ml-auto h-4 w-4 text-brand-600 dark:text-brand-400" />}
    </button>
  );
}

export function DropdownSeparator() {
  return (
    <div role="separator" className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
  );
}

export function DropdownLabel({ children, className }: DropdownLabelProps) {
  return (
    <div role="none" className={cn('px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', className)}>
      {children}
    </div>
  );
}

// Context Menu (right-click)
interface ContextMenuProps {
  children: ReactNode;
  trigger: ReactNode;
}

export function ContextMenu({ children, trigger }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const menuContent = (
    <div
      ref={contentRef}
      role="menu"
      className="fixed z-50 min-w-[16rem] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 ease-out overflow-hidden py-1"
      style={{ left: position.x, top: position.y }}
    >
      {children}
    </div>
  );

  return (
    <div ref={triggerRef} onContextMenu={handleContextMenu}>
      {trigger}
      {open && createPortal(menuContent, document.body)}
    </div>
  );
}