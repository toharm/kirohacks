/**
 * ShelterMarkers Component
 *
 * Deck.gl ScatterplotLayer and TextLayer for displaying shelter locations.
 * Uses distinct blue markers (route-safe color) with capacity labels.
 *
 * @see design.md for shelter marker specifications
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';

import sheltersData from '@/assets/mock/shelters.json';

export interface Shelter {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  accessibility: boolean;
  type: string;
}

export interface ShelterMarkersProps {
  /** Whether the shelter markers are visible */
  visible: boolean;
}

/**
 * Creates Deck.gl layers for shelter markers and labels
 */
export function useShelterMarkersLayers({ visible }: ShelterMarkersProps): Layer[] {
  if (!visible) {
    return [];
  }

  const shelters: Shelter[] = sheltersData.shelters;

  const markerLayer = new ScatterplotLayer({
    id: 'shelter-markers',
    data: shelters,
    pickable: true,
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusMinPixels: 8,
    radiusMaxPixels: 16,
    lineWidthMinPixels: 2,
    getPosition: (d: Shelter) => [d.lon, d.lat],
    getRadius: 300, // 300 meters base radius
    getFillColor: [0, 229, 255, 200], // route-safe color (#00E5FF) with alpha
    getLineColor: [255, 255, 255, 255], // white stroke
  });

  const labelLayer = new TextLayer({
    id: 'shelter-labels',
    data: shelters,
    pickable: false,
    getPosition: (d: Shelter) => [d.lon, d.lat],
    getText: (d: Shelter) => `${d.capacity.toLocaleString()}`,
    getSize: 12,
    getColor: [255, 255, 255, 255],
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top',
    getPixelOffset: [0, 16], // Offset below the marker
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    background: true,
    getBackgroundColor: [17, 24, 39, 200], // surface-raised with alpha
    backgroundPadding: [4, 2],
  });

  return [markerLayer, labelLayer];
}

/**
 * ShelterMarkers component (returns null, layers are used via hook)
 */
export function ShelterMarkers(_props: ShelterMarkersProps): null {
  return null;
}

/**
 * Get shelter data for external use
 */
export function getShelterData(): Shelter[] {
  return sheltersData.shelters;
}
