/**
 * LayerToggle Component
 *
 * Floating panel for toggling map layer visibility and terrain exaggeration.
 * Positioned in the top-right corner of the map.
 *
 * @see design.md for layer toggle specifications
 */

import { cn } from '@/lib/cn';
import type { VisibleLayers } from '@/context/SimulationContext';

export interface LayerToggleProps {
  /** Current layer visibility state */
  visibleLayers: VisibleLayers;
  /** Callback to toggle a layer */
  onToggleLayer: (layer: keyof VisibleLayers) => void;
  /** Current terrain exaggeration value */
  terrainExaggeration: number;
  /** Callback to set terrain exaggeration */
  onSetTerrainExaggeration: (value: number) => void;
  /** Whether Mapbox token is available (elevation requires it) */
  hasMapboxToken: boolean;
}

interface LayerOption {
  key: keyof VisibleLayers;
  label: string;
  description?: string;
}

const LAYER_OPTIONS: LayerOption[] = [
  { key: 'burnHeatmap', label: 'Burn Heatmap', description: 'Fire probability overlay' },
  { key: 'routes', label: 'Routes', description: 'Evacuation routes' },
  { key: 'zones', label: 'Zones', description: 'Census block groups' },
  { key: 'elevation', label: 'Elevation', description: '3D terrain' },
  { key: 'shelters', label: 'Shelters', description: 'Shelter locations' },
  { key: 'perimeter', label: 'Perimeter', description: 'Fire perimeter outline' },
];

export function LayerToggle({
  visibleLayers,
  onToggleLayer,
  terrainExaggeration,
  onSetTerrainExaggeration,
  hasMapboxToken,
}: LayerToggleProps): React.ReactElement {
  return (
    <div
      className={cn(
        'absolute top-4 right-4 z-10',
        'bg-surface-overlay/90 backdrop-blur-sm',
        'border border-surface-border rounded-lg',
        'p-3 space-y-3',
        'min-w-[180px]'
      )}
    >
      {/* Header */}
      <div className="text-xs uppercase tracking-wider text-gray-400 font-medium">
        Map Layers
      </div>

      {/* Layer checkboxes */}
      <div className="space-y-2">
        {LAYER_OPTIONS.map((option) => {
          const isElevation = option.key === 'elevation';
          const isDisabled = isElevation && !hasMapboxToken;

          return (
            <label
              key={option.key}
              className={cn(
                'flex items-center gap-2 cursor-pointer group',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
              title={isDisabled ? 'Elevation requires a Mapbox token' : option.description}
            >
              <input
                type="checkbox"
                checked={visibleLayers[option.key]}
                onChange={() => !isDisabled && onToggleLayer(option.key)}
                disabled={isDisabled}
                className={cn(
                  'w-4 h-4 rounded border-surface-border',
                  'bg-surface-base text-accent-primary',
                  'focus:ring-accent-primary focus:ring-offset-0 focus:ring-1',
                  'disabled:cursor-not-allowed'
                )}
              />
              <span
                className={cn(
                  'text-sm text-gray-300',
                  'group-hover:text-gray-100 transition-colors',
                  isDisabled && 'text-gray-500'
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      {/* Terrain exaggeration slider */}
      <div
        className={cn(
          'pt-2 border-t border-surface-border',
          !hasMapboxToken && 'opacity-50'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Terrain Exaggeration</span>
          <span className="text-xs font-mono text-gray-300">
            {terrainExaggeration.toFixed(1)}×
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.5}
          value={terrainExaggeration}
          onChange={(e) => onSetTerrainExaggeration(parseFloat(e.target.value))}
          disabled={!hasMapboxToken}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer',
            'bg-surface-base',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-accent-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:h-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-accent-primary',
            '[&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:cursor-pointer',
            'disabled:cursor-not-allowed',
            'disabled:[&::-webkit-slider-thumb]:bg-gray-500',
            'disabled:[&::-moz-range-thumb]:bg-gray-500'
          )}
          title={!hasMapboxToken ? 'Elevation requires a Mapbox token' : undefined}
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>1×</span>
          <span>2×</span>
          <span>3×</span>
        </div>
      </div>

      {/* No Mapbox token warning */}
      {!hasMapboxToken && (
        <div className="text-[10px] text-accent-warning bg-accent-warning/10 rounded px-2 py-1">
          Elevation disabled: No Mapbox token
        </div>
      )}
    </div>
  );
}
