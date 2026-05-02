/**
 * useKeyboardShortcuts Hook
 *
 * Handles keyboard shortcuts for the application.
 * Currently supports:
 * - Ctrl+D / Cmd+D: Toggle demo mode
 *
 * @example
 * ```tsx
 * function App() {
 *   const { toggleDemoMode } = useSimulation();
 *   useKeyboardShortcuts({ onToggleDemoMode: toggleDemoMode });
 *   return <div>...</div>;
 * }
 * ```
 */

import { useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseKeyboardShortcutsOptions {
  /**
   * Callback when Ctrl+D / Cmd+D is pressed
   */
  onToggleDemoMode?: () => void;

  /**
   * Callback when Escape is pressed
   */
  onEscape?: () => void;

  /**
   * Callback when Space is pressed (for animation toggle)
   */
  onSpace?: () => void;

  /**
   * Callback when left arrow is pressed
   */
  onArrowLeft?: () => void;

  /**
   * Callback when right arrow is pressed
   */
  onArrowRight?: () => void;

  /**
   * Whether shortcuts are enabled
   * @default true
   */
  enabled?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for handling keyboard shortcuts
 */
export function useKeyboardShortcuts({
  onToggleDemoMode,
  onEscape,
  onSpace,
  onArrowLeft,
  onArrowRight,
  enabled = true,
}: UseKeyboardShortcutsOptions = {}): void {
  /**
   * Handle keydown events
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if shortcuts are disabled
      if (!enabled) return;

      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+D or Cmd+D: Toggle demo mode
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        onToggleDemoMode?.();
        return;
      }

      // Escape: Close modals, deselect, etc.
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      // Space: Toggle animation (when not in input)
      if (event.key === ' ' && onSpace) {
        event.preventDefault();
        onSpace();
        return;
      }

      // Arrow keys for timeline navigation
      if (event.key === 'ArrowLeft') {
        onArrowLeft?.();
        return;
      }

      if (event.key === 'ArrowRight') {
        onArrowRight?.();
        return;
      }
    },
    [enabled, onToggleDemoMode, onEscape, onSpace, onArrowLeft, onArrowRight]
  );

  // Set up event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

// ============================================================================
// Convenience Hook with Simulation Integration
// ============================================================================

/**
 * Hook that integrates keyboard shortcuts with simulation context
 * Use this in the main App component
 */
export function useSimulationKeyboardShortcuts(options: {
  toggleDemoMode: () => void;
  selectZone: (zoneId: string | null) => void;
  toggleAnimation?: () => void;
  setAnimationTimestep?: (fn: (prev: number) => number) => void;
  enabled?: boolean;
}): void {
  const {
    toggleDemoMode,
    selectZone,
    toggleAnimation,
    setAnimationTimestep,
    enabled = true,
  } = options;

  useKeyboardShortcuts({
    enabled,
    onToggleDemoMode: toggleDemoMode,
    onEscape: () => selectZone(null),
    onSpace: toggleAnimation,
    onArrowLeft: setAnimationTimestep
      ? () => setAnimationTimestep((prev) => Math.max(0, prev - 1))
      : undefined,
    onArrowRight: setAnimationTimestep
      ? () => setAnimationTimestep((prev) => prev + 1)
      : undefined,
  });
}
