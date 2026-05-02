/**
 * ResultsPanel — right sidebar displaying simulation results
 */

import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';
import { MetricCard } from '@/components/MetricCard';
import { ComparisonView } from './ComparisonView';
import { ZoneEvacuationTable } from './ZoneEvacuationTable';
import { EvacuationOrdering } from './EvacuationOrdering';
import { SummaryStatistics } from './SummaryStatistics';
import { RouteCard } from './RouteCard';

export interface ResultsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResultsPanel({ isOpen, onClose }: ResultsPanelProps): React.ReactElement {
  return (
    <>
      {/* Desktop */}
      <aside className={cn('w-96 shrink-0 bg-surface-raised border-l border-surface-border', 'overflow-y-auto p-4 space-y-4', 'hidden lg:flex lg:flex-col')}>
        <ResultsPanelContent />
      </aside>

      {/* Mobile drawer */}
      <div className={cn('lg:hidden fixed inset-y-0 right-0 z-20 w-96 max-w-full', 'bg-surface-raised border-l border-surface-border', 'overflow-y-auto p-4 space-y-4', 'transform transition-transform duration-300 ease-in-out', isOpen ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex justify-start mb-2">
          <button
            type="button"
            onClick={onClose}
            className={cn('p-2 rounded-md text-gray-400 hover:text-gray-200', 'hover:bg-surface-hover transition-colors', 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary')}
            aria-label="Close results panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ResultsPanelContent />
      </div>
    </>
  );
}

function ResultsPanelContent(): React.ReactElement {
  const { state, selectZone, selectedZoneRoutes, storePreviousResults, setWind } = useSimulation();
  const { currentResults, selectedZoneId } = state;

  if (!currentResults) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Simulation Results</h2>
        <div className="bg-surface-overlay border border-surface-border rounded-lg p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-base border border-surface-border flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">No results yet</p>
          <p className="text-gray-500 text-xs mt-1">Run a simulation to see results</p>
        </div>
      </div>
    );
  }

  const { routes, zones, evacuation_ordering } = currentResults;

  // Best optimized route overall
  const bestRoute = routes
    .filter((r) => r.strategy === 'optimized')
    .sort((a, b) => b.viability_score - a.viability_score)[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Simulation Results</h2>
        {/* Quick Compare button */}
        <button
          type="button"
          onClick={() => {
            storePreviousResults();
            setWind({ direction: (state.windParams.direction + 45) % 360 });
          }}
          className={cn('text-xs text-accent-primary hover:text-accent-primary-hover transition-colors', 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary')}
          title="Store current results and shift wind +45° for comparison"
        >
          Quick Compare
        </button>
      </div>

      {/* Key metric */}
      {bestRoute && (
        <MetricCard
          label={`Route ${bestRoute.route_id} survives in`}
          value={bestRoute.viability_score}
          unit="% of scenarios"
          color="text-route-safe"
          size="lg"
        />
      )}

      <SummaryStatistics results={currentResults} />
      <ComparisonView results={currentResults} />

      {/* Selected zone routes */}
      {selectedZoneId && selectedZoneRoutes.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Routes for {selectedZoneId}</div>
          <div className="space-y-2">
            {selectedZoneRoutes.map((route) => (
              <RouteCard
                key={route.route_id}
                route={route}
                onShowOnMap={() => selectZone(route.zone_id)}
              />
            ))}
          </div>
        </div>
      )}

      <ZoneEvacuationTable
        zones={zones.features}
        selectedZoneId={selectedZoneId}
        onSelectZone={selectZone}
      />

      <EvacuationOrdering ordering={evacuation_ordering} />
    </div>
  );
}
