# Implementation Plan: EvacuAI Backend Prototype

## Overview

This plan implements the EvacuAI wildfire simulation and evacuation optimization backend in four incremental phases. Each phase produces a testable, runnable system. The implementation uses Python with NumPy, SciPy, NetworkX, FastAPI, and Pydantic. Property-based tests use Hypothesis.

## Tasks

- [ ] 1. Scaffold project structure and dependencies
  - Create `/backend` directory with modules: `simulation/`, `monte_carlo/`, `evacuation/`, `data/`, `api/`, `models/`
  - Add `__init__.py` files for all packages
  - Create `requirements.txt` with pinned dependencies: numpy, scipy, networkx, fastapi, uvicorn, pydantic, shapely, requests, pytest, hypothesis, pytest-cov, httpx
  - Create `main.py` CLI entry point stub
  - Create `backend/tests/` directory with `__init__.py` and `conftest.py`
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 2. Implement Pydantic data models and schemas
  - [ ] 2.1 Create core data models in `backend/models/schemas.py`
    - Implement `GridBounds`, `WindConditions`, `Zone`, `Shelter`, `ScenarioPreset`, `CostWeights`
    - Implement `SimulationRequest` with field validators (lat/lon ranges, wind bounds, run count limits)
    - Implement result models: `BurnProbabilityMap`, `ArrivalTimeStats`, `RouteResult`, `ZoneResult`
    - Implement response models: `SimulationResponse`, `SimulationSummary`, `WindResponse`
    - _Requirements: 8.3, 6.4, 10.1, 10.2, 10.3, 10.4_

  - [ ]* 2.2 Write property test for serialization round-trip
    - **Property 14: Simulation Output Serialization Round-Trip**
    - Use Hypothesis `builds` strategy to generate valid `SimulationResponse` objects, serialize to JSON, deserialize back, and verify equivalence
    - **Validates: Requirements 10.5**

- [ ] 3. Implement seed data loading and preprocessing
  - [ ] 3.1 Create `backend/data/loader.py` with `SeedDataLoader` class
    - Implement `load_fuel_grid()` — load `fuel_grid.npy` as float32 NumPy array, validate values in [0.0, 1.5]
    - Implement `load_grid_bounds()` — load `grid_bounds.json`, return `GridBounds` model
    - Implement `load_fire_perimeter()` — load `camp_fire_perimeter.geojson`, rasterize polygon to binary burn mask using Shapely
    - Implement `load_road_graph()` — load `road_graph.json` as NetworkX DiGraph with `travel_time` and `capacity` edge attributes
    - Implement `load_zones()` — load `zones.geojson`, return list of `Zone` models with population and vulnerability fields
    - Implement `load_shelters()` — load `shelters.json`, return list of `Shelter` models
    - Implement `load_scenario_presets()` — load `scenario_presets.json`, return list of `ScenarioPreset` models
    - Implement `load_all()` — orchestrate all loaders, raise `SeedDataError` with file path and problem description on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 3.2 Create synthetic seed data files for development
    - Generate a small synthetic `fuel_grid.npy` (e.g., 50×50 grid with mixed fuel values 0.0–1.5)
    - Create `grid_bounds.json` with Paradise, CA bounding box (39.65°N–39.90°N, -121.75°W–-121.40°W)
    - Create a simplified `camp_fire_perimeter.geojson` with a polygon within the bounding box
    - Create `road_graph.json` in NetworkX node-link format with ~20 nodes and edges with `travel_time`, `capacity`, `highway` attributes
    - Create `zones.geojson` with 3–5 census block group features including `population`, `elderly_pct`, `disability_pct`, `evacuation_priority_weight`
    - Create `shelters.json` with 2–3 shelters with `shelter_id`, `name`, `lat`, `lon`, `capacity`, `accessible`
    - Create `scenario_presets.json` with 3 presets: Fast Wind Shift, Night Evacuation, School Zone
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.4_

  - [ ]* 3.3 Write unit tests for seed data loading
    - Test successful loading of each file type and verify structure/types
    - Test error handling for missing files (raises `SeedDataError`)
    - Test error handling for malformed data (wrong dtypes, invalid JSON)
    - _Requirements: 3.8_

