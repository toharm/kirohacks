/**
 * IgnitionSection Component
 *
 * Control panel section for selecting and displaying the fire ignition point.
 * Shows lat/lon coordinates when a point is selected, with buttons to
 * activate map click-to-ignite mode and clear the selection.
 *
 * Displays a validation error when the user attempts to run without an
 * ignition point selected.
 *
 * @see requirements.md Requirement 3, AC 1
 */

import { useSimulation } from '@/hooks/useSimulation';
import { cn } from '@/lib/cn';

interface IgnitionSectionProps {
  /** When true, shows a validation error indicating ignition is required */
  showRequiredError?: boolean;
}

/**
 * Ignition point selection section for the control panel.
 *
 * Displays the currently selected ignition coordinates in monospace font,
 * provides a "Select on Map" button to activate click-to-ignite mode,
 * and a "Clear" button to remove the selection.
 */
export function IgnitionSection({ showRequiredError = false }: IgnitionSectionProps): React.ReactElement {
  const { state, setIgnition } = useSimulation();
  const { ignitionPoint } = state;

  const handleClear = (): void => {
    setIgnition(null);
  };

  const showError = showRequiredError && !ignitionPoint;

  return (
    <section aria-label="Ignition Point">
      <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
        Ignition Point
      </h3>

      {ignitionPoint ? (
        <div className="space-y-2">
          {/* Coordinate display */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                Lat
              </span>
              <p className="font-mono text-sm text-gray-200">
                {ignitionPoint.lat.toFixed(6)}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                Lon
              </span>
              <p className="font-mono text-sm text-gray-200">
                {ignitionPoint.lon.toFixed(6)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                'flex-1 bg-surface-overlay hover:bg-surface-hover',
                'border border-surface-border rounded-md px-3 py-2 text-sm',
                'text-gray-300 transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary',
                'min-h-[44px]'
              )}
            >
              Select on Map
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                'bg-surface-overlay hover:bg-surface-hover',
                'border border-surface-border rounded-md px-3 py-2 text-sm',
                'text-gray-400 hover:text-accent-error transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary',
                'min-h-[44px]'
              )}
              aria-label="Clear ignition point"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Empty state */}
          <p className="text-sm text-gray-400">
            No ignition point selected
          </p>

          {/* Select on Map button — highlighted in error state */}
          <button
            type="button"
            className={cn(
              'w-full bg-surface-overlay hover:bg-surface-hover',
              'rounded-md px-3 py-2 text-sm',
              'text-gray-300 transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary',
              'min-h-[44px]',
              showError
                ? 'border border-accent-error'
                : 'border border-surface-border'
            )}
            aria-invalid={showError}
            aria-describedby={showError ? 'ignition-required-error' : undefined}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Select on Map
            </span>
          </button>

          {/* Validation error message */}
          {showError && (
            <p
              id="ignition-required-error"
              role="alert"
              className="text-xs text-accent-error"
            >
              Select an ignition point on the map
            </p>
          )}
        </div>
      )}
    </section>
  );
}
