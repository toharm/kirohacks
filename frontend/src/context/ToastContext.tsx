/**
 * Toast Context Provider
 *
 * React Context for managing toast notifications with auto-dismiss functionality.
 * Provides a simple API for showing success, warning, and error toasts.
 *
 * @see design.md for toast styling specifications
 */

import type { ReactNode } from 'react';
import { createContext, useContext, useCallback, useState, useRef } from 'react';

// ============================================================================
// Toast Types
// ============================================================================

/**
 * Toast notification variant
 */
export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

/**
 * Toast notification data
 */
export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

/**
 * Options for showing a toast
 */
export interface ShowToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss. Default: 5000. Set to 0 to disable. */
  duration?: number;
}

/**
 * Toast context value
 */
export interface ToastContextValue {
  toasts: Toast[];
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface ToastProviderProps {
  children: ReactNode;
  /** Default duration for toasts in ms. Default: 5000 */
  defaultDuration?: number;
  /** Maximum number of toasts to show at once. Default: 5 */
  maxToasts?: number;
}

/**
 * Generate a unique toast ID
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * ToastProvider component
 *
 * Wraps the application with toast notification context.
 * Manages toast state and auto-dismiss timers.
 */
export function ToastProvider({
  children,
  defaultDuration = 5000,
  maxToasts = 5,
}: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Dismiss a toast by ID
   */
  const dismissToast = useCallback((id: string) => {
    // Clear the timer if it exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Show a new toast notification
   */
  const showToast = useCallback(
    (options: ShowToastOptions): string => {
      const id = generateToastId();
      const duration = options.duration ?? defaultDuration;

      const newToast: Toast = {
        id,
        message: options.message,
        variant: options.variant ?? 'info',
        duration,
      };

      setToasts((prev) => {
        // Remove oldest toasts if we exceed maxToasts
        const updated = [...prev, newToast];
        if (updated.length > maxToasts) {
          const removed = updated.slice(0, updated.length - maxToasts);
          // Clear timers for removed toasts
          removed.forEach((toast) => {
            const timer = timersRef.current.get(toast.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(toast.id);
            }
          });
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      // Set auto-dismiss timer if duration > 0
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [defaultDuration, maxToasts, dismissToast]
  );

  /**
   * Clear all toasts
   */
  const clearAllToasts = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const value: ToastContextValue = {
    toasts,
    showToast,
    dismissToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access toast context
 * @throws Error if used outside ToastProvider
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook that returns only the showToast function for simpler usage
 */
export function useShowToast() {
  const { showToast } = useToast();
  return showToast;
}
