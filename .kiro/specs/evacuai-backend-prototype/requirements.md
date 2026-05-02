# Requirements Document

## Introduction

EvacuAI is a computation-first Python backend that simulates wildfire spread under uncertainty using Monte Carlo methods and evaluates evacuation route viability for first responders and emergency planners. The system uses a simplified Rothermel fire spread model on a grid, runs ~500 Monte Carlo simulations per scenario, and compares baseline vs. optimized evacuation strategies over a real road network. The architecture is region-agnostic: any geographic region that provides a conformant region dataset can be loaded and simulated. Paradise, CA (Camp Fire 2018) is the bundled default demo region. The backend serves results via a synchronous FastAPI REST API and is also runnable as a standalone CLI tool.

**Skills Reference:** engineering-backend-architect (system architecture, API design, service decomposition), engineering-data-engineer (data pipeline design, seed data processing, data quality).

## Glossary

- **Simulation_Engine**: The core Python module that executes the simplified Rothermel fire spread model on a NumPy grid, advancing fire state over discrete timesteps.
- **Monte_Carlo_Engine**: The module that orchestrates ~500 stochastic simulation runs per scenario, sampling wind speed, wind direction, civilian delay, and road closure probability from defined distributions.
- **Evacuation_Optimizer**: The module that computes evacuation routes over a NetworkX DiGraph road network, comparing baseline (shortest-path) and optimized (multi-factor cost) strategies.
- **Data_Pipeline**: The collection of preprocessing scripts and loaders that ingest region dataset files and live wind data into simulation-ready formats.
- **API_Layer**: The FastAPI application that exposes synchronous simulation, results, wind, and scenario endpoints with Pydantic-validated request/response schemas.
- **Fire_Grid**: A 2D NumPy float32 array representing the simulation area at 100m cell resolution, where each cell holds burn state, ignition time, and spread probability.
- **Fuel_Grid**: A pre-processed NumPy float32 array derived from LANDFIRE FBFM40 data, containing spread rate multipliers (0.0–1.5) per cell.
- **Road_Graph**: A NetworkX DiGraph built from pre-fetched OpenStreetMap data, where edges carry travel_time, capacity, fire_exposure, and closure_probability attributes.
- **Burn_Probability_Map**: A 2D array aggregated over all Monte Carlo runs, where each cell value represents the fraction of runs in which that cell ignited.
- **Zone**: A census block group polygon with associated population count, vulnerability weights (elderly percentage, disability percentage), and computed evacuation priority score.
- **Route_Viability_Score**: The percentage of Monte Carlo runs in which a given evacuation route successfully reaches a shelter before fire arrival.
- **Cutoff_Time**: The latest simulation timestep at which a zone can still begin evacuation and have at least one viable route to a shelter.
- **Scenario**: A named configuration combining an ignition point, wind parameters, uncertainty settings, and optional presets (e.g., Fast Wind Shift, Night Evacuation).
- **Region_Dataset**: A self-contained directory of seed data files and a `region_config.json` metadata file that fully describes a geographic region for simulation. Any region that provides the required files in the expected schema can be loaded and simulated.
- **Region_Config**: A JSON metadata file (`region_config.json`) within a Region_Dataset that specifies the region name, bounding box, default ignition point, and default scenario presets for that region.
- **Seed_Data**: Pre-fetched and pre-processed data files within a Region_Dataset directory that the system loads at startup without live API calls.
- **NWS_Client**: The module responsible for fetching live wind forecast data from the National Weather Service api.weather.gov API.
- **Rothermel_Model**: The simplified fire behavior model using base spread rate R0=0.05 km/min, wind factor exponent 0.1783, and moisture dampening up to 0.8 reduction.
- **Pydantic_Schema**: A strict data contract defined using Pydantic models for all API request and response payloads.
- **SeedDataLoader**: The component within the Data_Pipeline responsible for discovering, validating, and loading a Region_Dataset from a configurable directory path.

## Development Phases & Priority

