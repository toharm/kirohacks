/**
 * AnimationTimeline
 *
 * Bottom bar for controlling fire spread animation playback.
 * Shows play/pause, scrubber, step buttons, and speed selector.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = typeof SPEEDS[number];

const MAX_TIMESTEP = 70;

export function AnimationTimeline(): React.ReactElement {
  const { state, setAnimationTimestep, toggleAnimation } = useSimulation();
  const { animationTimestep, isAnimating, currentResults } = state;

  // Derive zone cutoffs from simulation results
  const zoneCutoffs = useMemo(() => {
    if (!currentResults?.zones?.features) return [];
    return currentResults.zones.features
      .map((f) => ({ zone_id: f.properties.zone_id, cutoff_time: f.properties.cutoff_time }))
      .filter((z) => z.cutoff_time < 999)
      .sort((a, b) => a.cutoff_time - b.cutoff_time);
  }, [currentResults]);

  const [speed, setSpeed] = useState<Speed>(1);
  const speedRef = useRef<Speed>(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const timestepRef = useRef(animationTimestep);

  // Keep ref in sync with state
  timestepRef.current = animationTimestep;
  speedRef.current = speed;

  useEffect(() => {
    if (!isAnimating) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const next = Math.min(MAX_TIMESTEP, timestepRef.current + delta * speedRef.current);
      setAnimationTimestep(next);

      if (next < MAX_TIMESTEP) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        toggleAnimation(); // stop at end
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating]);

  const progress = animationTimestep / MAX_TIMESTEP;

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-10',
        'lg:left-80 lg:right-96',
        'bg-surface-overlay/90 backdrop-blur-sm',
        'border-t border-surface-border',
        'p-3 flex items-center gap-3'
      )}
    >
      {/* Play/Pause */}
      <button
        type="button"
        onClick={toggleAnimation}
        className={cn(
          'w-8 h-8 rounded-full bg-fire-active flex items-center justify-center shrink-0',
          'hover:opacity-90 transition-opacity',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary'
        )}
        aria-label={isAnimating ? 'Pause animation' : 'Play animation'}
      >
        {isAnimating ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Step back */}
      <button
        type="button"
        onClick={() => setAnimationTimestep(Math.max(0, animationTimestep - 5))}
        className="text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
        aria-label="Step back 5 minutes"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Scrubber */}
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={MAX_TIMESTEP}
          step={0.5}
          value={animationTimestep}
          onChange={(e) => setAnimationTimestep(parseFloat(e.target.value))}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer bg-surface-base',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3',
            '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-fire-active [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3',
            '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fire-active',
            '[&::-moz-range-thumb]:border-0'
          )}
          style={{
            background: `linear-gradient(to right, #FF6B35 ${progress * 100}%, #374151 ${progress * 100}%)`,
          }}
          aria-label="Animation timeline"
        />
        {/* Zone cutoff markers */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none">
          {zoneCutoffs.map(({ zone_id, cutoff_time }) => (
            <div
              key={zone_id}
              className="absolute flex flex-col items-center"
              style={{ left: `${(cutoff_time / MAX_TIMESTEP) * 100}%` }}
            >
              <div className="w-px h-2 bg-gray-500 -mt-1" />
              <span className="text-[10px] text-gray-500 whitespace-nowrap">{zone_id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step forward */}
      <button
        type="button"
        onClick={() => setAnimationTimestep(Math.min(MAX_TIMESTEP, animationTimestep + 5))}
        className="text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
        aria-label="Step forward 5 minutes"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
        </svg>
      </button>

      {/* Time display */}
      <span className="font-mono text-xs text-gray-300 shrink-0 w-12 text-right">
        {Math.round(animationTimestep)}m
      </span>

      {/* Speed selector */}
      <div className="flex gap-1 shrink-0">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={cn(
              'text-xs px-1.5 py-0.5 rounded transition-colors',
              speed === s
                ? 'bg-fire-active/30 text-fire-active'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
