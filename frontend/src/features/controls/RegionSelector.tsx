/**
 * RegionSelector — region dropdown + "Add New Region" ingest form.
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { getApi } from '@/services/api';
import { useSimulation } from '@/hooks/useSimulation';

export function RegionSelector(): React.ReactElement {
  const { state, setRegion } = useSimulation();
  const [regions, setRegions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showIngest, setShowIngest] = useState(false);

  const loadRegions = useCallback(async () => {
    try {
      const api = await getApi();
      const data = await api.getRegions();
      setRegions(data);
    } catch {
      setFetchError('Failed to load regions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRegions(); }, [loadRegions]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setRegion(e.target.value || null);
    },
    [setRegion],
  );

  function formatSlug(slug: string): string {
    return slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Region</h3>
        <button
          type="button"
          onClick={() => setShowIngest(!showIngest)}
          className="text-[10px] text-accent-primary hover:text-accent-primary-hover transition-colors"
        >
          {showIngest ? 'Cancel' : '+ New Region'}
        </button>
      </div>

      {fetchError ? (
        <div className="bg-surface-overlay border border-accent-error/30 rounded-lg p-3 text-sm text-accent-error" role="alert">
          {fetchError}
        </div>
      ) : (
        <select
          value={state.selectedRegion ?? ''}
          onChange={handleChange}
          disabled={isLoading}
          aria-label="Select region"
          className={cn(
            'w-full bg-surface-base border border-surface-border rounded-md',
            'px-3 py-2 text-sm text-gray-200',
            'focus:outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150',
          )}
        >
          <option value="">{isLoading ? 'Loading regions…' : '— Select a region —'}</option>
          {regions.map((slug) => (
            <option key={slug} value={slug}>{formatSlug(slug)}</option>
          ))}
        </select>
      )}

      {showIngest && (
        <IngestForm
          onComplete={() => {
            setShowIngest(false);
            loadRegions();
          }}
        />
      )}
    </section>
  );
}

function IngestForm({ onComplete }: { onComplete: () => void }): React.ReactElement {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState('10');
  const [status, setStatus] = useState<'idle' | 'generating' | 'polling' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const { setRegion } = useSimulation();

  const isValid = lat !== '' && lon !== '' && !isNaN(+lat) && !isNaN(+lon) && +lat >= 18 && +lat <= 72 && +lon >= -180 && +lon <= -65;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setStatus('generating');
    setError(null);

    try {
      const api = await getApi();
      await api.ingest(+lat, +lon, +radius);
      setStatus('polling');

      // Poll /api/regions until the new region appears
      const startRegions = await api.getRegions();
      const startCount = startRegions.length;

      for (let i = 0; i < 120; i++) { // poll for up to 10 min
        await new Promise((r) => setTimeout(r, 5000));
        const current = await api.getRegions();
        const newRegion = current.find((r) => !startRegions.includes(r));
        if (newRegion || current.length > startCount) {
          setStatus('done');
          if (newRegion) setRegion(newRegion);
          onComplete();
          return;
        }
      }
      setStatus('error');
      setError('Generation timed out. Check server logs.');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Ingest failed');
    }
  }, [lat, lon, radius, isValid, setRegion, onComplete]);

  const statusText: Record<string, string> = {
    idle: '',
    generating: 'Submitting…',
    polling: 'Generating region data (this takes a few minutes)…',
    done: 'Done!',
    error: error ?? 'Failed',
  };

  return (
    <div className="bg-surface-overlay border border-surface-border rounded-lg p-3 space-y-3">
      <p className="text-xs text-gray-400">
        Generate real data for a US location from LANDFIRE, Census, and OSM.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Latitude</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="34.05"
            className={cn(
              'w-full bg-surface-base border border-surface-border rounded-md',
              'px-2 py-1.5 text-sm text-gray-200 font-mono',
              'focus:outline-none focus:ring-1 focus:ring-accent-primary',
            )}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Longitude</label>
          <input
            type="number"
            step="any"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            placeholder="-118.24"
            className={cn(
              'w-full bg-surface-base border border-surface-border rounded-md',
              'px-2 py-1.5 text-sm text-gray-200 font-mono',
              'focus:outline-none focus:ring-1 focus:ring-accent-primary',
            )}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-gray-500">Radius (km)</label>
        <input
          type="range"
          min="1"
          max="30"
          step="1"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full accent-fire-active"
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>1 km</span>
          <span className="font-mono text-gray-300">{radius} km</span>
          <span>30 km</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!isValid || status === 'generating' || status === 'polling'}
        onClick={handleSubmit}
        className={cn(
          'w-full py-2 rounded-md text-sm font-medium transition-all',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary',
          isValid && status === 'idle'
            ? 'bg-accent-primary text-white hover:bg-accent-primary-hover'
            : 'bg-surface-base text-gray-500 cursor-not-allowed',
        )}
      >
        {status === 'idle' ? 'Generate Region' : statusText[status]}
      </button>

      {status === 'polling' && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
          Fetching fuel, roads, census, shelters…
        </div>
      )}

      {status === 'error' && (
        <div className="text-xs text-accent-error" role="alert">{error}</div>
      )}

      {!isValid && lat !== '' && lon !== '' && (
        <p className="text-[10px] text-accent-warning">US coordinates only (lat 18–72, lon -180 to -65)</p>
      )}
    </div>
  );
}