Requirements are organized into four incremental phases. Each phase builds on the previous and produces a testable, runnable system.

### Phase 1 — MVP: Fire Simulation + Monte Carlo + CLI (Priority: Critical)
- Requirement 1: Fire Spread Simulation on Grid
- Requirement 2: Monte Carlo Stochastic Engine
- Requirement 3: Seed Data Loading and Preprocessing
- Requirement 7: CLI Execution Mode
- Requirement 8: Project Structure and Module Separation
- Requirement 11: Region Dataset Specification

### Phase 2 — Routing: Road Graph + Basic Evacuation (Priority: High)
- Requirement 5: Evacuation Route Optimization (baseline shortest-path only)
- Requirement 9: Demo Region Configuration

### Phase 3 — API: FastAPI Layer + Optimized Routing (Priority: High)
- Requirement 4: Live Wind Data Fetch
- Requirement 6: REST API Layer (synchronous)
- Requirement 5 (extended): Optimized cost-function routing and zone ordering

### Phase 4 — Polish: Output Serialization + Advanced Features (Priority: Medium)
- Requirement 10: Simulation Output Serialization
- Requirement 5 (extended): Full viability scoring, cutoff times, failure risk

---

## Requirements

### Requirement 1: Fire Spread Simulation on Grid

**Priority:** Critical (Phase 1 — MVP)

**User Story:** As an evacuation planner, I want to simulate wildfire spread on a realistic terrain grid, so that I can see how fire propagates under given conditions.

#### Acceptance Criteria

1. WHEN an ignition point and wind parameters are provided, THE Simulation_Engine SHALL compute fire spread on a Fire_Grid using the simplified Rothermel_Model with 100m cell resolution and 1-minute timesteps.
2. THE Simulation_Engine SHALL calculate spread probability for each cell using the formula: `spread_rate = R0 * fuel_multiplier * wind_factor * moisture_factor`, where `wind_factor = exp(0.1783 * wind_speed_mph * cos(wind_angle_to_cell))` and `moisture_factor = 1 - (relative_humidity / 100) * 0.8`.
3. WHEN computing spread direction, THE Simulation_Engine SHALL favor downwind propagation by applying the cosine-weighted wind factor relative to each neighboring cell's bearing from the burning cell.
4. THE Simulation_Engine SHALL use the Fuel_Grid spread rate multipliers (range 0.0 to 1.5) to modify the base spread rate R0 of 0.05 km/min per cell.
5. WHEN a cell has a non-burnable fuel code (FBFM40 codes 91–99, multiplier 0.0), THE Simulation_Engine SHALL prevent fire from spreading into that cell.
6. THE Simulation_Engine SHALL record the ignition timestep for each cell that catches fire during the simulation run.

### Requirement 2: Monte Carlo Stochastic Engine

**Priority:** Critical (Phase 1 — MVP)

**User Story:** As an evacuation planner, I want to run hundreds of stochastic simulations per scenario, so that I can understand the range of possible fire outcomes and make probability-informed decisions.

#### Acceptance Criteria

1. WHEN a scenario is submitted, THE Monte_Carlo_Engine SHALL execute approximately 500 independent simulation runs with stochastically sampled parameters.
2. THE Monte_Carlo_Engine SHALL sample wind speed from a Normal distribution centered on the provided wind speed value with σ=3 mph, clamped to the wind gust value as an upper bound.
3. THE Monte_Carlo_Engine SHALL sample wind direction from a Normal distribution centered on the provided wind direction (in degrees) with σ=15°.
4. THE Monte_Carlo_Engine SHALL sample civilian evacuation delay from a Uniform(2, 15) distribution in minutes per run.
5. THE Monte_Carlo_Engine SHALL sample road closure probability per edge from a Beta(1.5, 8.5) distribution per run.
6. WHEN all runs complete, THE Monte_Carlo_Engine SHALL aggregate results into: a Burn_Probability_Map (fraction of runs each cell ignited) and per-cell arrival time statistics (mean, median).
7. THE Monte_Carlo_Engine SHALL produce deterministic results when initialized with the same random seed.

