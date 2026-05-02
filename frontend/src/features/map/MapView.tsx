/**
 * MapView Component
 *
 * Central map area displaying the Deck.gl map with terrain and data layers.
 * Integrates Mapbox GL JS for basemap and terrain, with Deck.gl for data overlays.
 *
 * Features:
 * - Dark basemap style (Mapbox dark-v11 or OSM fallback)
 * - Click-to-ignite functionality
 * - Terrain elevation with hillshade
 * - Multiple toggleable data layers
 *
 * @see design.md for map specifications
 */

import { useRef, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map, type MapRef } from 'react-map-gl/mapbox';
import type { PickingInfo } from '@deck.gl/core';
import type { MapMouseEvent } from 'mapbox-gl';

import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';
import { LayerToggle } from '@/components/LayerToggle';
import { useIgnitionMarkerLayer } from './IgnitionMarker';
import { useElevationLayer } from './ElevationLayer';
import { usePerimeterOutlineLayer } from './PerimeterOutline';
import { useShelterMarkersLayers } from './ShelterMarkers';

// Import mapbox-gl CSS
import 'mapbox-gl/dist/mapbox-gl.css';

export interface MapViewProps {
  /** Callback to open the left (control) panel on mobile */
  onOpenLeftPanel: () => void;
  /** Callback to open the right (results) panel on mobile */
  onOpenRightPanel: () => void;
}

// Paradise, CA demo region center
const INITIAL_VIEW_STATE = {
  latitude: 39.7596,
  longitude: -121.6219,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

// Mapbox token from environment
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const HAS_MAPBOX_TOKEN = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.trim() !== '');

// Map styles
const MAPBOX_DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

// OSM fallback style for when no Mapbox token is available
// Using 'as const' to satisfy the strict version type requirement
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export function MapView({ onOpenLeftPanel, onOpenRightPanel }: MapViewProps): React.ReactElement {
  const mapRef = useRef<MapRef | null>(null);
  const {
    state,
    setIgnition,
    toggleLayer,
    setTerrainExaggeration,
  } = useSimulation();

  const { ignitionPoint, visibleLayers, terrainExaggeration } = state;

  // Handle map click for ignition point selection
  const handleMapClick = useCallback(
    (info: PickingInfo) => {
      // Only handle clicks on the map itself, not on layers
      if (info.coordinate) {
        const [lon, lat] = info.coordinate;
        setIgnition({ lat, lon });
      }
    },
    [setIgnition]
  );

  // Alternative click handler for react-map-gl
  const handleMapLayerClick = useCallback(
    (event: MapMouseEvent) => {
      const { lngLat } = event;
      setIgnition({ lat: lngLat.lat, lon: lngLat.lng });
    },
    [setIgnition]
  );

  // Setup elevation layer
  useElevationLayer({
    mapRef,
    exaggeration: terrainExaggeration,
    visible: visibleLayers.elevation,
    hasMapboxToken: HAS_MAPBOX_TOKEN,
  });

  // Create Deck.gl layers
  const ignitionLayer = useIgnitionMarkerLayer({ ignitionPoint });
  const perimeterLayer = usePerimeterOutlineLayer({ visible: visibleLayers.perimeter });
  const shelterLayers = useShelterMarkersLayers({ visible: visibleLayers.shelters });

  // Combine all layers
  const layers = useMemo(() => {
    const allLayers = [];

    // Add perimeter outline (bottom layer)
    if (perimeterLayer) {
      allLayers.push(perimeterLayer);
    }

    // Add shelter markers
    allLayers.push(...shelterLayers);

    // Add ignition marker (top layer)
    if (ignitionLayer) {
      allLayers.push(ignitionLayer);
    }

    return allLayers;
  }, [perimeterLayer, shelterLayers, ignitionLayer]);

  // Determine map style based on token availability
  const mapStyle = HAS_MAPBOX_TOKEN ? MAPBOX_DARK_STYLE : OSM_STYLE;

  return (
    <div className="flex-1 relative bg-surface-base">
      {/* DeckGL Map */}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        onClick={handleMapClick}
        getCursor={() => 'crosshair'}
        style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '0' }}
      >
        <Map
          ref={mapRef}
          mapStyle={mapStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={handleMapLayerClick}
          attributionControl={true}
          reuseMaps
        />
      </DeckGL>

      {/* Layer Toggle Panel */}
      <LayerToggle
        visibleLayers={visibleLayers}
        onToggleLayer={toggleLayer}
        terrainExaggeration={terrainExaggeration}
        onSetTerrainExaggeration={setTerrainExaggeration}
        hasMapboxToken={HAS_MAPBOX_TOKEN}
      />

      {/* Ignition Point Indicator */}
      {ignitionPoint && (
        <div
          className={cn(
            'absolute bottom-4 left-4 z-10',
            'bg-surface-overlay/90 backdrop-blur-sm',
            'border border-surface-border rounded-lg',
            'px-3 py-2'
          )}
        >
          <div className="text-xs text-gray-400 mb-1">Ignition Point</div>
          <div className="font-mono text-sm text-fire-active">
            {ignitionPoint.lat.toFixed(4)}°N, {Math.abs(ignitionPoint.lon).toFixed(4)}°W
          </div>
        </div>
      )}

      {/* Click instruction overlay (shown when no ignition point) */}
      {!ignitionPoint && (
        <div
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
            'bg-surface-overlay/90 backdrop-blur-sm',
            'border border-surface-border rounded-lg',
            'px-4 py-2',
            'text-sm text-gray-300',
            'animate-fade-in'
          )}
        >
          Click on the map to set ignition point
        </div>
      )}

      {/* OSM fallback notice */}
      {!HAS_MAPBOX_TOKEN && (
        <div
          className={cn(
            'absolute top-4 left-4 z-10',
            'bg-accent-warning/10 border border-accent-warning/30',
            'rounded-lg px-3 py-2',
            'text-xs text-accent-warning'
          )}
        >
          Using OSM tiles (no Mapbox token)
        </div>
      )}

      {/* Mobile toggle button - Left (Control Panel) */}
      <button
        type="button"
        onClick={onOpenLeftPanel}
        className={cn(
          'lg:hidden absolute top-1/2 left-0 z-10 -translate-y-1/2',
          'p-2 bg-surface-raised border border-surface-border rounded-r-lg',
          'text-gray-400 hover:text-gray-200 hover:bg-surface-hover',
          'transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'
        )}
        aria-label="Open control panel"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Mobile toggle button - Right (Results Panel) */}
      <button
        type="button"
        onClick={onOpenRightPanel}
        className={cn(
          'lg:hidden absolute top-1/2 right-0 z-10 -translate-y-1/2',
          'p-2 bg-surface-raised border border-surface-border rounded-l-lg',
          'text-gray-400 hover:text-gray-200 hover:bg-surface-hover',
          'transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'
        )}
        aria-label="Open results panel"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
}
