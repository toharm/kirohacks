/**
 * IgnitionMarker Component
 *
 * Deck.gl ScatterplotLayer for displaying the ignition point with pulsing animation.
 * Uses requestAnimationFrame for smooth radius animation.
 *
 * @see design.md for color specifications
 */

import { useEffect, useState, useRef } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';

export interface IgnitionMarkerProps {
  /** Ignition point coordinates */
  ignitionPoint: { lat: number; lon: number } | null;
}

/**
 * Creates a Deck.gl ScatterplotLayer for the ignition marker with pulsing animation
 */
export function useIgnitionMarkerLayer({ ignitionPoint }: IgnitionMarkerProps): ScatterplotLayer | null {
  const [radiusScale, setRadiusScale] = useState(1);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!ignitionPoint) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    startTimeRef.current = performance.now();

    const animate = (currentTime: number): void => {
      const elapsed = currentTime - startTimeRef.current;
      // Pulse between 0.8 and 1.2 over 1 second
      const pulse = 1 + 0.2 * Math.sin((elapsed / 1000) * Math.PI * 2);
      setRadiusScale(pulse);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [ignitionPoint]);

  if (!ignitionPoint) {
    return null;
  }

  return new ScatterplotLayer({
    id: 'ignition-marker',
    data: [ignitionPoint],
    pickable: true,
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusScale: radiusScale,
    radiusMinPixels: 12,
    radiusMaxPixels: 30,
    lineWidthMinPixels: 2,
    getPosition: (d: { lat: number; lon: number }) => [d.lon, d.lat],
    getRadius: 500, // 500 meters base radius
    getFillColor: [255, 107, 53, 200], // fire-active color with alpha
    getLineColor: [255, 255, 255, 255], // white stroke
    updateTriggers: {
      radiusScale: radiusScale,
    },
  });
}

/**
 * IgnitionMarker component for use in JSX (returns null, layer is used via hook)
 */
export function IgnitionMarker(_props: IgnitionMarkerProps): null {
  // This component doesn't render anything directly
  // Use the useIgnitionMarkerLayer hook to get the Deck.gl layer
  return null;
}
