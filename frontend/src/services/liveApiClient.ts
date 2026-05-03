/**
 * Live API Client for EvacuAI Backend
 *
 * Translates between frontend types and the backend's Pydantic schemas.
 * All field-name mapping happens here — the rest of the frontend uses
 * the canonical types from types/api.ts unchanged.
 */

import type {
  SimulateRequest,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
  ShelterData,
  ApiValidationError,
  ApiNetworkError,
  FieldError,
  EvacuationRoute,
  ZoneResult,
  ZoneFeatureCollection,
  EvacuationOrderEntry,
  BurnProbabilityMap,
  ArrivalTimeStats,
  SimulationSummary,
  ZoneProperties,
} from '../types/api';
import type { EvacuAIApi, ProgressCallback } from './api';

// ============================================================================
// Constants
// ============================================================================

const REQUEST_TIMEOUT_MS = 300_000; // 5 min — simulation is synchronous

// ============================================================================
// Error Classes
// ============================================================================

export class ValidationError extends Error {
  public readonly type = 'validation' as const;
  public readonly detail: FieldError[];

  constructor(detail: FieldError[]) {
    const message = detail.map((e) => `${e.loc.join('.')}: ${e.msg}`).join('; ');
    super(message);
    this.name = 'ValidationError';
    this.detail = detail;
  }

  toApiError(): ApiValidationError {
    return { type: 'validation', detail: this.detail };
  }
}

export class NetworkError extends Error {
  public readonly type = 'network' as const;
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }

  toApiError(): ApiNetworkError {
    return { type: 'network', message: this.message, cause: this.cause };
  }
}

// ============================================================================
// Backend response shapes (private — never exported)
// ============================================================================

interface BackendRouteResult {
  route_id: string;
  zone_id: string;
  shelter_id: string;
  path_coords: [number, number][];
  node_ids: number[];
  total_travel_time_min: number;
  viability_score: number | null;
  strategy: 'baseline' | 'optimized';
}

interface BackendZoneResult {
  zone_id: string;
  population: number;
  evacuation_priority_score: number;
  cutoff_time: number | null;
  failure_risk_pct: number | null;
  baseline_route: BackendRouteResult;
  optimized_route: BackendRouteResult | null;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

interface BackendSimulationResponse {
  region_name: string;
  scenario: string;
  num_runs: number;
  max_timesteps: number;
  wind: {
    wind_speed_mph: number;
    wind_direction_deg: number;
    wind_gust_mph: number;
    relative_humidity: number;
  };
  grid_bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
    cell_size_m: number;
    grid_rows: number;
    grid_cols: number;
  };
  burn_probability_map: {
    grid_bounds: BackendSimulationResponse['grid_bounds'];
    data: number[][];
  };
  arrival_time_stats: {
    grid_bounds: BackendSimulationResponse['grid_bounds'];
    mean: number[][];
    median: number[][];
    p10: number[][];
    p90: number[][];
  };
  zone_results: BackendZoneResult[];
  evacuation_ordering: string[];
  summary: {
    mean_cells_burned: number;
    median_cells_burned: number;
    simulation_duration_sec: number;
    runs_completed: number;
  };
}

interface BackendWindResponse {
  conditions: {
    wind_speed_mph: number;
    wind_direction_deg: number;
    wind_gust_mph: number;
    relative_humidity: number;
  };
  source: string;
  forecast_text: string | null;
}

interface BackendScenarioPreset {
  name: string;
  description: string;
  ignition_lat: number;
  ignition_lon: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  wind_gust_mph: number;
  relative_humidity: number;
}

// ============================================================================
// Mappers: backend → frontend types
// ============================================================================

function mapRoute(r: BackendRouteResult): EvacuationRoute {
  return {
    route_id: r.route_id,
    zone_id: r.zone_id,
    segments: r.path_coords.map(([lat, lon]) => ({ lat, lon })),
    viability_score: r.viability_score ?? 0,
    travel_time_minutes: r.total_travel_time_min,
    strategy: r.strategy,
  };
}

