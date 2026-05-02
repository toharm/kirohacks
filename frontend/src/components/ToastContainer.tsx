/**
 * ToastContainer Component
 *
 * Container for toast notifications with auto-dismiss and animations.
 * Renders toasts from ToastContext with appropriate styling per variant.
 *
 * @see design.md for toast styling specifications
 * @see ToastContext.tsx for toast state management
 */

import { useToast, type Toast, type ToastVariant } from '../context/ToastContext';
import { cn } from '../lib/cn';

// ============================================================================
// Variant Styles
// ============================================================================

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-accent-success/10 border-accent-success/30 text-accent-success',
  warning: 'bg-accent-warning/10 border-accent-warning/30 text-accent-warning',
  error: 'bg-accent-error/10 border-accent-error/30 text-accent-error',
  info: 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary',
};

const VARIANT_ICONS: Record<ToastVariant, React.ReactElement> = {
  success: <SuccessIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
  info: <InfoIcon />,
};

// ============================================================================
// ToastContainer Component
// ============================================================================

/**
 * Container that renders all active toast notifications
 */
export function ToastContainer(): React.ReactElement {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// ToastItem Component
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

/**
 * Individual toast notification item
 */
function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm',
        'border backdrop-blur-sm',
        'animate-fade-in pointer-events-auto',
        'transition-opacity duration-300',
        VARIANT_STYLES[toast.variant]
      )}
      role="alert"
    >
      {/* Icon */}
      <span className="flex-shrink-0 mt-0.5" aria-hidden="true">
        {VARIANT_ICONS[toast.variant]}
      </span>

      {/* Message */}
      <p className="flex-1 text-gray-200">{toast.message}</p>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'flex-shrink-0 p-1 rounded-md',
          'hover:bg-white/10 transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current'
        )}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function SuccessIcon(): React.ReactElement {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function WarningIcon(): React.ReactElement {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function ErrorIcon(): React.ReactElement {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function InfoIcon(): React.ReactElement {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CloseIcon(): React.ReactElement {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
