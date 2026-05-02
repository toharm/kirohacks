/**
 * usePolling Hook
 *
 * Generic polling hook for async operations with configurable interval
 * and stop conditions. Handles cleanup on unmount.
 *
 * @example
 * ```tsx
 * const { start, stop, isPolling } = usePolling({
 *   fn: () => api.getResults(jobId),
 *   interval: 1000,
 *   shouldStop: (result) => result.status === 'complete',
 *   onResult: (result) => setResults(result),
 *   onError: (error) => setError(error.message),
 * });
 * ```
 */

import { useRef, useCallback, useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UsePollingOptions<T> {
  /**
   * Async function to poll
   */
  fn: () => Promise<T>;

  /**
   * Polling interval in milliseconds
   * @default 1000
   */
  interval?: number;

  /**
   * Condition to stop polling
   * Return true to stop, false to continue
   */
  shouldStop: (result: T) => boolean;

  /**
   * Callback when polling returns a result
   */
  onResult?: (result: T) => void;

  /**
   * Callback when polling encounters an error
   */
  onError?: (error: Error) => void;

  /**
   * Whether to start polling immediately
   * @default false
   */
  immediate?: boolean;

  /**
   * Maximum number of poll attempts (0 = unlimited)
   * @default 0
   */
  maxAttempts?: number;

  /**
   * Backoff multiplier for exponential backoff on errors
   * @default 1 (no backoff)
   */
  backoffMultiplier?: number;

  /**
   * Maximum interval when using backoff
   * @default 30000 (30 seconds)
   */
  maxInterval?: number;
}

export interface UsePollingReturn {
  /**
   * Start polling
   */
  start: () => void;

  /**
   * Stop polling
   */
  stop: () => void;

  /**
   * Whether polling is currently active
   */
  isPolling: boolean;

  /**
   * Number of poll attempts made
   */
  attempts: number;

  /**
   * Last error encountered (if any)
   */
  error: Error | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Generic polling hook with cleanup and stop conditions
 */
export function usePolling<T>({
  fn,
  interval = 1000,
  shouldStop,
  onResult,
  onError,
  immediate = false,
  maxAttempts = 0,
  backoffMultiplier = 1,
  maxInterval = 30000,
}: UsePollingOptions<T>): UsePollingReturn {
  const [isPolling, setIsPolling] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup and state tracking
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const currentIntervalRef = useRef(interval);
  const consecutiveErrorsRef = useRef(0);

  /**
   * Clear the polling timeout
   */
  const clearPollingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Stop polling
   */
  const stop = useCallback(() => {
    clearPollingTimeout();
    setIsPolling(false);
    currentIntervalRef.current = interval;
    consecutiveErrorsRef.current = 0;
  }, [clearPollingTimeout, interval]);

  /**
   * Execute a single poll
   */
  const poll = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const result = await fn();

      if (!mountedRef.current) return;

      // Reset error state on success
      consecutiveErrorsRef.current = 0;
      currentIntervalRef.current = interval;
      setError(null);

      // Increment attempts
      setAttempts((prev) => prev + 1);

      // Call result callback
      onResult?.(result);

      // Check stop condition
      if (shouldStop(result)) {
        stop();
        return;
      }

      // Check max attempts
      if (maxAttempts > 0 && attempts + 1 >= maxAttempts) {
        stop();
        return;
      }

      // Schedule next poll
      if (mountedRef.current && isPolling) {
        timeoutRef.current = setTimeout(poll, currentIntervalRef.current);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      consecutiveErrorsRef.current += 1;

      // Call error callback
      onError?.(error);

      // Apply backoff if configured
      if (backoffMultiplier > 1) {
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * backoffMultiplier,
          maxInterval
        );
      }

      // Continue polling unless stopped
      if (mountedRef.current && isPolling) {
        timeoutRef.current = setTimeout(poll, currentIntervalRef.current);
      }
    }
  }, [
    fn,
    interval,
    shouldStop,
    onResult,
    onError,
    maxAttempts,
    backoffMultiplier,
    maxInterval,
    attempts,
    isPolling,
    stop,
  ]);

  /**
   * Start polling
   */
  const start = useCallback(() => {
    // Clear any existing timeout
    clearPollingTimeout();

    // Reset state
    setAttempts(0);
    setError(null);
    setIsPolling(true);
    currentIntervalRef.current = interval;
    consecutiveErrorsRef.current = 0;

    // Start polling immediately
    poll();
  }, [clearPollingTimeout, interval, poll]);

  // Start immediately if configured
  useEffect(() => {
    if (immediate) {
      start();
    }
  }, [immediate, start]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearPollingTimeout();
    };
  }, [clearPollingTimeout]);

  // Update polling when isPolling changes
  useEffect(() => {
    if (isPolling && timeoutRef.current === null) {
      poll();
    }
  }, [isPolling, poll]);

  return {
    start,
    stop,
    isPolling,
    attempts,
    error,
  };
}

// ============================================================================
// Convenience Hook for Simulation Polling
// ============================================================================

export interface UseSimulationPollingOptions {
  /**
   * Function to get simulation results
   */
  getResults: () => Promise<{ status: string; completed_runs?: number; total_runs?: number }>;

  /**
   * Callback when progress updates
   */
  onProgress?: (completed: number, total: number) => void;

  /**
   * Callback when simulation completes
   */
  onComplete?: (result: unknown) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;

  /**
   * Polling interval in milliseconds
   * @default 1000
   */
  interval?: number;
}

/**
 * Specialized polling hook for simulation progress
 */
export function useSimulationPolling({
  getResults,
  onProgress,
  onComplete,
  onError,
  interval = 1000,
}: UseSimulationPollingOptions): UsePollingReturn {
  return usePolling({
    fn: getResults,
    interval,
    shouldStop: (result) => result.status === 'complete',
    onResult: (result) => {
      if (result.status === 'running' && result.completed_runs !== undefined) {
        onProgress?.(result.completed_runs, result.total_runs ?? 0);
      } else if (result.status === 'complete') {
        onComplete?.(result);
      }
    },
    onError,
    backoffMultiplier: 1.5,
    maxInterval: 5000,
  });
}
