/**
 * PerimeterOutline Component
 *
 * Deck.gl GeoJsonLayer for displaying the Camp Fire perimeter outline.
 * Uses dashed orange stroke for visual distinction.
 *
 * @see design.md for perimeter styling specifications
 */

import { GeoJsonLayer } from '@deck.gl/layers';
import type { Feature, Polygon } from 'geojson';

import campFirePerimeter from '@/assets/mock/campFirePerimeter.json';

export interface PerimeterOutlineProps {
  /** Whether the perimeter layer is visible */
  visible: boolean;
}

interface PerimeterFeature extends Feature<Polygon> {
  properties: {
    IncidentName: string;
    GISAcres: number;
    PerimeterDateTime: string;
    IncidentTypeCategory: string;
  };
}

interface PerimeterData {
  type: 'FeatureCollection';
  features: PerimeterFeature[];
}

/**
 * Creates a Deck.gl GeoJsonLayer for the fire perimeter outline
 */
export function usePerimeterOutlineLayer({ visible }: PerimeterOutlineProps): GeoJsonLayer | null {
  if (!visible) {
    return null;
  }

  const data = campFirePerimeter as PerimeterData;

  return new GeoJsonLayer({
    id: 'perimeter-outline',
    data: data,
    pickable: true,
    stroked: true,
    filled: false,
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 4,
    getLineColor: [255, 107, 53, 180], // fire-active color with alpha
    getLineWidth: 3,
    // Dashed line effect using extensions
    getDashArray: [8, 4],
    dashJustified: true,
    dashGapPickable: false,
    extensions: [],
  });
}

/**
 * PerimeterOutline component (returns null, layer is used via hook)
 */
export function PerimeterOutline(_props: PerimeterOutlineProps): null {
  return null;
}

/**
 * Get the perimeter data for external use
 */
export function getPerimeterData(): PerimeterData {
  return campFirePerimeter as PerimeterData;
}
