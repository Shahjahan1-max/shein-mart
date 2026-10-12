/**
 * Card Component
 * Enterprise-grade card with variants and compositions
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  border?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', hover = false, border = true, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-white dark:bg-gray-900',
      elevated: 'bg-white dark:bg-gray-900 shadow-lg',
      outlined: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
      filled: 'bg-gray-50 dark:bg-gray-800/50',
      gradient: 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 text-white',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-4 sm:p-5',
      lg: 'p-5 sm:p-6',
      xl: 'p-6 sm:p-8',
    };

    const hoverStyles = hover ? 'hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200' : '';

    const borderStyles = border ? 'border border-gray-200 dark:border-gray-700' : '';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl',
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          borderStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

// Card Title
export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold text-gray-900 dark:text-white', className)} {...props}>
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';

// Card Description
export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-gray-500 dark:text-gray-400 mt-1', className)} {...props}>
      {children}
    </p>
  )
);

CardDescription.displayName = 'CardDescription';

// Card Content
export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

// Card Footer
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';

// Stat Card - specialized for dashboard metrics
export interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string } | null;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'orange';
  loading?: boolean;
}

const colorStyles = {
  primary: 'from-blue-500 to-blue-600',
  success: 'from-green-500 to-green-600',
  warning: 'from-amber-500 to-amber-600',
  info: 'from-cyan-500 to-cyan-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
};

const iconBgStyles = {
  primary: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  success: 'bg-green-500/20 text-green-600 dark:text-green-400',
  warning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  info: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  purple: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
};

export function StatCard({
  label,
  value,
  suffix,
  icon,
  trend,
  color = 'primary',
  loading = false,
}: StatCardProps) {
  const colorStyle = colorStyles[color];
  const iconBgStyle = iconBgStyles[color];

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card hover className="min-w-0">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            {label}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums break-words">
              {value}
            </span>
            {suffix && <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">{suffix}</span>}
          </div>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('p-3 rounded-xl flex-shrink-0', iconBgStyle)}>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Metric Card - for dashboard performance metrics
export interface MetricCardProps {
  label: string;
  value: number;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'orange';
  max?: number;
  showPercentage?: boolean;
}

export function MetricCard({ label, value, color = 'primary', max = 100, showPercentage = true }: MetricCardProps) {
  const colorStyle = colorStyles[color];
  const percentage = Math.min(100, Math.round((value / max) * 100));

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
          {showPercentage && <span className="text-sm font-semibold text-gray-900 dark:text-white">{percentage}%</span>}
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorStyle} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}