### Requirement 3: Seed Data Loading and Preprocessing

**Priority:** Critical (Phase 1 — MVP)

**User Story:** As a developer, I want all non-wind data loadable from a configurable region dataset directory, so that the system supports any geographic region and the demo runs reliably without external API dependencies.

#### Acceptance Criteria

1. THE SeedDataLoader SHALL accept a configurable `seed_dir` path parameter specifying the Region_Dataset directory to load, defaulting to the bundled Paradise, CA dataset at `backend/data/seed/paradise-ca/`.
2. THE SeedDataLoader SHALL load the fire perimeter from a GeoJSON file (e.g., `camp_fire_perimeter.geojson` or any region-specific perimeter file named in Region_Config) within the specified `seed_dir` and rasterize the polygon into a binary burn mask on the Fire_Grid at 100m resolution.
3. THE SeedDataLoader SHALL load the fuel model grid from `fuel_grid.npy` within the specified `seed_dir` as a float32 NumPy array with values in the range 0.0 to 1.5.
4. THE SeedDataLoader SHALL load grid metadata from `grid_bounds.json` within the specified `seed_dir` containing the bounding box coordinates and cell resolution.
5. THE SeedDataLoader SHALL load the road network from `road_graph.json` within the specified `seed_dir` and construct a NetworkX DiGraph with travel_time and capacity attributes per edge.
6. THE SeedDataLoader SHALL load population and vulnerability zones from `zones.geojson` within the specified `seed_dir`, where each feature includes population, elderly_pct, disability_pct, and evacuation_priority_weight fields.
7. THE SeedDataLoader SHALL load shelter locations from `shelters.json` within the specified `seed_dir` with capacity and accessibility attributes per shelter.
8. THE SeedDataLoader SHALL load scenario presets from `scenario_presets.json` within the specified `seed_dir`, where presets are region-specific (ignition points, wind conditions, and scenario names defined per region).
9. THE SeedDataLoader SHALL load region metadata from `region_config.json` within the specified `seed_dir` to obtain the region name, bounding box, default ignition point, and fire perimeter filename.
10. IF any required Region_Dataset file is missing or malformed, THEN THE SeedDataLoader SHALL raise a descriptive error identifying the file path and the nature of the problem.

### Requirement 4: Live Wind Data Fetch

**Priority:** High (Phase 3 — API)

**User Story:** As an evacuation planner, I want current wind conditions fetched from the National Weather Service, so that simulations reflect real-time weather.

#### Acceptance Criteria

1. WHEN the system receives a wind fetch request, THE NWS_Client SHALL resolve grid coordinates by calling `GET https://api.weather.gov/points/{lat},{lon}` and extracting gridId, gridX, and gridY from the response.
2. WHEN grid coordinates are resolved, THE NWS_Client SHALL fetch the hourly forecast by calling `GET https://api.weather.gov/gridpoints/{gridId}/{gridX},{gridY}/forecast/hourly` and parsing the first period for windSpeed, windDirection, windGust, and relativeHumidity.
3. THE NWS_Client SHALL parse windSpeed and windGust string values (e.g., "14 mph") into numeric float values in mph.
4. THE NWS_Client SHALL convert windDirection compass strings (N, NE, E, SE, S, SW, W, NW) to degree values (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°).
5. THE NWS_Client SHALL set the HTTP header `User-Agent: EvacuAI/1.0` on all requests to api.weather.gov.
6. IF the NWS API call fails or times out, THEN THE NWS_Client SHALL return a fallback wind condition (wind speed 10 mph, direction SW/225°, gust 20 mph, humidity 20%) and log a warning.
7. WHEN manual wind override values are provided by the user, THE NWS_Client SHALL use the override values instead of fetching from the API.

### Requirement 5: Evacuation Route Optimization

**Priority:** High (Phase 2 baseline, Phase 3 optimized, Phase 4 full scoring)

**User Story:** As an evacuation planner, I want to compare baseline and optimized evacuation strategies, so that I can recommend the safest routes for each zone.

