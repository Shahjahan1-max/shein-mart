/**
 * Tooltip Component
 * Enterprise-grade tooltip with positioning and accessibility
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content?: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className,
  sideOffset = 8,
  align = 'center',
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Tab') {
      hideTooltip();
    }
  };

  useEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const maxWidth = 280;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = trigger.top - tooltip.height - sideOffset;
        if (align === 'start') left = trigger.left;
        else if (align === 'end') left = trigger.right - tooltip.width;
        else left = trigger.left + (trigger.width - tooltip.width) / 2;
        break;
      case 'bottom':
        top = trigger.bottom + sideOffset;
        if (align === 'start') left = trigger.left;
        else if (align === 'end') left = trigger.right - tooltip.width;
        else left = trigger.left + (trigger.width - tooltip.width) / 2;
        break;
      case 'left':
        left = trigger.left - tooltip.width - sideOffset;
        top = trigger.top + (trigger.height - tooltip.height) / 2;
        break;
      case 'right':
        left = trigger.right + sideOffset;
        top = trigger.top + (trigger.height - tooltip.height) / 2;
        break;
    }

    // Viewport collision detection
    if (left < viewportPadding) left = viewportPadding;
    if (left + tooltip.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - tooltip.width - viewportPadding;
    }
    if (top < viewportPadding) {
      top = viewportPadding;
    }
    if (top + tooltip.height > window.innerHeight - viewportPadding) {
      top = window.innerHeight - tooltip.height - viewportPadding;
    }

    setTooltipRect({ top, left, width: tooltip.width, height: tooltip.height, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect);
  }, [open, position, sideOffset, align]);

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={cn(
        'absolute z-50 max-w-xs px-3 py-2 text-xs font-medium text-white bg-gray-900 dark:bg-gray-50 rounded-lg shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150 ease-out',
        'pointer-events-none'
      )}
      style={{ top: tooltipRect?.top, left: tooltipRect?.left, maxWidth: 280 }}
      role="tooltip"
      aria-hidden="false"
    >
      {content}
      <div className={cn(
        'absolute w-2 h-2 bg-gray-900 dark:bg-gray-50 rotate-45',
        position === 'top' && 'bottom-[-4px]',
        position === 'bottom' && 'top-[-4px]',
        position === 'left' && 'right-[-4px]',
        position === 'right' && 'left-[-4px]',
        align === 'start' && 'left-4',
        align === 'end' && 'right-4',
        align === 'center' && 'left-1/2 -translate-x-1/2'
      )} />
    </div>
  );

  return (
    <div
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={handleKeyDown}
    >
      {children}
      {open && createPortal(tooltipContent, document.body)}
    </div>
  );
}

// Tooltip Provider for global configuration
export interface TooltipProviderProps {
  children: ReactNode;
  defaultDelay?: number;
  delayDuration?: number;
  defaultPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export function TooltipProvider({ children, defaultDelay = 200, defaultPosition = 'top' }: TooltipProviderProps) {
  // Context for global tooltip settings could be added here
  return <>{children}</>;
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export function TooltipTrigger({ children, className, asChild, ...props }: TooltipTriggerProps) {
  return <div className={cn("inline-block", className)} {...props}>{children}</div>;
}

export function TooltipContent({ children, className, side, align, sideOffset, ...props }: TooltipContentProps) {
  return <div className={cn("px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-900 text-white shadow-md z-50", className)} {...props}>{children}</div>;
}