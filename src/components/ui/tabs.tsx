/**
 * Tabs Component
 * Enterprise-grade tabs with keyboard navigation and accessibility
 */

import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
  orientation?: 'horizontal' | 'vertical';
}

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export function Tabs({
  defaultValue,
  value,
  onChange,
  children,
  className,
  variant = 'default',
  orientation = 'horizontal',
}: TabsProps) {
  const [activeValue, setActiveValue] = useState(value || defaultValue || '');
  const controlled = value !== undefined;

  const handleChange = (newValue: string) => {
    if (!controlled) setActiveValue(newValue);
    onChange?.(newValue);
  };

  const orientationClass = orientation === 'vertical' ? 'flex-col' : '';

  return (
    <div className={cn('data-[orientation=vertical]:flex-col', orientationClass, className)}>
      {children}
    </div>
  );
}

// Context for sharing state
const TabsContext = React.createContext<{
  activeValue: string;
  onChange: (value: string) => void;
  variant: string;
  orientation: string;
} | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within Tabs');
  }
  return context;
}

// We need to import React
import { useContext, createContext } from 'react';

export function TabList({ className, children, ...props }: TabListProps) {
  const { variant, orientation } = useTabsContext();

  const baseStyles = orientation === 'vertical'
    ? 'flex flex-col gap-1'
    : 'flex gap-1';

  const variantStyles: Record<string, string> = {
    default: 'bg-gray-100 dark:bg-gray-800 p-1 rounded-xl',
    pills: '',
    underline: 'border-b border-gray-200 dark:border-gray-700',
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
      className={cn(
        'inline-flex items-center p-1',
        variantStyles[variant || 'default'],
        baseStyles,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabTrigger({ className, value, disabled, icon, children, ...props }: TabTriggerProps) {
  const { activeValue, onChange, variant, orientation } = useTabsContext();
  const isActive = activeValue === value;

  const variantStyles: Record<string, string> = {
    default: isActive
      ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50',
    pills: isActive
      ? 'bg-brand-600 text-white shadow-sm'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50',
    underline: isActive
      ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent',
  };

  const orientationStyles = orientation === 'vertical'
    ? 'w-full justify-start'
    : '';

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      value={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(value)}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-medium text-sm',
        'px-4 py-2.5 rounded-xl transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant || 'default'],
        orientationStyles,
        className
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

export function TabContent({ className, value, children, ...props }: TabContentProps) {
  const { activeValue, orientation } = useTabsContext();
  const isActive = activeValue === value;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={cn(
        'focus:outline-none',
        orientation === 'vertical' ? '' : 'animate-in fade-in-0 duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Convenience component for simple tabs
interface SimpleTabsProps {
  tabs: { value: string; label: string; icon?: ReactNode; disabled?: boolean }[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children: (value: string) => ReactNode;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function SimpleTabs({
  tabs,
  defaultValue,
  value,
  onChange,
  children,
  variant = 'default',
  className,
}: SimpleTabsProps) {
  const [activeValue, setActiveValue] = useState(value || defaultValue || tabs[0]?.value || '');
  const controlled = value !== undefined;

  const handleChange = (newValue: string) => {
    if (!controlled) setActiveValue(newValue);
    onChange?.(newValue);
  };

  const activeTab = tabs.find(t => t.value === activeValue);

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeValue === tab.value}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && handleChange(tab.value)}
            className={cn(
              'relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              activeValue === tab.value
                ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
            )}
          >
            {tab.icon && <span className="flex items-center gap-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {activeTab ? children(activeTab.value) : null}
      </div>
    </div>
  );
}