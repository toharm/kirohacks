/**
 * ScenarioSelector Component
 *
 * Fetches and displays scenario presets as selectable cards.
 * Selecting a scenario auto-fills ignition point and wind parameters.
 *
 * @see requirements.md Requirement 3: Simulation Control Panel
 * @see design.md for styling specifications
 */

import { useEffect, useState, useCallback } from 'react';

import { cn } from '@/lib/cn';
import { getApi } from '@/services/api';
import { useSimulation } from '@/hooks/useSimulation';
import type { ScenarioPreset } from '@/types/api';

// ============================================================================
// Component
// ============================================================================

export function ScenarioSelector(): React.ReactElement {
  const { state, applyScenario, setScenario } = useSimulation();
  const [scenarios, setScenarios] = useState<ScenarioPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedRegion = state.selectedRegion;

  // Re-fetch scenarios when region changes
  useEffect(() => {
    let isMounted = true;

    async function fetchScenarios(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);
        const api = await getApi();
        const data = await api.getScenarios(selectedRegion ?? undefined);
        if (isMounted) {
          setScenarios(data);
          setScenario(null); // clear selection when region changes
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load scenarios');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchScenarios();
    return () => { isMounted = false; };
  }, [selectedRegion, setScenario]);

  // Handle scenario selection
  const handleSelectScenario = useCallback(
    (scenario: ScenarioPreset) => {
      // If already selected, deselect
      if (state.selectedScenario === scenario.name) {
        setScenario(null);
      } else {
        applyScenario(scenario);
      }
    },
    [state.selectedScenario, applyScenario, setScenario]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, scenario: ScenarioPreset) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSelectScenario(scenario);
      }
    },
    [handleSelectScenario]
  );

  return (
    <section className="space-y-2">
      {/* Section header */}
      <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium">
        Scenario Presets
      </h3>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'bg-surface-overlay border border-surface-border rounded-lg p-3',
                'animate-pulse'
              )}
            >
              <div className="h-4 bg-surface-hover rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-hover rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div
          className={cn(
            'bg-surface-overlay border border-accent-error/30 rounded-lg p-3',
            'text-sm text-accent-error'
          )}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Scenario cards */}
      {!isLoading && !error && scenarios.length > 0 && (
        <div className="space-y-2">
          {scenarios.map((scenario) => {
            const isSelected = state.selectedScenario === scenario.name;

            return (
              <div
                key={scenario.name}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectScenario(scenario)}
                onKeyDown={(e) => handleKeyDown(e, scenario)}
                className={cn(
                  'bg-surface-overlay hover:bg-surface-hover',
                  'border border-surface-border rounded-lg p-3',
                  'cursor-pointer transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary',
                  isSelected && 'ring-2 ring-accent-primary'
                )}
                aria-pressed={isSelected}
                aria-label={`${scenario.name} scenario${isSelected ? ' (selected)' : ''}`}
              >
                {/* Scenario name */}
                <p className="text-sm font-medium text-gray-200">
                  {scenario.name}
                </p>

                {/* Scenario description */}
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {scenario.description}
                </p>

                {/* Wind summary when selected */}
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-surface-border">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-gray-500">
                      <span>
                        Wind: {scenario.wind_speed} mph @ {scenario.wind_direction}°
                      </span>
                      <span>Gust: {scenario.wind_gust} mph</span>
                      <span>RH: {scenario.relative_humidity}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && scenarios.length === 0 && (
        <div
          className={cn(
            'bg-surface-overlay border border-surface-border rounded-lg p-3',
            'text-sm text-gray-400 text-center'
          )}
        >
          No scenarios available
        </div>
      )}
    </section>
  );
}
