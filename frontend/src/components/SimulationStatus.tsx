/**
 * SimulationStatus Component
 *
 * Displays the current simulation status with a colored indicator dot
 * and status text. Includes progress display when running.
 *
 * @see design.md for status color specifications
 */

import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';

/**
 * Status dot color mapping based on job status
 */
const STATUS_DOT_CLASSES: Record<string, string> = {
  idle: 'bg-gray-500',
  running: 'bg-accent-primary animate-pulse',
  complete: 'bg-accent-success',
  error: 'bg-accent-error',
};

const STATUS_TEXT: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  complete: 'Complete',
  error: 'Error',
};

export function SimulationStatus(): React.ReactElement {
  const { state, progressPercentage } = useSimulation();
  const { jobStatus, progress } = state;

  const dotClass = STATUS_DOT_CLASSES[jobStatus] ?? 'bg-gray-500';
  const statusText = STATUS_TEXT[jobStatus] ?? 'Unknown';

  return (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Status indicator dot */}
      <span
        className={cn('w-2 h-2 rounded-full', dotClass)}
        aria-hidden="true"
      />

      {/* Status text */}
      <span className="text-xs font-mono text-gray-300">
        {statusText}
      </span>

      {/* Progress display when running */}
      {jobStatus === 'running' && progress && (
        <span className="text-xs font-mono text-gray-400">
          {progress.completed}/{progress.total}
        </span>
      )}

      {jobStatus === 'running' && progress && (
        <span className="sr-only">
          {progressPercentage}% complete
        </span>
      )}
    </div>
  );
}
