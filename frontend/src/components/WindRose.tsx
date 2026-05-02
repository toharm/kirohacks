/**
 * WindRose Component
 *
 * Compact compass display showing wind direction with an arrow,
 * plus speed/gust/humidity labels.
 *
 * @see design.md for WindRose specifications
 */

import { cn } from '@/lib/cn';
import { useSimulation } from '@/hooks/useSimulation';

export function WindRose(): React.ReactElement {
  const { state } = useSimulation();
  const { windParams } = state;
  const isLive = windParams.source === 'nws';

  return (
    <div
      className={cn(
        'w-10 h-10 relative flex items-center justify-center',
        isLive && 'shadow-glow-safe rounded-full'
      )}
      title={`Wind: ${windParams.speed} mph @ ${windParams.direction}°`}
    >
      {/* Compass background */}
      <div className="absolute inset-0 rounded-full border border-surface-border bg-surface-overlay/50" />

      {/* Direction arrow */}
      <svg
        className="w-6 h-6 transition-transform duration-500"
        style={{ transform: `rotate(${windParams.direction}deg)` }}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 4L8 12H11V20H13V12H16L12 4Z"
          fill="currentColor"
          className="text-route-safe"
        />
      </svg>

      {/* Cardinal directions */}
      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] font-mono text-gray-500">
        N
      </span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] font-mono text-gray-500">
        S
      </span>
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[8px] font-mono text-gray-500">
        W
      </span>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[8px] font-mono text-gray-500">
        E
      </span>
    </div>
  );
}
