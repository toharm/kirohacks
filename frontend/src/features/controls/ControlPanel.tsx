/**
 * ControlPanel Component
 *
 * Left sidebar containing simulation controls.
 * Desktop: Static sidebar, Mobile: Overlay drawer.
 *
 * Coordinates validation state across WindSection, IgnitionSection,
 * and RunButton so that attempting to run with invalid inputs highlights
 * the relevant sections.
 *
 * @see design.md for layout specifications
 * @see requirements.md Requirement 3, AC 8
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { IgnitionSection } from './IgnitionSection';
import { WindSection } from './WindSection';
import { ScenarioSelector } from './ScenarioSelector';
import { MonteCarloSlider } from './MonteCarloSlider';
import { RunButton } from './RunButton';

export interface ControlPanelProps {
  /** Whether the mobile drawer is open */
  isOpen: boolean;
  /** Callback to close the mobile drawer */
  onClose: () => void;
}

export function ControlPanel({ isOpen, onClose }: ControlPanelProps): React.ReactElement {
  return (
    <>
      {/* Desktop: Static sidebar */}
      <aside
        className={cn(
          'w-80 shrink-0 bg-surface-raised border-r border-surface-border',
          'overflow-y-auto p-4 space-y-4',
          'hidden lg:flex lg:flex-col'
        )}
      >
        <ControlPanelContent />
      </aside>

      {/* Mobile: Overlay drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-20 w-80',
          'bg-surface-raised border-r border-surface-border',
          'overflow-y-auto p-4 space-y-4',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button for mobile */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'p-2 rounded-md text-gray-400 hover:text-gray-200',
              'hover:bg-surface-hover transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'
            )}
            aria-label="Close control panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ControlPanelContent />
      </div>
    </>
  );
}

/**
 * Shared content for both desktop and mobile views.
 *
 * Manages validation state: tracks whether wind inputs have errors and
 * whether the user has attempted to run without an ignition point, so
 * that IgnitionSection can show its required-error state.
 */
function ControlPanelContent(): React.ReactElement {
  // Whether wind section currently has validation errors
  const [hasWindErrors, setHasWindErrors] = useState(false);

  // Whether the user clicked Run without an ignition point (triggers error display)
  const [showIgnitionError, setShowIgnitionError] = useState(false);

  /**
   * Called by WindSection whenever its validation state changes.
   */
  const handleWindValidationChange = useCallback((hasErrors: boolean) => {
    setHasWindErrors(hasErrors);
  }, []);

  /**
   * Called by RunButton when the user clicks Run but validation fails.
   * Triggers the ignition required error display.
   */
  const handleValidationAttempt = useCallback(() => {
    setShowIgnitionError(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Placeholder header */}
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
        Simulation Controls
      </h2>

      {/* Ignition point selection — shows error when run attempted without point */}
      <IgnitionSection showRequiredError={showIgnitionError} />

      {/* Wind parameters — reports validation errors up */}
      <WindSection onValidationChange={handleWindValidationChange} />

      {/* Scenario presets */}
      <ScenarioSelector />

      {/* Monte Carlo runs slider */}
      <MonteCarloSlider />

      {/* Run simulation button — disabled when validation fails */}
      <RunButton
        hasWindErrors={hasWindErrors}
        onValidationAttempt={handleValidationAttempt}
      />
    </div>
  );
}