- [ ] 4. Checkpoint — Verify seed data loading
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement fire spread simulation engine
  - [ ] 5.1 Create `backend/simulation/fire_spread.py` with `FireSpreadEngine` class
    - Implement `__init__` accepting `fuel_grid` (float32 NumPy array) and `grid_bounds` (GridBounds)
    - Implement lat/lon to grid coordinate conversion using grid_bounds metadata
    - Implement `run()` method with parameters: `ignition_point` (lat, lon), `wind_speed_mph`, `wind_direction_deg`, `relative_humidity`, `max_timesteps`
    - Implement spread rate formula: `spread_rate = R0 * fuel_multiplier * wind_factor * moisture_factor` where R0=0.05 km/min
    - Implement wind factor: `exp(0.1783 * wind_speed_mph * cos(wind_angle_to_cell))` with 8-neighbor (Moore) connectivity
    - Implement moisture factor: `1 - (relative_humidity / 100) * 0.8`
    - Use NumPy vectorized operations for neighbor spread probability computation (avoid Python-level cell iteration)
    - Enforce non-burnable cells (fuel_multiplier == 0.0) never ignite
    - Record ignition timestep per cell (-1 for unburned)
    - Return `FireSpreadResult` with `burn_mask`, `ignition_times`, and `cells_burned`
    - Validate ignition point is within grid bounds and on a burnable cell
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 5.2 Write property test for spread rate formula correctness
    - **Property 1: Spread Rate Formula Correctness**
    - Generate random (wind_speed ≥0, wind_angle 0–360°, humidity 0–100%, fuel_multiplier 0.0–1.5) tuples
    - Verify computed spread rate equals `R0 * fuel_multiplier * exp(0.1783 * wind_speed * cos(angle)) * (1 - humidity/100 * 0.8)`
    - **Validates: Requirements 1.2, 1.4**

  - [ ]* 5.3 Write property test for downwind propagation bias
    - **Property 2: Downwind Propagation Bias**
    - For random wind directions and a burning cell, verify the most wind-aligned neighbor has the highest spread probability and the most opposed neighbor has the lowest
    - **Validates: Requirements 1.3**

  - [ ]* 5.4 Write property test for non-burnable cell invariant
    - **Property 3: Non-Burnable Cell Invariant**
    - Generate random fuel grids with some 0.0 cells, run simulation, verify all 0.0-fuel cells have ignition_time == -1
    - **Validates: Requirements 1.5**

  - [ ]* 5.5 Write property test for ignition time consistency
    - **Property 4: Ignition Time Consistency**
    - Run simulation on random small grids, verify `burn_mask[i,j] == True` iff `ignition_times[i,j] >= 0` for all cells
    - **Validates: Requirements 1.6**

- [ ] 6. Implement Monte Carlo stochastic engine
  - [ ] 6.1 Create `backend/monte_carlo/engine.py` with `MonteCarloEngine` class
    - Implement `__init__` accepting `fire_engine`, `road_graph`, `zones`, `shelters`
    - Implement `run()` with stochastic sampling: wind_speed ~ Normal(μ, σ=3) clamped to [0, gust], wind_dir ~ Normal(μ, σ=15), civ_delay ~ Uniform(2, 15), road_closure ~ Beta(1.5, 8.5)
    - Use `numpy.random.SeedSequence` for deterministic per-run seeding from master seed
    - Aggregate results: `burn_probability_map[i,j] = count_ignited[i,j] / num_runs`
    - Compute arrival time statistics: mean, median over runs where cell ignited
    - Return `MonteCarloResult` with burn_probability_map, arrival_time_stats, per-zone results, run metadata
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 6.2 Write property test for Monte Carlo sampling bounds
    - **Property 5: Monte Carlo Sampling Bounds**
    - Generate random (wind_speed μ, wind_gust, num_runs) tuples, verify all sampled wind speeds in [0, gust], delays in [2, 15], road closures in [0, 1], and exactly N runs executed
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**

  - [ ]* 6.3 Write property test for burn probability map bounds
    - **Property 6: Burn Probability Map Bounds**
    - Generate random sets of binary burn masks, aggregate, verify all cell values in [0.0, 1.0] and equal count_ignited / num_runs
    - **Validates: Requirements 2.6**

  - [ ]* 6.4 Write property test for deterministic seeding
    - **Property 7: Deterministic Seeding**
    - Run Monte Carlo twice with same seed and scenario, verify identical burn probability maps, arrival time stats, and per-zone results
    - **Validates: Requirements 2.7**

