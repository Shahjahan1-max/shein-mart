/**
 * Button Component
 * Enterprise-grade button with variants, sizes, and states
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap rounded-xl",
  {
    variants: {
      variant: {
        default: "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-sm",
        primary: "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-sm",
        secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700",
        outline: "border-2 border-purple-600 text-purple-600 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-950",
        ghost: "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
        destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
        link: "text-purple-600 hover:text-purple-700 underline-offset-2 hover:underline p-0",
      },
      size: {
        default: "h-10 px-4 text-sm gap-2",
        sm: "h-8 px-3 text-xs gap-1.5",
        md: "h-10 px-4 text-sm gap-2",
        lg: "h-12 px-6 text-base gap-2.5",
        xl: "h-14 px-8 text-lg gap-3",
        icon: "h-10 w-10 p-0 flex items-center justify-center",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'link' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'default';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold transition-all duration-200 ease-in-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
      whitespace-nowrap
    `;

    const variantStyles: Record<string, string> = {
      primary: `
        bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800
        focus-visible:ring-brand-500
        shadow-sm hover:shadow-md
      `,
      secondary: `
        bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300
        dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700 dark:active:bg-neutral-600
        focus-visible:ring-neutral-500
        border border-neutral-200 dark:border-neutral-700
      `,
      outline: `
        border-2 border-brand-600 text-brand-600 hover:bg-brand-50 active:bg-brand-100
        dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-950 dark:active:bg-brand-900
        focus-visible:ring-brand-500
      `,
      ghost: `
        text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200
        dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700
        focus-visible:ring-neutral-500
      `,
      destructive: `
        bg-error-600 text-white hover:bg-error-700 active:bg-error-800
        focus-visible:ring-error-500
        shadow-sm hover:shadow-md
      `,
      success: `
        bg-success-600 text-white hover:bg-success-700 active:bg-success-800
        focus-visible:ring-success-500
        shadow-sm hover:shadow-md
      `,
      link: `
        text-brand-600 hover:text-brand-700 active:text-brand-800 underline-offset-2 hover:underline
        dark:text-brand-400 dark:hover:text-brand-300
        focus-visible:ring-brand-500
      `,
      default: `
        bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800
        focus-visible:ring-brand-500
        shadow-sm hover:shadow-md
      `,
    };

    const sizeStyles: Record<string, string> = {
      default: 'h-10 px-4 text-sm gap-2',
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
      xl: 'h-14 px-8 text-lg gap-3',
      icon: 'h-10 w-10 p-0 flex items-center justify-center',
    };

    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          widthStyles,
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && leftIcon && (
          <span aria-hidden="true" className="flex-shrink-0">{leftIcon}</span>
        )}
        <span className={loading ? 'sr-only' : ''}>{children}</span>
        {!loading && rightIcon && (
          <span aria-hidden="true" className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Specialized button components
export const PrimaryButton = ({ children, ...props }: ButtonProps) => (
  <Button variant="primary" {...props}>{children}</Button>
);

export const SecondaryButton = ({ children, ...props }: ButtonProps) => (
  <Button variant="secondary" {...props}>{children}</Button>
);

export const OutlineButton = ({ children, ...props }: ButtonProps) => (
  <Button variant="outline" {...props}>{children}</Button>
);

export const GhostButton = ({ children, ...props }: ButtonProps) => (
  <Button variant="ghost" {...props}>{children}</Button>
);

export const DestructiveButton = ({ children, ...props }: ButtonProps) => (
  <Button variant="destructive" {...props}>{children}</Button>
);

export const LinkButton = ({ children, ...props }: ButtonProps) => (
  <Button variant="link" {...props}>{children}</Button>
);

// Icon Button
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'primary';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, children, 'aria-label': ariaLabel, size = 'md', variant = 'ghost', ...props }, ref) => {
    const sizeStyles = {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(sizeStyles[size], 'p-0', className)}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

// Button Group
export interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const ButtonGroup = ({ children, className, orientation = 'horizontal' }: ButtonGroupProps) => (
  <div
    className={cn(
      'inline-flex',
      orientation === 'horizontal' ? 'items-center' : 'flex-col',
      className
    )}
    role="group"
  >
    {children}
  </div>
);

// Toggle Button
export interface ToggleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  onToggle?: (pressed: boolean) => void;
}

export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ className, pressed, onToggle, children, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const nextPressed = !pressed;
      onToggle?.(nextPressed);
      props.onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant={pressed ? 'primary' : 'outline'}
        className={cn(
          'transition-all duration-200',
          pressed && 'bg-brand-600 text-white border-brand-600',
          className
        )}
        aria-pressed={pressed}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

ToggleButton.displayName = 'ToggleButton';