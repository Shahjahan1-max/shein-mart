/**
 * Modal & Dialog Components
 * Enterprise-grade modal with accessibility and animations
 */

import { useEffect, useRef, type ReactNode, forwardRef, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
        return;
      }

      if (e.key === 'Tab' && contentRef.current) {
        const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    setTimeout(() => {
      const focusable = contentRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const modalContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => {
        if (e.target === overlayRef.current && closeOnOverlayClick) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      <div
        ref={contentRef}
        className={cn(
          'relative w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200 ease-out',
          sizeStyles[size],
          className
        )}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 dark:border-gray-800">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Confirmation Modal
export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50',
            variant === 'destructive'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-brand-600 hover:bg-brand-700'
          )}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}

// Drawer Component
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const drawerPositionStyles = {
  left: 'left-0',
  right: 'right-0',
};

const drawerSizeStyles = {
  sm: 'w-72',
  md: 'w-96',
  lg: 'w-[32rem]',
  full: 'w-full max-w-[90vw]',
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  position = 'right',
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
}: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
        return;
      }

      if (e.key === 'Tab' && contentRef.current) {
        const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      const focusable = contentRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const drawerContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex"
      onClick={e => {
        if (e.target === overlayRef.current && closeOnOverlayClick) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drawer-title' : undefined}
      aria-describedby={description ? 'drawer-description' : undefined}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => closeOnOverlayClick && onClose()}
      />
      <div
        ref={contentRef}
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col bg-white dark:bg-gray-900 shadow-xl',
          'animate-in slide-in-from-right duration-300 ease-out',
          drawerPositionStyles[position],
          drawerSizeStyles[size],
          'flex-col'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div>
              {title && (
                <h2 id="drawer-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {description && (
                <p id="drawer-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}

// Alert Dialog
export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
}

export function AlertDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}: AlertDialogProps) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50',
            variant === 'destructive'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-brand-600 hover:bg-brand-700'
          )}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}