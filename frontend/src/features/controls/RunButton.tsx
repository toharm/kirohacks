/**
 * RunButton Component
 *
 * Full-width simulation trigger button with fire glow styling, disabled state
 * during active runs, and a progress overlay bar showing completion percentage.
 *
 * **Simulation Flow:**
 * 1. User clicks "Run Simulation" button
 * 2. Component validates inputs (ignition point set, no wind errors)
 * 3. Dispatches SUBMIT_SIMULATION action → state.jobStatus = 'running'
 * 4. Calls api.simulate() with simulation parameters
 * 5. API client handles polling internally, calling onProgress callback
 * 6. Each progress update dispatches UPDATE_PROGRESS action
 * 7. When complete, api.simulate() returns full results
 * 8. Dispatches SET_RESULTS action → state.jobStatus = 'complete'
 * 9. On error, dispatches SET_ERROR action → state.jobStatus = 'error'
 *
 * **Progress Display:**
 * - Progress bar width animates based on completed/total runs
 * - Button text shows "Running X/Y..." during execution
 * - Button is disabled during simulation
 *
 * Disabled when:
 * - Simulation is already running
 * - No ignition point is set (shows tooltip)
 * - Wind validation errors are present
 *
 * @see design.md for styling specifications
 * @see requirements.md Requirement 3, AC 8
 */

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';
import { getApi } from '@/services/api';

interface RunButtonProps {
  /** Whether wind inputs currently have validation errors */
  hasWindErrors?: boolean;
  /** Called when the button is clicked while validation fails, to trigger error display */
  onValidationAttempt?: () => void;
}

export function RunButton({ hasWindErrors = false, onValidationAttempt }: RunButtonProps): React.ReactElement {
  const {
    state,
    startSimulation,
    updateProgress,
    setResults,
    setError,
    isSimulating,
    progressPercentage,
  } = useSimulation();

  const { progress, ignitionPoint, windParams, monteCarloRuns } = state;

  const isRunning = isSimulating;
  const missingIgnition = !ignitionPoint;
  const isDisabled = isRunning || missingIgnition || hasWindErrors;

  const handleRun = useCallback(async () => {
    // If there are validation issues, notify parent to show errors
    if (missingIgnition || hasWindErrors) {
      onValidationAttempt?.();
      return;
    }

    if (isRunning) return;

    // Transition to running state
    startSimulation();

    try {
      const api = await getApi();

      const results = await api.simulate(
        {
          ignition_point: ignitionPoint!,
          wind_speed: windParams.speed,
          wind_direction: windParams.direction,
          wind_gust: windParams.gust,
          relative_humidity: windParams.humidity,
          num_runs: monteCarloRuns,
        },
        (progressUpdate) => {
          updateProgress(progressUpdate.completed_runs, progressUpdate.total_runs);
        }
      );

      setResults(results);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Simulation failed. Please try again.';
      setError(message);
    }
  }, [
    isRunning,
    missingIgnition,
    hasWindErrors,
    ignitionPoint,
    windParams,
    monteCarloRuns,
    startSimulation,
    updateProgress,
    setResults,
    setError,
    onValidationAttempt,
  ]);

  const progressWidth = `${progressPercentage}%`;

  // Determine tooltip message for disabled state
  const tooltipMessage = missingIgnition
    ? 'Select an ignition point on the map'
    : hasWindErrors
    ? 'Fix wind parameter errors before running'
    : undefined;

  return (
    <div className="relative group">
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleRun}
        aria-label={
          isRunning
            ? 'Simulation in progress'
            : missingIgnition
            ? 'Run simulation — ignition point required'
            : 'Run simulation'
        }
        aria-describedby={tooltipMessage ? 'run-button-tooltip' : undefined}
        className={cn(
          'relative w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-150 overflow-hidden',
          'min-h-[44px]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary',
          isRunning
            ? 'bg-surface-overlay text-gray-500 cursor-not-allowed'
            : isDisabled
            ? 'bg-surface-overlay text-gray-600 cursor-not-allowed opacity-60'
            : 'bg-fire-active hover:bg-fire-medium text-white shadow-glow-fire hover:shadow-lg'
        )}
      >
        {/* Progress overlay bar — absolutely positioned, transitions width */}
        {isRunning && (
          <div
            className="absolute inset-y-0 left-0 bg-fire-active/30 transition-[width] duration-300 ease-out"
            style={{ width: progressWidth }}
            aria-hidden="true"
          />
        )}

        {/* Button label — sits above the progress bar */}
        <span className="relative z-10">
          {isRunning
            ? `Running ${progress?.completed ?? 0}/${progress?.total ?? monteCarloRuns}...`
            : '▶ Run Simulation'}
        </span>
      </button>

      {/* Tooltip shown on hover when disabled due to missing ignition or wind errors */}
      {tooltipMessage && !isRunning && (
        <div
          id="run-button-tooltip"
          role="tooltip"
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5',
            'bg-surface-overlay border border-surface-border rounded-md',
            'text-xs text-gray-300 whitespace-nowrap shadow-lg',
            'opacity-0 group-hover:opacity-100 pointer-events-none',
            'transition-opacity duration-150',
            'z-10'
          )}
        >
          {tooltipMessage}
          {/* Tooltip arrow */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-border"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
