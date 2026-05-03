/**
 * ShelterMarkers — Deck.gl layers for shelter locations.
 * Fetches from live API, re-fetches when region changes.
 */

import { useState, useEffect } from 'react';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { getApi } from '@/services/api';
import { useSimulation } from '@/hooks/useSimulation';
import type { ShelterData } from '@/types/api';

export interface ShelterMarkersProps {
  visible: boolean;
}

export function useShelterMarkersLayers({ visible }: ShelterMarkersProps): Layer[] {
  const { state } = useSimulation();
  const [shelters, setShelters] = useState<ShelterData[]>([]);
  const region = state.selectedRegion;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getApi()
      .then((api) => api.getShelters(region ?? undefined))
      .then((data) => { if (!cancelled) setShelters(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, region]);

  if (!visible || shelters.length === 0) return [];

  return [
    new ScatterplotLayer({
      id: 'shelter-markers',
      data: shelters,
      pickable: true,
      opacity: 0.9,
      stroked: true,
      filled: true,
      radiusMinPixels: 8,
      radiusMaxPixels: 16,
      lineWidthMinPixels: 2,
      getPosition: (d: ShelterData) => [d.lon, d.lat],
      getRadius: 300,
      getFillColor: [0, 229, 255, 200],
      getLineColor: [255, 255, 255, 255],
    }),
    new TextLayer({
      id: 'shelter-labels',
      data: shelters,
      pickable: false,
      getPosition: (d: ShelterData) => [d.lon, d.lat],
      getText: (d: ShelterData) => `${d.capacity.toLocaleString()}`,
      getSize: 12,
      getColor: [255, 255, 255, 255],
      getAngle: 0,
      getTextAnchor: 'middle' as const,
      getAlignmentBaseline: 'top' as const,
      getPixelOffset: [0, 16],
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 600,
      background: true,
      getBackgroundColor: [17, 24, 39, 200],
      backgroundPadding: [4, 2],
    }),
  ];
}