function mapZoneToFeature(z: BackendZoneResult): ZoneResult {
  const baselineViability = z.baseline_route.viability_score ?? 0;
  const optimizedViability = z.optimized_route?.viability_score ?? baselineViability;

  const properties: ZoneProperties = {
    zone_id: z.zone_id,
    population: z.population,
    cutoff_time: z.cutoff_time ?? 999,
    evacuation_priority_score: z.evacuation_priority_score,
    best_baseline_route_id: z.baseline_route.route_id,
    best_optimized_route_id: z.optimized_route?.route_id ?? z.baseline_route.route_id,
    baseline_viability: baselineViability,
    optimized_viability: optimizedViability,
    failure_risk_percentage: z.failure_risk_pct ?? 0,
  };

  return {
    type: 'Feature',
    geometry: z.geometry as ZoneResult['geometry'],
    properties,
  };
}

function mapSimulationResponse(raw: BackendSimulationResponse): SimulationResults {
  // Map routes: collect all baseline + optimized from zone_results
  const routes: EvacuationRoute[] = [];
  for (const zr of raw.zone_results) {
    routes.push(mapRoute(zr.baseline_route));
    if (zr.optimized_route) {
      routes.push(mapRoute(zr.optimized_route));
    }
  }

  // Map zones to GeoJSON FeatureCollection
  const zones: ZoneFeatureCollection = {
    type: 'FeatureCollection',
    features: raw.zone_results.map(mapZoneToFeature),
  };

  // Map burn probability: backend uses "data", frontend uses "grid"
  const burn_probability: BurnProbabilityMap = {
    grid: raw.burn_probability_map.data,
    grid_bounds: raw.burn_probability_map.grid_bounds,
  };

  const arrival_times: ArrivalTimeStats = {
    mean: raw.arrival_time_stats.mean,
    median: raw.arrival_time_stats.median,
    p10: raw.arrival_time_stats.p10,
    p90: raw.arrival_time_stats.p90,
    grid_bounds: raw.arrival_time_stats.grid_bounds,
  };

  // Map evacuation ordering: backend sends string[], frontend wants EvacuationOrderEntry[]
  const zoneMap = new Map(raw.zone_results.map((z) => [z.zone_id, z]));
  const evacuation_ordering: EvacuationOrderEntry[] = raw.evacuation_ordering.map((zoneId) => {
    const z = zoneMap.get(zoneId);
    return {
      zone_id: zoneId,
      priority_score: z?.evacuation_priority_score ?? 0,
      population: z?.population ?? 0,
      cutoff_time: z?.cutoff_time ?? 999,
    };
  });

  // Compute summary fields the frontend expects from zone-level data
  const totalPop = raw.zone_results.reduce((s, z) => s + z.population, 0);
  const criticalZones = raw.zone_results.filter((z) => (z.cutoff_time ?? 999) < 10).length;
  const baselineScores = raw.zone_results.map((z) => z.baseline_route.viability_score ?? 0);
  const optimizedScores = raw.zone_results.map((z) =>
    z.optimized_route?.viability_score ?? z.baseline_route.viability_score ?? 0
  );
  const avgBaseline = baselineScores.length
    ? Math.round(baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length)
    : 0;
  const avgOptimized = optimizedScores.length
    ? Math.round(optimizedScores.reduce((a, b) => a + b, 0) / optimizedScores.length)
    : 0;
  const improvement = avgBaseline > 0 ? Math.round(((avgOptimized - avgBaseline) / avgBaseline) * 100) : 0;

  const summary: SimulationSummary = {
    total_population_at_risk: totalPop,
    zones_critical_count: criticalZones,
    baseline_avg_viability: avgBaseline,
    optimized_avg_viability: avgOptimized,
    improvement_percentage: improvement,
    confidence_interval_95: [
      Math.max(0, Math.min(...optimizedScores)),
      Math.min(100, Math.max(...optimizedScores)),
    ],
  };

  return {
    status: 'complete',
    job_id: `sim-${Date.now()}`,
    burn_probability,
    arrival_times,
    routes,
    zones,
    evacuation_ordering,
    summary,
  };
}

