export type ApiMode = "mock" | "live";

export interface BoundingBox {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

export interface DefaultIgnitionPoint {
  lat: number;
  lon: number;
}

export interface RegionConfig {
  region_name: string;
  bounding_box: BoundingBox;
  default_ignition_point: DefaultIgnitionPoint;
  fire_perimeter_file?: string | null;
}

export interface SimulationRequest {
  ignition_lat: number;
  ignition_lon: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  wind_gust_mph: number;
  relative_humidity: number;
  num_runs: number;
  max_timesteps: number;
  scenario_preset?: string | null;
  seed?: number | null;
  region?: string | null;
}

export interface GridBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  cell_size_m: number;
  grid_rows: number;
  grid_cols: number;
}

export interface WindConditions {
  wind_speed_mph: number;
  wind_direction_deg: number;
  wind_gust_mph: number;
  relative_humidity: number;
}

export interface Zone {
  zone_id: string;
  population: number;
  elderly_pct: number;
  disability_pct: number;
  evacuation_priority_weight: number;
  centroid_lat: number;
  centroid_lon: number;
  geometry: GeoJsonPolygon;
}

export interface Shelter {
  shelter_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  accessible: boolean;
}

export interface ScenarioPreset {
  name: string;
  description: string;
  ignition_lat: number;
  ignition_lon: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  wind_gust_mph: number;
  relative_humidity: number;
}

export interface CostWeights {
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
}

export interface BurnProbabilityMap {
  grid_bounds: GridBounds;
  data: number[][];
}

export interface ArrivalTimeStats {
  grid_bounds: GridBounds;
  mean: number[][];
  median: number[][];
  p10: number[][];
  p90: number[][];
}

export interface RouteResult {
  route_id: string;
  zone_id: string;
  shelter_id: string;
  path_coords: LatLonTuple[];
  node_ids: number[];
  total_travel_time_min: number;
  viability_score?: number | null;
  strategy: "baseline" | "optimized" | string;
}

export interface ZoneResult {
  zone_id: string;
  population: number;
  evacuation_priority_score: number;
  cutoff_time?: number | null;
  failure_risk_pct?: number | null;
  baseline_route: RouteResult;
  optimized_route?: RouteResult | null;
  geometry: GeoJsonPolygon;
}

export interface SimulationSummary {
  mean_cells_burned: number;
  median_cells_burned: number;
  simulation_duration_sec: number;
  runs_completed: number;
}

export interface SimulationResponse {
  region_name: string;
  scenario: string;
  num_runs: number;
  max_timesteps: number;
  wind: WindConditions;
  grid_bounds: GridBounds;
  burn_probability_map: BurnProbabilityMap;
  arrival_time_stats: ArrivalTimeStats;
  zone_results: ZoneResult[];
  evacuation_ordering: string[];
  summary: SimulationSummary;
}

export interface WindResponse {
  conditions: WindConditions;
  source: "nws_live" | "fallback" | "manual_override" | string;
  forecast_text?: string | null;
}

export interface SimulationProgress {
  completedRuns: number;
  totalRuns: number;
  elapsedSec: number;
  etaSec: number;
  phase: string;
}

export interface ApiClient {
  fetchScenarios(region?: string): Promise<ScenarioPreset[]>;
  fetchWind(lat: number, lon: number): Promise<WindResponse>;
  runSimulation(
    request: SimulationRequest,
    onProgress?: (progress: SimulationProgress) => void,
  ): Promise<SimulationResponse>;
}

export interface ApiValidationIssue {
  field: string;
  message: string;
}

export type LatLonTuple = [number, number];
export type LonLatTuple = [number, number];

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: LonLatTuple[][];
}
