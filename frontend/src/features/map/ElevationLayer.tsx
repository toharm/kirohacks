/**
 * ElevationLayer Component
 *
 * Configures Mapbox terrain DEM source and hillshade layer for elevation visualization.
 * Supports terrain exaggeration control (1.0-3.0).
 *
 * @see design.md for elevation layer specifications
 */

import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';

export interface ElevationLayerProps {
  /** Reference to the Mapbox map instance */
  mapRef: React.RefObject<MapRef | null>;
  /** Terrain exaggeration factor (1.0-3.0) */
  exaggeration: number;
  /** Whether elevation layer is visible */
  visible: boolean;
  /** Whether Mapbox token is available */
  hasMapboxToken: boolean;
}

/**
 * Hook to manage Mapbox terrain DEM and hillshade layers
 */
export function useElevationLayer({
  mapRef,
  exaggeration,
  visible,
  hasMapboxToken,
}: ElevationLayerProps): void {
  const isSetupRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !hasMapboxToken) return;

    const setupTerrain = (): void => {
      if (isSetupRef.current) return;

      try {
        // Add terrain DEM source if not exists
        if (!map.getSource('mapbox-dem')) {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          });
        }

        // Add hillshade layer for visual depth if not exists
        if (!map.getLayer('hillshade')) {
          map.addLayer(
            {
              id: 'hillshade',
              source: 'mapbox-dem',
              type: 'hillshade',
              paint: {
                'hillshade-exaggeration': 0.5,
                'hillshade-shadow-color': '#000000',
                'hillshade-highlight-color': '#ffffff',
                'hillshade-accent-color': '#374151',
              },
            },
            // Insert below labels
            map.getStyle()?.layers?.find((l: { type: string }) => l.type === 'symbol')?.id
          );
        }

        isSetupRef.current = true;
      } catch (error) {
        console.warn('Failed to setup terrain:', error);
      }
    };

    // Wait for map style to load
    if (map.isStyleLoaded()) {
      setupTerrain();
    } else {
      map.once('style.load', setupTerrain);
    }

    return () => {
      // Cleanup is handled by map destruction
    };
  }, [mapRef, hasMapboxToken]);

  // Update terrain visibility and exaggeration
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !hasMapboxToken || !isSetupRef.current) return;

    try {
      if (visible) {
        map.setTerrain({
          source: 'mapbox-dem',
          exaggeration: exaggeration,
        });

        // Show hillshade
        if (map.getLayer('hillshade')) {
          map.setLayoutProperty('hillshade', 'visibility', 'visible');
        }
      } else {
        // Disable terrain
        map.setTerrain(null);

        // Hide hillshade
        if (map.getLayer('hillshade')) {
          map.setLayoutProperty('hillshade', 'visibility', 'none');
        }
      }
    } catch (error) {
      console.warn('Failed to update terrain:', error);
    }
  }, [mapRef, exaggeration, visible, hasMapboxToken]);
}

/**
 * ElevationLayer component (returns null, uses hook for side effects)
 */
export function ElevationLayer(_props: ElevationLayerProps): null {
  return null;
}
