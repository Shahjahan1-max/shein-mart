/**
 * Skeleton Component
 * Enterprise-grade skeleton loaders for better perceived performance
 */

import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'avatar' | 'button' | 'input';
  width?: string | number;
  height?: string | number;
  size?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

const baseStyles = 'bg-gray-200 dark:bg-gray-700 rounded overflow-hidden';

const animationStyles = {
  pulse: 'animate-pulse',
  wave: 'animate-[shimmer_1.5s_ease-in-out_infinite]',
  none: '',
};

const variantStyles = {
  text: 'h-4 rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
  card: 'rounded-xl',
  avatar: 'rounded-full',
  button: 'rounded-xl h-10',
  input: 'rounded-xl h-10',
};

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  ...props
}: SkeletonProps) {
  const w = width ? (typeof width === 'number' ? `${width}px` : width) : '100%';
  const h = height ? (typeof height === 'number' ? `${height}px` : height) : undefined;

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{ width: w, height: h }}
      aria-hidden="true"
      {...props}
    />
  );
}

// Specialized skeleton components
export function SkeletonText({ lines = 3, className, ...props }: { lines?: number } & Omit<SkeletonProps, 'variant'>) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '60%' : '100%'} {...props} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, ...props }: Omit<SkeletonProps, 'variant'>) {
  return (
    <div className={cn('space-y-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900', className)} {...props}>
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" size="md" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
      <Skeleton variant="rectangular" height={120} />
      <div className="flex gap-2">
        <Skeleton variant="button" width="100%" />
        <Skeleton variant="button" width="100%" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, className, ...props }: { rows?: number; columns?: number } & Omit<SkeletonProps, 'variant'>) {
  return (
    <div className={cn('overflow-x-auto', className)} {...props}>
      <table className="w-full">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton variant="text" width="80%" height={24} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }).map((_, col) => (
                <td key={col} className="px-4 py-3">
                  <Skeleton variant="text" width="100%" height={20} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonList({ items = 5, className, ...props }: { items?: number } & Omit<SkeletonProps, 'variant'>) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="avatar" className="w-10 h-10" />
          <div className="flex-1 space-y-1">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard({ className, ...props }: Omit<SkeletonProps, 'variant'>) {
  return (
    <div className={cn('space-y-6 p-4 sm:p-6', className)} {...props}>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="100%" height={32} />
            <Skeleton variant="text" width="30%" />
          </div>
        ))}
      </div>

      {/* Chart Area */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="rectangular" height={300} className="mt-4" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <Skeleton variant="text" width="30%" />
        </div>
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}