function mapWindResponse(raw: BackendWindResponse): WindData {
  const sourceMap: Record<string, WindData['source']> = {
    nws_live: 'nws',
    fallback: 'fallback',
    manual_override: 'manual',
  };
  return {
    wind_speed: raw.conditions.wind_speed_mph,
    wind_direction: raw.conditions.wind_direction_deg,
    wind_gust: raw.conditions.wind_gust_mph,
    relative_humidity: raw.conditions.relative_humidity,
    forecast_text: raw.forecast_text ?? '',
    source: sourceMap[raw.source] ?? 'fallback',
  };
}

function mapScenarioPreset(raw: BackendScenarioPreset): ScenarioPreset {
  return {
    name: raw.name,
    description: raw.description,
    ignition_point: { lat: raw.ignition_lat, lon: raw.ignition_lon },
    wind_speed: raw.wind_speed_mph,
    wind_direction: raw.wind_direction_deg,
    wind_gust: raw.wind_gust_mph,
    relative_humidity: raw.relative_humidity,
  };
}

// ============================================================================
// Live API Client
// ============================================================================

export class LiveApiClient implements EvacuAIApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });

      clearTimeout(timeoutId);

      if (response.status === 422) {
        const errorBody = await response.json();
        throw new ValidationError(errorBody.detail || []);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new NetworkError(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ValidationError || error instanceof NetworkError) throw error;
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new NetworkError('Request timeout', error);
        throw new NetworkError(error.message, error);
      }
      throw new NetworkError('Unknown error occurred');
    }
  }

  /**
   * Backend /api/simulate is synchronous — no polling needed.
   * Map frontend request fields → backend fields, then map response back.
   */
  async simulate(
    request: SimulateRequest,
    onProgress?: ProgressCallback
  ): Promise<SimulationResults> {
    // Signal start
    onProgress?.({
      status: 'running',
      completed_runs: 0,
      total_runs: request.num_runs,
      elapsed_seconds: 0,
    });

    // Translate frontend request → backend SimulationRequest
    const backendRequest = {
      ignition_lat: request.ignition_point.lat,
      ignition_lon: request.ignition_point.lon,
      wind_speed_mph: request.wind_speed,
      wind_direction_deg: request.wind_direction,
      wind_gust_mph: request.wind_gust,
      relative_humidity: request.relative_humidity,
      num_runs: request.num_runs,
      scenario_preset: request.scenario_preset,
      region: request.region,
    };

    const raw = await this.fetch<BackendSimulationResponse>('/api/simulate', {
      method: 'POST',
      body: JSON.stringify(backendRequest),
    });

    // Signal complete
    onProgress?.({
      status: 'complete' as 'running',
      completed_runs: raw.num_runs,
      total_runs: raw.num_runs,
      elapsed_seconds: raw.summary.simulation_duration_sec,
    });

    return mapSimulationResponse(raw);
  }

  async getResults(_jobId: string): Promise<SimulationProgress | SimulationResults> {
    throw new NetworkError('Polling not supported — backend is synchronous');
  }

  async getWind(lat: number, lon: number): Promise<WindData> {
    const params = new URLSearchParams({ lat: lat.toString(), lon: lon.toString() });
    const raw = await this.fetch<BackendWindResponse>(`/api/wind?${params}`);
    return mapWindResponse(raw);
  }

  async getScenarios(region?: string): Promise<ScenarioPreset[]> {
    const params = region ? `?region=${encodeURIComponent(region)}` : '';
    const raw = await this.fetch<BackendScenarioPreset[]>(`/api/scenarios${params}`);
    return raw.map(mapScenarioPreset);
  }

  async getRegions(): Promise<string[]> {
    return this.fetch<string[]>('/api/regions');
  }

  async getShelters(region?: string): Promise<ShelterData[]> {
    const params = region ? `?region=${encodeURIComponent(region)}` : '';
    return this.fetch<ShelterData[]>(`/api/shelters${params}`);
  }

  async ingest(lat: number, lon: number, radius_km: number): Promise<void> {
    await this.fetch('/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ lat, lon, radius_km }),
    });
  }
}