- [ ] 7. Wire CLI entry point
  - [ ] 7.1 Implement `backend/main.py` CLI with argparse
    - Accept arguments: `--lat`, `--lon`, `--wind-speed`, `--wind-dir`, `--humidity`, `--runs`, `--output`, `--seed`, `--max-timesteps`
    - Load seed data via `SeedDataLoader`
    - Run Monte Carlo engine with provided or default parameters
    - Write results JSON to configurable output directory
    - Print stdout summary: mean cells burned, simulation duration, runs completed
    - Handle errors: invalid args → usage help + exit 1, seed data failure → stderr + exit 1, output dir not writable → stderr + exit 1
    - Use Paradise, CA defaults when no ignition point specified
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.2, 9.3_

  - [ ]* 7.2 Write unit tests for CLI argument parsing and output
    - Test various argument combinations are accepted
    - Test JSON file is written and stdout summary is printed
    - Test error handling for invalid arguments
    - _Requirements: 7.1, 7.3, 7.4_

- [ ] 8. Checkpoint — Phase 1 MVP validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `python backend/main.py --runs 10` completes without error and produces a results JSON with a burn probability map.

- [ ] 9. Implement baseline evacuation routing
  - [ ] 9.1 Create `backend/evacuation/router.py` with `EvacuationRouter` class
    - Implement `__init__` accepting `road_graph` (NetworkX DiGraph), `zones` (list[Zone]), `shelters` (list[Shelter])
    - Implement `compute_baseline_routes()` — Dijkstra shortest-path by `travel_time` weight to nearest shelter per zone centroid
    - Return per-zone `BaselineRouteResult` with ordered node ID list, total travel_time, and shelter_id
    - Handle disconnected graph: log warning, compute routes only for reachable zone-shelter pairs
    - Handle no path to any shelter: mark zone with `failure_risk_pct = 100.0`, `cutoff_time = 0`
    - _Requirements: 5.1, 5.2_

  - [ ]* 9.2 Write property test for baseline routing correctness
    - **Property 9: Baseline Routing Correctness**
    - Generate random small graphs with zones and shelters, verify baseline route matches Dijkstra shortest path and total_travel_time equals sum of edge weights
    - **Validates: Requirements 5.1, 5.2**

- [ ] 10. Add demo region defaults
  - Configure Paradise, CA defaults: bounding box 39.65°N–39.90°N, -121.75°W–-121.40°W
  - Set Camp Fire origin as default ignition point
  - Ensure CLI runs with zero arguments using all defaults
  - Verify 3 scenario presets exist: Fast Wind Shift, Night Evacuation, School Zone
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 11. Checkpoint — Phase 2 routing validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `python backend/main.py --runs 10` now includes per-zone baseline routes in the output JSON.

- [ ] 12. Implement NWS wind client
  - [ ] 12.1 Create `backend/data/wind_client.py` with `NWSWindClient` class
    - Implement grid coordinate resolution: `GET https://api.weather.gov/points/{lat},{lon}` → extract gridId, gridX, gridY
    - Implement hourly forecast fetch: `GET https://api.weather.gov/gridpoints/{gridId}/{gridX},{gridY}/forecast/hourly` → parse first period
    - Parse wind speed/gust strings (e.g., "14 mph") to float values
    - Convert compass direction strings (N, NE, E, SE, S, SW, W, NW) to degrees (0°, 45°, ..., 315°)
    - Set `User-Agent: EvacuAI/1.0` header on all requests
    - On API failure or timeout (>10s): return `FALLBACK_WIND` (10 mph, SW/225°, gust 20 mph, humidity 20%) and log warning
    - Support manual override: if override provided, skip API call and return override values
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 12.2 Write property test for wind string parsing round-trip
    - **Property 8: Wind String Parsing Round-Trip**
    - Generate random float values, format as "{N} mph", parse back, verify original value within floating-point tolerance
    - **Validates: Requirements 4.3**

  - [ ]* 12.3 Write unit tests for NWS wind client
    - Test compass direction conversion for all 8 directions
    - Test fallback behavior on API failure (mock requests)
    - Test manual override skips API call
    - _Requirements: 4.4, 4.6, 4.7_

- [ ] 13. Implement FastAPI application and endpoints
  - [ ] 13.1 Create `backend/api/app.py` with FastAPI application factory
    - Configure CORS middleware to allow cross-origin requests
    - Register routes from `backend/api/routes.py`
    - Initialize `SeedDataLoader` at startup
    - _Requirements: 6.6_

  - [ ] 13.2 Create `backend/api/routes.py` with endpoint definitions
    - Implement `POST /api/simulate` — accept `SimulationRequest`, run full pipeline (load data, MC engine, routing), return `SimulationResponse`
    - Implement `GET /api/wind` — accept `lat`, `lon` query params, fetch wind via `NWSWindClient`, return `WindResponse`
    - Implement `GET /api/scenarios` — return list of `ScenarioPreset` from seed data
    - Pydantic validation returns HTTP 422 with descriptive errors for invalid inputs
    - Return seed data errors as HTTP 500 with `{"error": "...", "detail": "..."}`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 13.3 Write unit tests for API endpoints
    - Test valid `POST /api/simulate` returns correct schema (use httpx TestClient, small run count)
    - Test invalid payloads return 422 with field-level errors
    - Test `GET /api/wind` with mocked NWS returns valid `WindResponse`
    - Test `GET /api/scenarios` returns preset list
    - Test CORS headers are present
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