#### Acceptance Criteria

**Phase 2 — Baseline Routing:**

1. THE Evacuation_Optimizer SHALL compute a baseline strategy using shortest-path routing (minimum travel_time via Dijkstra) to the nearest shelter for each Zone on the Road_Graph.
2. THE Evacuation_Optimizer SHALL output per-zone results including: best baseline route as an ordered list of node IDs and total travel_time.

**Phase 3 — Optimized Routing:**

3. THE Evacuation_Optimizer SHALL compute an optimized strategy that minimizes a weighted cost function: `cost = α * travel_time + β * congestion + γ * fire_exposure + δ * road_closure`, where α, β, γ, δ are configurable weight coefficients with sensible defaults (α=1.0, β=0.5, γ=2.0, δ=1.5).
4. WHEN computing fire_exposure per edge, THE Evacuation_Optimizer SHALL calculate the fraction of the route segment that is burning at the estimated time of traversal based on the current simulation run's Fire_Grid state.

**Phase 4 — Full Viability Scoring:**

5. THE Evacuation_Optimizer SHALL compute a Route_Viability_Score for each route as the percentage of Monte Carlo runs in which the route successfully reaches a shelter before fire arrival at any point along the route.
6. THE Evacuation_Optimizer SHALL compute a Cutoff_Time for each Zone representing the latest timestep at which evacuation can begin and still have at least one route with a Route_Viability_Score above 50%.
7. THE Evacuation_Optimizer SHALL produce an evacuation ordering of Zones sorted by descending evacuation_priority_weight, where `priority_score = (pop_weight + elderly_weight * 2.0 + disability_weight * 1.5) * fire_exposure_probability`.
8. THE Evacuation_Optimizer SHALL output per-zone results including: best route (baseline), best route (optimized), Route_Viability_Score for each, Cutoff_Time, and failure risk percentage.

### Requirement 6: REST API Layer (Synchronous)

**Priority:** High (Phase 3 — API)

**User Story:** As a frontend developer, I want a well-defined synchronous REST API with strict schema contracts, so that I can build the visualization layer independently.

#### Acceptance Criteria

1. THE API_Layer SHALL expose a `POST /api/simulate` endpoint that accepts a Pydantic_Schema request body containing ignition point (lat, lon), wind parameters (speed, direction, gust, humidity), number of Monte Carlo runs, an optional scenario preset name, and an optional `seed_dir` path to specify the Region_Dataset, and returns the full simulation results synchronously in the response body.
2. THE API_Layer SHALL validate the SimulationRequest ignition point latitude within the range -90.0 to 90.0 and longitude within the range -180.0 to 180.0, accepting any valid geographic coordinate worldwide.
3. THE API_Layer SHALL expose a `GET /api/wind` endpoint that accepts latitude and longitude query parameters and returns the current NWS wind conditions parsed into numeric values.
4. THE API_Layer SHALL expose a `GET /api/scenarios` endpoint that accepts an optional `seed_dir` query parameter and returns the list of available scenario presets from the specified Region_Dataset (defaulting to the bundled Paradise dataset).
5. THE API_Layer SHALL validate all request payloads using Pydantic models and return HTTP 422 with descriptive error messages for invalid inputs.
6. THE API_Layer SHALL return all geospatial data (burn probability maps, route geometries, zone polygons) in GeoJSON-compatible format within the response schemas.
7. THE API_Layer SHALL include CORS middleware configured to allow cross-origin requests from the frontend.

### Requirement 7: CLI Execution Mode

**Priority:** Critical (Phase 1 — MVP)

**User Story:** As a developer, I want to run the full simulation pipeline from the command line with a configurable region, so that I can test and iterate on the computation for any region independently.

#### Acceptance Criteria

