import type {
  ArrivalTimeStats,
  BurnProbabilityMap,
  GeoJsonPolygon,
  GridBounds,
  ScenarioPreset,
  Shelter,
  SimulationRequest,
  SimulationResponse,
  WindConditions,
  ZoneResult,
} from "../types/api";

export const paradiseCenter = {
  lat: 39.7596,
  lon: -121.6219,
};

export const gridBounds: GridBounds = {
  min_lat: 39.67,
  max_lat: 39.86,
  min_lon: -121.74,
  max_lon: -121.47,
  cell_size_m: 100,
  grid_rows: 8,
  grid_cols: 10,
};

export const campFirePerimeter: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-121.711, 39.692],
      [-121.686, 39.735],
      [-121.671, 39.781],
      [-121.632, 39.828],
      [-121.584, 39.846],
      [-121.528, 39.821],
      [-121.508, 39.77],
      [-121.534, 39.721],
      [-121.59, 39.681],
      [-121.657, 39.668],
      [-121.711, 39.692],
    ],
  ],
};

export const shelters: Shelter[] = [
  {
    shelter_id: "sh-01",
    name: "Chico Fairgrounds",
    lat: 39.7359,
    lon: -121.8437,
    capacity: 1800,
    accessible: true,
  },
  {
    shelter_id: "sh-02",
    name: "Oroville Convention Center",
    lat: 39.5138,
    lon: -121.5564,
    capacity: 950,
    accessible: true,
  },
  {
    shelter_id: "sh-03",
    name: "Butte College Safe Site",
    lat: 39.6502,
    lon: -121.6446,
    capacity: 1100,
    accessible: false,
  },
];

export const scenarios: ScenarioPreset[] = [
  {
    name: "Camp Fire Fast Wind Shift",
    description: "Northeast ignition with strong southwest winds and rapid route exposure.",
    ignition_lat: 39.7596,
    ignition_lon: -121.6219,
    wind_speed_mph: 24,
    wind_direction_deg: 225,
    wind_gust_mph: 38,
    relative_humidity: 14,
  },
  {
    name: "Night Evacuation",
    description: "Lower visibility and slower departure assumptions under moderate winds.",
    ignition_lat: 39.7844,
    ignition_lon: -121.6068,
    wind_speed_mph: 16,
    wind_direction_deg: 250,
    wind_gust_mph: 26,
    relative_humidity: 21,
  },
  {
    name: "School Zone",
    description: "Priority-weighted evacuation for central Paradise school corridor.",
    ignition_lat: 39.7535,
    ignition_lon: -121.5862,
    wind_speed_mph: 18,
    wind_direction_deg: 205,
    wind_gust_mph: 30,
    relative_humidity: 18,
  },
];

export const defaultWind: WindConditions = {
  wind_speed_mph: 18,
  wind_direction_deg: 225,
  wind_gust_mph: 31,
  relative_humidity: 18,
};

export const previewZones: ZoneResult[] = [
  createZone({
    id: "PAR-01",
    population: 1480,
    priority: 91,
    cutoff: 7,
    risk: 34,
    polygon: [
      [-121.651, 39.788],
      [-121.62, 39.795],
      [-121.61, 39.768],
      [-121.642, 39.756],
      [-121.651, 39.788],
    ],
    baseline: 63,
    optimized: 83,
    baselineTime: 28,
    optimizedTime: 22,
    shelter: "sh-01",
  }),
  createZone({
    id: "PAR-02",
    population: 920,
    priority: 76,
    cutoff: 13,
    risk: 22,
    polygon: [
      [-121.62, 39.795],
      [-121.582, 39.795],
      [-121.574, 39.764],
      [-121.61, 39.768],
      [-121.62, 39.795],
    ],
    baseline: 69,
    optimized: 88,
    baselineTime: 24,
    optimizedTime: 18,
    shelter: "sh-01",
  }),
  createZone({
    id: "PAR-03",
    population: 1220,
    priority: 58,
    cutoff: 24,
    risk: 13,
    polygon: [
      [-121.642, 39.756],
      [-121.61, 39.768],
      [-121.605, 39.733],
      [-121.638, 39.723],
      [-121.642, 39.756],
    ],
    baseline: 74,
    optimized: 91,
    baselineTime: 31,
    optimizedTime: 23,
    shelter: "sh-03",
  }),
  createZone({
    id: "PAR-04",
    population: 760,
    priority: 42,
    cutoff: 39,
    risk: 6,
    polygon: [
      [-121.61, 39.768],
      [-121.574, 39.764],
      [-121.566, 39.726],
      [-121.605, 39.733],
      [-121.61, 39.768],
    ],
    baseline: 81,
    optimized: 94,
    baselineTime: 26,
    optimizedTime: 20,
    shelter: "sh-02",
  }),
];