- [ ] 14. Implement optimized evacuation routing
  - [ ] 14.1 Extend `EvacuationRouter` with optimized cost-function routing
    - Implement `compute_optimized_routes()` with multi-factor cost: `cost = α*travel_time + β*congestion + γ*fire_exposure + δ*road_closure`
    - Default weights: α=1.0, β=0.5, γ=2.0, δ=1.5 (configurable via `CostWeights`)
    - Compute `fire_exposure` per edge as fraction of route segment burning at estimated traversal time from the current run's fire grid
    - Return per-zone `OptimizedRouteResult` with route, cost breakdown, and shelter assignment
    - _Requirements: 5.3, 5.4_

  - [ ]* 14.2 Write property test for optimized cost function correctness
    - **Property 10: Optimized Cost Function Correctness**
    - Generate random edge attributes and weight coefficients, verify computed cost equals `α*travel_time + β*congestion + γ*fire_exposure + δ*road_closure` and fire_exposure is in [0.0, 1.0]
    - **Validates: Requirements 5.3, 5.4**

- [ ] 15. Checkpoint — Phase 3 API and optimized routing validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `POST /api/simulate` returns full results with both baseline and optimized routes.

- [ ] 16. Implement full viability scoring and evacuation ordering
  - [ ] 16.1 Extend `EvacuationRouter` with viability scoring
    - Implement `compute_viability_scores()` — Route_Viability_Score = % of MC runs route reaches shelter before fire arrival
    - Implement `Cutoff_Time` per zone — latest timestep T where starting evacuation yields viability > 50%
    - Compute failure risk percentage per zone (% of runs with no viable route)
    - _Requirements: 5.5, 5.6, 5.8_

  - [ ] 16.2 Implement evacuation ordering
    - Implement `compute_evacuation_ordering()` — sort zones by descending `priority_score = (pop_weight + elderly_weight * 2.0 + disability_weight * 1.5) * fire_exposure_probability`
    - Return ordered list of `ZoneOrderResult`
    - _Requirements: 5.7_

  - [ ]* 16.3 Write property test for route viability score aggregation
    - **Property 11: Route Viability Score Aggregation**
    - Generate random boolean arrays (route success per run), verify score = count_success / N * 100 and score in [0, 100]
    - **Validates: Requirements 5.5**

  - [ ]* 16.4 Write property test for cutoff time correctness
    - **Property 12: Cutoff Time Correctness**
    - Generate random monotonically decreasing viability curves, verify cutoff is latest T with score > 50% and T+1 has score ≤ 50%
    - **Validates: Requirements 5.6**

  - [ ]* 16.5 Write property test for evacuation ordering
    - **Property 13: Evacuation Ordering Sorted by Priority**
    - Generate random zone lists with priority data, verify ordering is descending by `priority_score`
    - **Validates: Requirements 5.7**

- [ ] 17. Polish output serialization
  - [ ] 17.1 Ensure all outputs match serialization requirements
    - Burn probability map serialized as 2D float array with `grid_bounds` metadata
    - Arrival time stats include mean, median, p10, p90 per cell
    - Routes serialized as ordered (lat, lon) coordinate pairs with viability score and travel_time
    - Zone results serialized as GeoJSON features with zone_id, population, cutoff_time, priority_score, route IDs, failure_risk_pct
    - Wire viability scores, cutoff times, and evacuation ordering into `SimulationResponse`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 17.2 Write integration tests for end-to-end pipeline
    - Test full CLI pipeline: `python main.py --runs 10` produces valid JSON with all fields
    - Test full API pipeline: `POST /api/simulate` with small run count returns complete `SimulationResponse`
    - Verify round-trip JSON serialization of results
    - _Requirements: 7.2, 6.1, 10.5_

- [ ] 18. Final checkpoint — Full system validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end: default scenario → simulate → results include viability scores, cutoff times, evacuation ordering.
  - Verify CLI and API produce equivalent output structures.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- Property tests validate the 14 universal correctness properties from the design document using Hypothesis
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation language is Python throughout, matching the design document
- All seed data files are synthetic for development; real data can be swapped in later
