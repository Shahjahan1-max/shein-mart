/**
 * Avatar Component
 * Enterprise-grade avatar with fallback, status, and group variants
 */

import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  status?: 'online' | 'offline' | 'busy' | 'away' | 'pending';
  statusPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  fallback?: ReactNode;
}

const sizeStyles = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-xl',
};

const shapeStyles = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-xl',
};

const statusPositionStyles = {
  'bottom-right': 'bottom-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'top-right': 'top-0 right-0',
  'top-left': 'top-0 left-0',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
  pending: 'bg-amber-500 animate-pulse',
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({
    className,
    src,
    alt,
    name,
    initials,
    size = 'md',
    shape = 'circle',
    status,
    statusPosition = 'bottom-right',
    fallback,
    ...props
  }, ref) => {
    const sizeStyle = sizeStyles[size];
    const shapeStyle = shapeStyles[shape];
    const statusPosStyle = statusPositionStyles[statusPosition];
    const statusSize = statusSizes[size];

    const displayInitials = initials || (name
      ? name
          .split(' ')
          .map(w => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?');

    const hasImage = src && src !== '';

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0',
          sizeStyle,
          shapeStyle,
          className
        )}
        {...props}
      >
        {hasImage ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : fallback ? (
          fallback
        ) : (
          <span className="flex items-center justify-center w-full h-full font-semibold text-white select-none">
            {displayInitials}
          </span>
        )}

        {status && (
          <span
            className={cn(
              'absolute rounded-full border-2 border-white dark:border-gray-900',
              statusColors[status],
              statusSizes[size],
              statusPosStyle
            )}
            aria-label={status}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// Avatar Group - for stacked avatars
export interface AvatarGroupProps {
  children: ReactNode;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  totalCount?: number;
}

export function AvatarGroup({ children, max = 5, size = 'md', className, totalCount }: AvatarGroupProps) {
  const childrenArray = React.Children.toArray(children);
  const visible = childrenArray.slice(0, max);
  const remaining = totalCount ?? (childrenArray.length - max);

  const sizeStyle = sizeStyles[size];
  const overlap = size === 'xs' ? '-8px' : size === 'sm' ? '-10px' : size === 'md' ? '-12px' : '-14px';

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((child, index) => (
        <div key={index} className="relative z-10" style={{ zIndex: max - index }}>
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-gray-900 font-medium text-neutral-600 dark:text-neutral-400',
            sizeStyle
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

// Avatar Stack - horizontal stack with names
export interface AvatarStackProps {
  avatars: { src?: string; name: string; alt?: string }[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarStack({ avatars, max = 4, size = 'md', className }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {visible.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          alt={avatar.alt}
          size={size}
          className={index > 0 ? '-ml-2 border-2 border-white dark:border-gray-900' : ''}
        />
      ))}
      {remaining > 0 && (
        <Avatar name={`${remaining}+`} size={size} fallback={<span>+{remaining}</span>} />
      )}
    </div>
  );
}