/**
 * MonteCarloSlider Component
 *
 * Range slider for configuring the number of Monte Carlo simulation runs.
 * Range: 50-1000, step: 50, default: 500
 *
 * @see design.md for styling specifications
 * @see requirements.md Requirement 3, AC 5
 */

import { useId } from 'react';

import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';

export interface MonteCarloSliderProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether the slider is disabled */
  disabled?: boolean;
}

/** Minimum number of Monte Carlo runs */
const MIN_RUNS = 50;

/** Maximum number of Monte Carlo runs */
const MAX_RUNS = 1000;

/** Step increment for the slider */
const STEP = 50;

/**
 * MonteCarloSlider component
 *
 * Allows users to configure the number of Monte Carlo simulation runs.
 * Displays a range slider with numeric value display.
 *
 * @example
 * ```tsx
 * <MonteCarloSlider />
 * <MonteCarloSlider disabled={isSimulating} />
 * ```
 */
export function MonteCarloSlider({
  className,
  disabled = false,
}: MonteCarloSliderProps): React.ReactElement {
  const { state, setMonteCarloRuns } = useSimulation();
  const sliderId = useId();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
      setMonteCarloRuns(value);
    }
  };

  return (
    <div
      className={cn(
        'bg-surface-overlay border border-surface-border rounded-lg p-3',
        className
      )}
    >
      {/* Section label */}
      <label
        htmlFor={sliderId}
        className="block text-xs uppercase tracking-wider text-gray-500 mb-3"
      >
        Monte Carlo Runs
      </label>

      {/* Numeric display */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-lg font-bold text-gray-200">
          {state.monteCarloRuns}
        </span>
        <span className="text-xs text-gray-500">runs</span>
      </div>

      {/* Range slider */}
      <input
        id={sliderId}
        type="range"
        min={MIN_RUNS}
        max={MAX_RUNS}
        step={STEP}
        value={state.monteCarloRuns}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'w-full h-2 rounded-lg appearance-none cursor-pointer',
          'bg-surface-base',
          // Custom accent color for the filled portion
          'accent-fire-active',
          // Disabled state
          disabled && 'opacity-50 cursor-not-allowed',
          // Focus styles
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'
        )}
        aria-valuemin={MIN_RUNS}
        aria-valuemax={MAX_RUNS}
        aria-valuenow={state.monteCarloRuns}
        aria-valuetext={`${state.monteCarloRuns} Monte Carlo runs`}
      />

      {/* Min/Max labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">{MIN_RUNS}</span>
        <span className="text-[10px] text-gray-600">{MAX_RUNS}</span>
      </div>
    </div>
  );
}