1. THE system SHALL provide a CLI entry point via `python main.py` that accepts command-line arguments for ignition point (lat, lon), wind speed, wind direction, humidity, number of Monte Carlo runs, and a `--seed-dir` argument to specify the Region_Dataset directory to load.
2. WHEN the `--seed-dir` argument is not provided, THE system SHALL default to the bundled Paradise, CA Region_Dataset.
3. WHEN executed via CLI, THE system SHALL run the full pipeline: load the specified Region_Dataset, execute Monte Carlo simulations with provided or default wind values, and output aggregated results.
4. THE system SHALL write CLI output results to a JSON file in a configurable output directory.
5. THE system SHALL print a summary to stdout including: region name, total cells burned (mean), simulation duration, and number of runs completed.

### Requirement 8: Project Structure and Module Separation

**Priority:** Critical (Phase 1 — MVP)

**User Story:** As a team member, I want a clean module structure with strict separation of concerns, so that multiple developers can work in parallel without conflicts.

#### Acceptance Criteria

1. THE system SHALL organize all backend code under the `/backend` directory with separate modules for: simulation (fire spread), monte_carlo (stochastic engine), evacuation (routing and optimization), data (loaders and pipeline), api (FastAPI endpoints and schemas), and models (Pydantic data models).
2. THE system SHALL use NumPy for all grid-based simulation computations, SciPy for probability distributions and sampling, and NetworkX for road graph construction and routing.
3. THE system SHALL define all API request and response models as Pydantic schemas in a dedicated models module, shared between the API_Layer and CLI output.
4. THE system SHALL not include any frontend, visualization, or UI code in the `/backend` directory.

### Requirement 9: Demo Region Configuration

**Priority:** High (Phase 2 — Routing)

**User Story:** As a demo presenter, I want the system to ship with a complete Paradise, CA region dataset as the default, so that the demo runs immediately with realistic data while the architecture supports loading any region.

#### Acceptance Criteria

1. THE system SHALL bundle a Paradise, CA Region_Dataset at `backend/data/seed/paradise-ca/` containing all required Region_Dataset files as defined in Requirement 11.
2. THE Paradise Region_Config SHALL specify the region name "Paradise, CA", bounding box 39.65°N to 39.90°N latitude and -121.75°W to -121.40°W longitude, and the Camp Fire origin as the default ignition point.
3. THE Paradise Region_Dataset SHALL include the Camp Fire perimeter from seed data as the default initial fire state at simulation time t=0.
4. THE Paradise Region_Dataset SHALL include at least three scenario presets in `scenario_presets.json`: Fast Wind Shift, Night Evacuation, and School Zone, each with region-specific ignition points and wind parameters.
5. WHEN no `seed_dir` or region is specified by the user, THE system SHALL load the bundled Paradise, CA Region_Dataset as the default.

### Requirement 10: Simulation Output Serialization

**Priority:** Medium (Phase 4 — Polish)

**User Story:** As a frontend developer, I want simulation outputs in a well-defined serializable format, so that I can render burn maps, routes, and metrics without additional processing.

#### Acceptance Criteria

1. THE system SHALL serialize the Burn_Probability_Map as a 2D array of float values (0.0 to 1.0) with associated grid_bounds metadata (bounding box, cell size, grid dimensions).
2. THE system SHALL serialize arrival time distributions as per-cell statistics including mean, median, 10th percentile, and 90th percentile arrival timesteps.
3. THE system SHALL serialize evacuation routes as ordered lists of (lat, lon) coordinate pairs with per-segment Route_Viability_Score and travel_time.
4. THE system SHALL serialize zone results as GeoJSON features with properties including zone_id, population, Cutoff_Time, evacuation_priority_score, best_baseline_route_id, best_optimized_route_id, and failure_risk_percentage.
5. FOR ALL valid Scenario configurations, serializing results to JSON then deserializing back SHALL produce an equivalent data structure (round-trip property).

### Requirement 11: Region Dataset Specification

**Priority:** Critical (Phase 1 — MVP)

**User Story:** As a developer or data engineer, I want a well-defined standard for region datasets, so that I can prepare data for any geographic region and the system will load and simulate it correctly.

#### Acceptance Criteria

