/**
 * Badge Component
 * Enterprise-grade badge with variants and sizes
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  dotColor?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, dotColor, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
      primary: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
      secondary: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      success: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      error: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      info: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      outline: 'bg-transparent text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
    };

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs gap-1',
      md: 'px-2.5 py-1 text-sm gap-1.5',
      lg: 'px-3 py-1.5 text-base gap-2',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor ? '' : 'bg-current opacity-70')}
            style={dotColor ? { backgroundColor: dotColor } : undefined}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge - specialized for status indicators
export interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'processing' | 'cancelled' | 'active' | 'inactive' | 'draft' | 'published';
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pending', dotColor: '#f59e0b' },
  approved: { variant: 'success' as const, label: 'Approved', dotColor: '#22c55e' },
  rejected: { variant: 'error' as const, label: 'Rejected', dotColor: '#ef4444' },
  completed: { variant: 'success' as const, label: 'Completed', dotColor: '#22c55e' },
  processing: { variant: 'info' as const, label: 'Processing', dotColor: '#06b6d4' },
  cancelled: { variant: 'error' as const, label: 'Cancelled', dotColor: '#ef4444' },
  active: { variant: 'success' as const, label: 'Active', dotColor: '#22c55e' },
  inactive: { variant: 'default' as const, label: 'Inactive', dotColor: '#6b7280' },
  draft: { variant: 'outline' as const, label: 'Draft', dotColor: '#6b7280' },
  published: { variant: 'primary' as const, label: 'Published', dotColor: '#7c3aed' },
} as const;

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size={size} dot={showDot} dotColor={config.dotColor}>
      {config.label}
    </Badge>
  );
}

// Pill Badge - for tags and categories
export interface PillBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  removable?: boolean;
  onRemove?: () => void;
}

export const PillBadge = forwardRef<HTMLSpanElement, PillBadgeProps>(
  ({ className, variant = 'default', removable = false, onRemove, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
      primary: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
      secondary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      info: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
          variantStyles[variant],
          removable && 'cursor-pointer pr-1',
          className
        )}
        {...props}
      >
        {children}
        {removable && (
          <button
            onClick={onRemove}
            type="button"
            className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Remove"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

PillBadge.displayName = 'PillBadge';

// Dot Indicator - for online status, etc.
export interface DotIndicatorProps {
  status?: 'online' | 'offline' | 'busy' | 'away' | 'pending';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const dotColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
  pending: 'bg-amber-500 animate-pulse',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2.5 h-2.5',
  lg: 'w-3.5 h-3.5',
};

export function DotIndicator({ status = 'offline', size = 'md', className }: DotIndicatorProps) {
  return (
    <span
      className={cn(
        'rounded-full border-2 border-white dark:border-gray-900 flex-shrink-0',
        dotColors[status],
        dotSizes[size],
        className
      )}
      aria-label={status}
    />
  );
}