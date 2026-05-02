/**
 * ResultsPanel Component (Stub)
 *
 * Right sidebar displaying simulation results.
 * Desktop: Static sidebar, Mobile: Overlay drawer.
 *
 * Will contain:
 * - KeyMetricCard
 * - ComparisonView
 * - ZoneEvacuationTable
 * - EvacuationOrdering
 * - SummaryStatistics
 *
 * @see design.md for layout specifications
 */

import { cn } from '@/lib/cn';

export interface ResultsPanelProps {
  /** Whether the mobile drawer is open */
  isOpen: boolean;
  /** Callback to close the mobile drawer */
  onClose: () => void;
}

export function ResultsPanel({ isOpen, onClose }: ResultsPanelProps): React.ReactElement {
  return (
    <>
      {/* Desktop: Static sidebar */}
      <aside
        className={cn(
          'w-96 shrink-0 bg-surface-raised border-l border-surface-border',
          'overflow-y-auto p-4 space-y-4',
          'hidden lg:flex lg:flex-col'
        )}
      >
        <ResultsPanelContent />
      </aside>

      {/* Mobile: Overlay drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 right-0 z-20 w-96 max-w-full',
          'bg-surface-raised border-l border-surface-border',
          'overflow-y-auto p-4 space-y-4',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Close button for mobile */}
        <div className="flex justify-start mb-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'p-2 rounded-md text-gray-400 hover:text-gray-200',
              'hover:bg-surface-hover transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'
            )}
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

/**
 * Shared content for both desktop and mobile views
 */
function ResultsPanelContent(): React.ReactElement {
  return (
    <div className="space-y-4">
      {/* Placeholder header */}
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
        Simulation Results
      </h2>

      {/* Placeholder - No results state */}
      <div className="bg-surface-overlay border border-surface-border rounded-lg p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-base border border-surface-border flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-gray-400 text-sm">No results yet</p>
        <p className="text-gray-500 text-xs mt-1">Run a simulation to see results</p>
      </div>

      {/* Placeholder sections - will be replaced with actual components */}
      <PlaceholderSection title="Key Metrics" />
      <PlaceholderSection title="Comparison" />
      <PlaceholderSection title="Zone Table" />
      <PlaceholderSection title="Evacuation Order" />
    </div>
  );
}

/**
 * Placeholder section component
 */
function PlaceholderSection({ title }: { title: string }): React.ReactElement {
  return (
    <div className="bg-surface-overlay border border-surface-border rounded-lg p-3 opacity-50">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">{title}</p>
      <p className="text-sm text-gray-400">Placeholder content</p>
    </div>
  );
}