1. THE system SHALL define a Region_Dataset as a directory containing the following required files: `region_config.json`, `fuel_grid.npy`, `grid_bounds.json`, `road_graph.json`, `zones.geojson`, `shelters.json`, and `scenario_presets.json`.
2. THE system SHALL treat a fire perimeter GeoJSON file as optional within a Region_Dataset; WHEN present, the filename SHALL be specified in `region_config.json` under the `fire_perimeter_file` field.
3. THE `region_config.json` file SHALL contain the following fields: `region_name` (string), `bounding_box` (object with `min_lat`, `max_lat`, `min_lon`, `max_lon` as floats), `default_ignition_point` (object with `lat` and `lon` as floats), and `fire_perimeter_file` (string or null).
4. WHEN the SeedDataLoader loads a Region_Dataset, THE SeedDataLoader SHALL validate that all required files listed in acceptance criterion 1 are present in the directory before proceeding with data loading.
5. IF a required Region_Dataset file is missing, THEN THE SeedDataLoader SHALL raise a descriptive error listing all missing files.
6. THE SeedDataLoader SHALL validate that the `region_config.json` conforms to the expected schema (contains all required fields with correct types) and raise a descriptive error if validation fails.
7. THE system SHALL use the `default_ignition_point` from `region_config.json` when no ignition point is specified by the user, instead of relying on a hardcoded default.
8. THE system SHALL use the `bounding_box` from `region_config.json` for grid initialization and coordinate validation within the loaded region, instead of relying on hardcoded coordinate ranges.

---

## Agent Development Playbook

Below is a phased todo list with prompts to run for each phase. Each phase ends with a validation step before proceeding.

### Phase 1 — MVP: Fire Simulation Core

**Goal:** A CLI-runnable system that simulates fire spread with Monte Carlo and outputs burn probability maps. Region dataset structure is established.

| Step | Task | Agent Prompt |
|------|------|-------------|
| 1.1 | Scaffold project structure | "Create the /backend directory structure with modules: simulation/, monte_carlo/, data/, evacuation/, api/, models/. Add __init__.py files, requirements.txt with numpy, scipy, networkx, fastapi, uvicorn, pydantic, shapely, requests. Add main.py CLI entry point stub." |
| 1.2 | Define region dataset structure | "Create the region dataset directory at /backend/data/seed/paradise-ca/. Move or create all seed files there. Create region_config.json with region_name, bounding_box, default_ignition_point, and fire_perimeter_file fields for Paradise, CA." |
| 1.3 | Build seed data loaders | "Implement /backend/data/loader.py with a SeedDataLoader class that accepts a configurable seed_dir path. It loads all region dataset files (region_config.json, fuel_grid.npy, grid_bounds.json, fire perimeter if specified, road_graph.json, zones.geojson, shelters.json, scenario_presets.json) with validation for required files and error handling for missing/malformed files. Default seed_dir to backend/data/seed/paradise-ca/. Create synthetic seed data files for development." |
| 1.4 | Implement fire spread engine | "Implement /backend/simulation/fire_spread.py with the simplified Rothermel model: R0=0.05 km/min, wind_factor=exp(0.1783*wind_speed*cos(angle)), moisture_factor=1-(rh/100)*0.8. Grid is 100m cells, 1-min timesteps. Use NumPy vectorized operations. Track ignition times per cell." |
| 1.5 | Implement Monte Carlo engine | "Implement /backend/monte_carlo/engine.py that runs N simulations sampling wind_speed~Normal(μ,3), wind_dir~Normal(μ,15), civ_delay~Uniform(2,15), road_closure~Beta(1.5,8.5). Aggregate into burn probability map and arrival time stats. Support deterministic seeding." |
| 1.6 | Wire CLI entry point | "Wire /backend/main.py to accept CLI args (--lat, --lon, --wind-speed, --wind-dir, --humidity, --runs, --seed-dir), load the specified region dataset (defaulting to paradise-ca), run Monte Carlo, and output results JSON + stdout summary including region name." |

