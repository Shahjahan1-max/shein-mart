/**
 * Toast/Notification System
 * Enterprise-grade toast notifications with animations and accessibility
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';

// Toast Types
export type ToastVariant = 'default' | 'destructive' | 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export type ToastProps = ToastOptions;
export type ToastActionElement = ReactNode;

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 300000; // 5 minutes

type ToastAction = 
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string }
  | { type: 'UPDATE'; id: string; toast: Partial<Toast> }
  | { type: 'CLEAR' };

interface ToastState {
  toasts: Toast[];
}

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'REMOVE':
      return { toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'UPDATE':
      return { toasts: state.toasts.map(t => t.id === action.id ? { ...t, ...action.toast } : t) };
    case 'CLEAR':
      return { toasts: [] };
  }
}

// Toast Context
const ToastContext = React.createContext<{
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  update: (id: string, toast: Partial<Toast>) => void;
  clear: () => void;
} | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] });

  const toast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || 'default',
      duration: options.duration ?? (options.variant === 'loading' ? Infinity : 5000),
      action: options.action,
      dismissible: options.dismissible ?? true,
    };

    dispatch({ type: 'ADD', toast });

    if (toast.duration !== Infinity) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE', id });
      }, toast.duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const update = useCallback((id: string, toast: Partial<Toast>) => {
    dispatch({ type: 'UPDATE', id, toast });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast, dismiss, update, clear }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

// Toaster Component
function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm sm:max-w-md">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>,
    document.body
  );
}

function ToastComponent({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    if (toast.dismissible) {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }
  };

  const variantStyles: Record<ToastVariant, string> = {
    default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
    destructive: 'bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800',
    success: 'bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800',
    error: 'bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800',
    warning: 'bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800',
    info: 'bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800',
    loading: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
  };

  const variant = toast.variant || 'default';

  const iconComponents: Record<ToastVariant, ReactNode> = {
    default: <Info className="h-5 w-5 text-gray-400" />,
    destructive: <AlertCircle className="h-5 w-5 text-red-500" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
    loading: <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />,
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl shadow-xl',
        'animate-in slide-in-from-bottom-full fade-in duration-300 ease-out',
        exiting && 'animate-out fade-out slide-out-to-right duration-200 ease-in',
        variantStyles[variant] || variantStyles.default
      )}
      role="alert"
      aria-live={variant === 'error' || variant === 'destructive' ? 'assertive' : 'polite'}
    >
      <div className="flex-shrink-0">{iconComponents[variant] || iconComponents.default}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action?.onClick(); onDismiss(toast.id); }}
            className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Convenience hooks
export function useToastHelpers() {
  const { toast, dismiss, update, clear } = useToast();

  return {
    toast,
    dismiss,
    update,
    clear,
    success: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'variant'>) =>
      toast({ ...options, title, description, variant: 'success' }),
    error: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'variant'>) =>
      toast({ ...options, title, description, variant: 'error' }),
    warning: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'variant'>) =>
      toast({ ...options, title, description, variant: 'warning' }),
    info: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'variant'>) =>
      toast({ ...options, title, description, variant: 'info' }),
    loading: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'variant'>) =>
      toast({ ...options, title, description, variant: 'loading', duration: Infinity }),
  };
}

// Import React
import React from 'react';