import { describe, it, expect, vi } from 'vitest';
import { buildMockSimulation, defaultWind } from '../services/mockData';
import { createMockApiClient } from '../services/mockApiClient';

// --- buildMockSimulation ---

describe('buildMockSimulation', () => {
  it('returns a SimulationResponse with the requested num_runs', () => {
    const result = buildMockSimulation({
      ignition_lat: 39.7596,
      ignition_lon: -121.6219,
      ...defaultWind,
      num_runs: 10,
      max_timesteps: 180,
    });
    expect(result.num_runs).toBe(10);
    expect(result.summary.runs_completed).toBe(10);
  });

  it('zone_results are sorted by descending evacuation_priority_score', () => {
    const result = buildMockSimulation({
      ignition_lat: 39.7596,
      ignition_lon: -121.6219,
      ...defaultWind,
      num_runs: 10,
      max_timesteps: 180,
    });
    const scores = result.zone_results.map((z) => z.evacuation_priority_score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('evacuation_ordering matches zone_results order', () => {
    const result = buildMockSimulation({
      ignition_lat: 39.7596,
      ignition_lon: -121.6219,
      ...defaultWind,
      num_runs: 10,
      max_timesteps: 180,
    });
    expect(result.evacuation_ordering).toEqual(result.zone_results.map((z) => z.zone_id));
  });

  it('burn_probability_map data values are in [0, 1]', () => {
    const result = buildMockSimulation({
      ignition_lat: 39.7596,
      ignition_lon: -121.6219,
      ...defaultWind,
      num_runs: 10,
      max_timesteps: 180,
    });
    for (const row of result.burn_probability_map.data) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });
});

// --- mockApiClient ---

describe('createMockApiClient', () => {
  const client = createMockApiClient();

  it('fetchScenarios returns a non-empty array', async () => {
    const scenarios = await client.fetchScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0]).toHaveProperty('name');
    expect(scenarios[0]).toHaveProperty('ignition_lat');
  });

  it('fetchWind returns conditions with required fields', async () => {
    const wind = await client.fetchWind(39.7596, -121.6219);
    expect(wind.conditions).toHaveProperty('wind_speed_mph');
    expect(wind.conditions).toHaveProperty('wind_direction_deg');
    expect(wind.conditions).toHaveProperty('wind_gust_mph');
    expect(wind.conditions).toHaveProperty('relative_humidity');
    expect(wind.source).toBe('nws_live');
  });

  it('runSimulation calls onProgress and resolves with a SimulationResponse', async () => {
    const onProgress = vi.fn();
    const result = await client.runSimulation(
      { ignition_lat: 39.7596, ignition_lon: -121.6219, ...defaultWind, num_runs: 10, max_timesteps: 180 },
      onProgress,
    );
    expect(onProgress).toHaveBeenCalled();
    expect(result).toHaveProperty('zone_results');
    expect(result).toHaveProperty('burn_probability_map');
    expect(result).toHaveProperty('evacuation_ordering');
    expect(result.summary.runs_completed).toBe(10);
  });
});

// --- Input validation (mirrors useSimulation.validateRequest logic) ---

describe('SimulationRequest validation', () => {
  function validate(overrides: Record<string, number>) {
    const base = {
      ignition_lat: 39.7596,
      ignition_lon: -121.6219,
      wind_speed_mph: 14,
      wind_direction_deg: 225,
      wind_gust_mph: 20,
      relative_humidity: 18,
      num_runs: 10,
      max_timesteps: 180,
      ...overrides,
    };
    const errors: Record<string, string> = {};
    if (base.ignition_lat < -90 || base.ignition_lat > 90) errors.ignition_lat = 'out of range';
    if (base.ignition_lon < -180 || base.ignition_lon > 180) errors.ignition_lon = 'out of range';
    if (base.wind_speed_mph < 0 || base.wind_speed_mph > 100) errors.wind_speed_mph = 'out of range';
    if (base.wind_direction_deg < 0 || base.wind_direction_deg >= 360) errors.wind_direction_deg = 'out of range';
    if (base.wind_gust_mph < 0 || base.wind_gust_mph > 150) errors.wind_gust_mph = 'out of range';
    if (base.relative_humidity < 0 || base.relative_humidity > 100) errors.relative_humidity = 'out of range';
    if (base.num_runs < 5 || base.num_runs > 15) errors.num_runs = 'out of range';
    return errors;
  }

  it('accepts valid inputs with no errors', () => {
    expect(validate({})).toEqual({});
  });

  it('rejects latitude out of range', () => {
    expect(validate({ ignition_lat: 91 })).toHaveProperty('ignition_lat');
    expect(validate({ ignition_lat: -91 })).toHaveProperty('ignition_lat');
  });

  it('rejects longitude out of range', () => {
    expect(validate({ ignition_lon: 181 })).toHaveProperty('ignition_lon');
  });

  it('rejects wind_direction_deg >= 360', () => {
    expect(validate({ wind_direction_deg: 360 })).toHaveProperty('wind_direction_deg');
  });

  it('rejects num_runs below 5', () => {
    expect(validate({ num_runs: 4 })).toHaveProperty('num_runs');
  });

  it('rejects num_runs above 15', () => {
    expect(validate({ num_runs: 16 })).toHaveProperty('num_runs');
  });

  it('rejects humidity above 100', () => {
    expect(validate({ relative_humidity: 101 })).toHaveProperty('relative_humidity');
  });
});