export function buildMockSimulation(request: SimulationRequest): SimulationResponse {
  const directionDelta = request.wind_direction_deg - defaultWind.wind_direction_deg;
  const scoreOffset = directionDelta > 30 ? -6 : directionDelta < -20 ? 4 : 0;
  const riskOffset = directionDelta > 30 ? 8 : directionDelta < -20 ? -4 : 0;
  const zoneResults = previewZones.map((zone) => ({
    ...zone,
    cutoff_time: Math.max(3, (zone.cutoff_time ?? 20) + (scoreOffset > 0 ? 4 : -2)),
    failure_risk_pct: Math.min(88, Math.max(2, (zone.failure_risk_pct ?? 0) + riskOffset)),
    baseline_route: {
      ...zone.baseline_route,
      viability_score: clampScore((zone.baseline_route.viability_score ?? 0) + scoreOffset),
    },
    optimized_route: zone.optimized_route
      ? {
          ...zone.optimized_route,
          viability_score: clampScore((zone.optimized_route.viability_score ?? 0) + scoreOffset + 2),
        }
      : null,
  }));

  return {
    region_name: "Paradise, CA",
    scenario: request.scenario_preset ?? "custom",
    num_runs: request.num_runs,
    max_timesteps: request.max_timesteps,
    wind: {
      wind_speed_mph: request.wind_speed_mph,
      wind_direction_deg: request.wind_direction_deg,
      wind_gust_mph: request.wind_gust_mph,
      relative_humidity: request.relative_humidity,
    },
    grid_bounds: gridBounds,
    burn_probability_map: burnProbabilityMap,
    arrival_time_stats: arrivalTimeStats,
    zone_results: zoneResults.sort(
      (a, b) => b.evacuation_priority_score - a.evacuation_priority_score,
    ),
    evacuation_ordering: zoneResults
      .slice()
      .sort((a, b) => b.evacuation_priority_score - a.evacuation_priority_score)
      .map((zone) => zone.zone_id),
    summary: {
      mean_cells_burned: 43.8,
      median_cells_burned: 41,
      simulation_duration_sec: 3.2,
      runs_completed: request.num_runs,
    },
  };
}

function createZone(input: {
  id: string;
  population: number;
  priority: number;
  cutoff: number;
  risk: number;
  polygon: [number, number][];
  baseline: number;
  optimized: number;
  baselineTime: number;
  optimizedTime: number;
  shelter: string;
}): ZoneResult {
  const geometry: GeoJsonPolygon = {
    type: "Polygon",
    coordinates: [input.polygon],
  };
  const centroid = centroidOf(input.polygon);

  return {
    zone_id: input.id,
    population: input.population,
    evacuation_priority_score: input.priority,
    cutoff_time: input.cutoff,
    failure_risk_pct: input.risk,
    baseline_route: {
      route_id: `${input.id}-baseline`,
      zone_id: input.id,
      shelter_id: input.shelter,
      path_coords: [
        [centroid.lat, centroid.lon],
        [39.748, -121.664],
        [39.732, -121.74],
        [39.7359, -121.8437],
      ],
      node_ids: [100, 120, 146, 188],
      total_travel_time_min: input.baselineTime,
      viability_score: input.baseline,
      strategy: "baseline",
    },
    optimized_route: {
      route_id: `${input.id}-optimized`,
      zone_id: input.id,
      shelter_id: input.shelter,
      path_coords: [
        [centroid.lat, centroid.lon],
        [39.72, -121.612],
        [39.66, -121.64],
        input.shelter === "sh-02" ? [39.5138, -121.5564] : [39.6502, -121.6446],
      ],
      node_ids: [100, 141, 172, 205],
      total_travel_time_min: input.optimizedTime,
      viability_score: input.optimized,
      strategy: "optimized",
    },
    geometry,
  };
}

function centroidOf(points: [number, number][]) {
  const totals = points.reduce(
    (sum, point) => ({
      lon: sum.lon + point[0],
      lat: sum.lat + point[1],
    }),
    { lat: 0, lon: 0 },
  );
  return {
    lat: totals.lat / points.length,
    lon: totals.lon / points.length,
  };
}

function clampScore(value: number) {
  return Math.max(8, Math.min(98, value));
}

const burnProbabilityMap: BurnProbabilityMap = {
  grid_bounds: gridBounds,
  data: [
    [0.02, 0.04, 0.06, 0.08, 0.12, 0.16, 0.2, 0.16, 0.1, 0.05],
    [0.03, 0.07, 0.12, 0.2, 0.32, 0.42, 0.38, 0.25, 0.14, 0.07],
    [0.04, 0.11, 0.24, 0.46, 0.65, 0.78, 0.69, 0.44, 0.22, 0.09],
    [0.05, 0.18, 0.39, 0.68, 0.88, 0.96, 0.81, 0.56, 0.31, 0.11],
    [0.04, 0.14, 0.33, 0.61, 0.82, 0.9, 0.72, 0.48, 0.24, 0.08],
    [0.03, 0.1, 0.21, 0.4, 0.58, 0.64, 0.52, 0.33, 0.16, 0.05],
    [0.02, 0.06, 0.12, 0.22, 0.34, 0.39, 0.3, 0.18, 0.09, 0.03],
    [0.01, 0.03, 0.06, 0.1, 0.14, 0.16, 0.12, 0.07, 0.04, 0.01],
  ],
};

const arrivalTimeStats: ArrivalTimeStats = {
  grid_bounds: gridBounds,
  mean: matrixFrom((row, col) => 12 + row * 10 + col * 4),
  median: matrixFrom((row, col) => 10 + row * 9 + col * 4),
  p10: matrixFrom((row, col) => 6 + row * 7 + col * 3),
  p90: matrixFrom((row, col) => 18 + row * 12 + col * 5),
};

function matrixFrom(factory: (row: number, col: number) => number) {
  return Array.from({ length: gridBounds.grid_rows }, (_, row) =>
    Array.from({ length: gridBounds.grid_cols }, (_unused, col) => factory(row, col)),
  );
}