**Validation:** `python backend/main.py --runs 10` completes without error using the Paradise default region and produces a results JSON with a burn probability map. `python backend/main.py --seed-dir path/to/other/region --runs 10` loads a different region dataset.

### Phase 2 — Routing: Road Graph + Baseline Evacuation

**Goal:** Shortest-path evacuation routing on the road network with per-zone results.

| Step | Task | Agent Prompt |
|------|------|-------------|
| 2.1 | Build road graph loader | "Enhance /backend/data/loader.py to construct a NetworkX DiGraph from road_graph.json with travel_time and capacity edge attributes. Map highway classes to default speeds and capacities per the dataspec." |
| 2.2 | Implement baseline routing | "Implement /backend/evacuation/router.py with baseline shortest-path routing using Dijkstra on travel_time to nearest shelter for each zone centroid. Output per-zone: route node list, total travel_time, shelter_id." |
| 2.3 | Verify demo region defaults | "Ensure the Paradise region_config.json provides correct defaults (bbox, Camp Fire ignition point, scenario presets). Ensure CLI runs with zero arguments using all defaults from the bundled Paradise region dataset." |

**Validation:** `python backend/main.py --runs 10` now includes per-zone baseline routes in the output JSON, with defaults sourced from region_config.json.

### Phase 3 — API: FastAPI + Optimized Routing + Wind

**Goal:** Synchronous REST API serving simulation results, live wind fetch, optimized routing. API accepts any valid lat/lon worldwide.

| Step | Task | Agent Prompt |
|------|------|-------------|
| 3.1 | Define Pydantic schemas | "Create /backend/models/schemas.py with Pydantic models for: SimulationRequest (lat: -90 to 90, lon: -180 to 180, optional seed_dir), SimulationResponse, WindResponse, ScenarioPreset. Include all fields from requirements." |
| 3.2 | Implement FastAPI endpoints | "Implement /backend/api/routes.py with synchronous POST /api/simulate (accepts optional seed_dir), GET /api/wind, GET /api/scenarios (accepts optional seed_dir query param). Wire to simulation and data modules. Add CORS middleware." |
| 3.3 | Implement NWS wind client | "Implement /backend/data/wind_client.py that fetches from api.weather.gov, parses wind strings to floats, converts compass to degrees. Include fallback values and manual override support. Works for any lat/lon worldwide." |
| 3.4 | Implement optimized routing | "Extend /backend/evacuation/router.py with optimized cost function: cost = α*travel_time + β*congestion + γ*fire_exposure + δ*road_closure. Compute fire_exposure from simulation grid state at traversal time. Return both baseline and optimized routes." |

**Validation:** `uvicorn backend.api.app:app` starts, `POST /api/simulate` returns full results with baseline and optimized routes. Lat/lon accepts any valid worldwide coordinates. Optional seed_dir parameter loads alternate region datasets.

### Phase 4 — Polish: Full Scoring + Serialization + Demo

**Goal:** Complete viability scoring, polished output format, demo-ready system.

| Step | Task | Agent Prompt |
|------|------|-------------|
| 4.1 | Add viability scoring | "Extend /backend/evacuation/router.py with Route_Viability_Score (% MC runs route succeeds), Cutoff_Time per zone, evacuation ordering by priority_score, and failure risk percentage." |
| 4.2 | Polish output serialization | "Ensure all outputs match Requirement 10: burn map as 2D float array with grid_bounds, arrival times with percentiles, routes as (lat,lon) pairs, zones as GeoJSON. Verify round-trip JSON serialization." |
| 4.3 | End-to-end demo flow | "Test the full demo flow: default Paradise scenario → simulate → view results → change wind → re-simulate → compare. Ensure 3-minute demo is achievable. Test with a second region dataset to verify region-agnostic architecture. Add README with setup and demo instructions." |

**Validation:** Full end-to-end run with `POST /api/simulate` returns complete results including viability scores, cutoff times, and evacuation ordering. CLI produces equivalent output. System works with both the bundled Paradise dataset and a custom region dataset.
