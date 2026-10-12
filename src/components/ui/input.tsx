/**
 * Input Component
 * Enterprise-grade form input with validation states and accessibility
 */

import { forwardRef, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, leftElement, rightElement, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          {leftElement && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl shadow-sm',
              'text-gray-900 dark:text-gray-100 placeholder-gray-400',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900',
              error
                ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500',
              leftIcon && 'pl-10',
              leftElement && 'pl-10',
              rightIcon && 'pr-10',
              rightElement && 'pr-10',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedBy}
            aria-errormessage={errorId}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none flex items-center justify-center">
              {rightIcon}
            </div>
          )}
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea Component
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${textareaId}-error` : undefined;
    const hintId = hint ? `${textareaId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl shadow-sm',
            'text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-y min-h-[100px]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900',
            error
              ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-errormessage={errorId}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select Component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl shadow-sm appearance-none',
              'text-gray-900 dark:text-gray-100',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900',
              error
                ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500',
              'pr-10',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedBy}
            aria-errormessage={errorId}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>{placeholder}</option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Form Field Wrapper - composes label, input, error, hint
export interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, error, hint, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}