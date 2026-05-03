/**
 * TypeScript API Types for EvacuAI Frontend
 * Mirrors backend Pydantic schemas for strict type safety
 *
 * @see prompts/dataspec.md for API specification
 * @see .kiro/specs/evacuai-backend-prototype/requirements.md for backend schemas
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request body for POST /api/simulate
 */
export interface SimulateRequest {
  /** Ignition point coordinates */
  ignition_point: {
    lat: number;
    lon: number;
  };
  /** Wind speed in mph */
  wind_speed: number;
  /** Wind direction in degrees (0-360, 0=N, 90=E, 180=S, 270=W) */
  wind_direction: number;
  /** Wind gust speed in mph */
  wind_gust: number;
  /** Relative humidity percentage (0-100) */
  relative_humidity: number;
  /** Number of Monte Carlo simulation runs (50-1000) */
  num_runs: number;
  /** Optional scenario preset name */
  scenario_preset?: string;
  /** Region slug (e.g. 'paradise-ca'). Defaults to 'paradise-ca' on backend. */
  region?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Progress response when simulation is running (HTTP 202)
 */
export interface SimulationProgress {
  /** Current status */
  status: 'running';
  /** Number of completed Monte Carlo runs */
  completed_runs: number;
  /** Total number of runs requested */
  total_runs: number;
  /** Elapsed time in seconds */
  elapsed_seconds: number;
}

// ============================================================================
// Grid and Spatial Types
// ============================================================================

/**
 * Bounding box and grid metadata for spatial data
 */
export interface GridBounds {
  /** Minimum latitude (southern boundary) */
  min_lat: number;
  /** Maximum latitude (northern boundary) */
  max_lat: number;
  /** Minimum longitude (western boundary) */
  min_lon: number;
  /** Maximum longitude (eastern boundary) */
  max_lon: number;
  /** Cell size in meters */
  cell_size_m: number;
  /** Number of rows in the grid */
  grid_rows: number;
  /** Number of columns in the grid */
  grid_cols: number;
}

/**
 * Burn probability map from Monte Carlo aggregation
 * Each cell value is the fraction of runs in which that cell ignited (0.0-1.0)
 */
export interface BurnProbabilityMap {
  /** 2D array of burn probabilities [row][col] */
  grid: number[][];
  /** Grid bounds and metadata */
  grid_bounds: GridBounds;
}

/**
 * Arrival time statistics aggregated across Monte Carlo runs
 * All arrays are 2D grids matching grid_bounds dimensions
 */
export interface ArrivalTimeStats {
  /** Mean arrival time per cell (minutes) */
  mean: number[][];
  /** Median arrival time per cell (minutes) */
  median: number[][];
  /** 10th percentile arrival time per cell (minutes) */
  p10: number[][];
  /** 90th percentile arrival time per cell (minutes) */
  p90: number[][];
  /** Grid bounds and metadata */
  grid_bounds: GridBounds;
}

// ============================================================================
// Route Types
// ============================================================================

/**
 * Single coordinate point in a route
 */
export interface RouteSegment {
  /** Latitude */
  lat: number;
  /** Longitude */
  lon: number;
}

/**
 * Evacuation route with viability metrics
 */
export interface EvacuationRoute {
  /** Unique route identifier */
  route_id: string;
  /** Zone this route serves */
  zone_id: string;
  /** Ordered list of coordinates forming the route */
  segments: RouteSegment[];
  /** Percentage of MC runs where route succeeds (0-100) */
  viability_score: number;
  /** Estimated travel time in minutes */
  travel_time_minutes: number;
  /** Routing strategy used */
  strategy: 'baseline' | 'optimized';
}

// ============================================================================
// Zone Types
// ============================================================================

/**
 * GeoJSON Polygon geometry
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

/**
 * Zone properties for evacuation planning
 */
export interface ZoneProperties {
  /** Unique zone identifier */
  zone_id: string;
  /** Total population in zone */
  population: number;
  /** Latest time (minutes) evacuation can begin with viable route */
  cutoff_time: number;
  /** Computed priority score for evacuation ordering */
  evacuation_priority_score: number;
  /** ID of best baseline (shortest-path) route */
  best_baseline_route_id: string;
  /** ID of best optimized (multi-factor) route */
  best_optimized_route_id: string;
  /** Baseline route viability percentage */
  baseline_viability: number;
  /** Optimized route viability percentage */
  optimized_viability: number;
  /** Percentage of MC runs where evacuation fails */
  failure_risk_percentage: number;
}

/**
 * GeoJSON Feature representing a census block group zone
 */
export interface ZoneResult {
  type: 'Feature';
  geometry: GeoJSONPolygon;
  properties: ZoneProperties;
}

/**
 * GeoJSON FeatureCollection of all zones
 */
export interface ZoneFeatureCollection {
  type: 'FeatureCollection';
  features: ZoneResult[];
}

// ============================================================================
// Simulation Results
// ============================================================================

/**
 * Evacuation ordering entry
 */
export interface EvacuationOrderEntry {
  /** Zone identifier */
  zone_id: string;
  /** Computed priority score */
  priority_score: number;
  /** Zone population */
  population: number;
  /** Cutoff time in minutes */
  cutoff_time: number;
}

/**
 * Summary statistics for simulation results
 */
export interface SimulationSummary {
  /** Total population in zones at risk */
  total_population_at_risk: number;
  /** Number of zones with cutoff < 10 minutes */
  zones_critical_count: number;
  /** Average viability score for baseline routes */
  baseline_avg_viability: number;
  /** Average viability score for optimized routes */
  optimized_avg_viability: number;
  /** Percentage improvement from baseline to optimized */
  improvement_percentage: number;
  /** 95% confidence interval [lower, upper] */
  confidence_interval_95: [number, number];
}

/**
 * Data quality warning from the backend
 */
export interface DataWarning {
  /** Machine-readable warning code */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Severity level */
  severity: 'warning' | 'info';
}

/**
 * Complete simulation results (HTTP 200)
 */
export interface SimulationResults {
  /** Status indicator */
  status: 'complete';
  /** Job identifier */
  job_id: string;
  /** Burn probability map */
  burn_probability: BurnProbabilityMap;
  /** Arrival time statistics */
  arrival_times: ArrivalTimeStats;
  /** All evacuation routes (baseline and optimized) */
  routes: EvacuationRoute[];
  /** Zone results as GeoJSON FeatureCollection */
  zones: ZoneFeatureCollection;
  /** Zones sorted by evacuation priority */
  evacuation_ordering: EvacuationOrderEntry[];
  /** Aggregate summary statistics */
  summary: SimulationSummary;
  /** Data quality warnings (synthetic/fallback data usage) */
  warnings: DataWarning[];
}

// ============================================================================
// Wind Data
// ============================================================================

/**
 * Wind data from NWS or fallback
 */
export interface WindData {
  /** Wind speed in mph */
  wind_speed: number;
  /** Wind direction in degrees */
  wind_direction: number;
  /** Wind gust speed in mph */
  wind_gust: number;
  /** Relative humidity percentage */
  relative_humidity: number;
  /** Human-readable forecast text */
  forecast_text: string;
  /** Data source indicator */
  source: 'nws' | 'fallback' | 'manual';
}

// ============================================================================
// Scenario Presets
// ============================================================================

/**
 * Pre-configured scenario preset
 */
export interface ScenarioPreset {
  /** Preset name (e.g., "Fast Wind Shift") */
  name: string;
  /** Description of the scenario */
  description: string;
  /** Default ignition point for this scenario */
  ignition_point: {
    lat: number;
    lon: number;
  };
  /** Default wind speed in mph */
  wind_speed: number;
  /** Default wind direction in degrees */
  wind_direction: number;
  /** Default wind gust in mph */
  wind_gust: number;
  /** Default relative humidity percentage */
  relative_humidity: number;
}

// ============================================================================
// Shelter Data
// ============================================================================

/**
 * Shelter data from the API
 */
export interface ShelterData {
  shelter_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  accessible: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Field-level validation error from API
 */
export interface FieldError {
  /** Field path (e.g., "ignition_point.lat") */
  loc: (string | number)[];
  /** Error message */
  msg: string;
  /** Error type */
  type: string;
}

/**
 * API validation error response (HTTP 422)
 */
export interface ApiValidationError {
  /** Error type identifier */
  type: 'validation';
  /** Array of field-level errors */
  detail: FieldError[];
}

/**
 * API network error
 */
export interface ApiNetworkError {
  /** Error type identifier */
  type: 'network';
  /** Error message */
  message: string;
  /** Original error if available */
  cause?: Error;
}

/**
 * Union type for all API errors
 */
export type ApiError = ApiValidationError | ApiNetworkError;

// ============================================================================
// Type Guards
// ============================================================================

export function isApiValidationError(error: ApiError): error is ApiValidationError {
  return error.type === 'validation';
}

export function isApiNetworkError(error: ApiError): error is ApiNetworkError {
  return error.type === 'network';
}
