# Requirements Document

## Introduction

EvacuAI is a computation-first Python backend that simulates wildfire spread under uncertainty using Monte Carlo methods and evaluates evacuation route viability for first responders and emergency planners. The system uses a simplified Rothermel fire spread model on a grid, runs ~500 Monte Carlo simulations per scenario, and compares baseline vs. optimized evacuation strategies over a real road network. The demo region is Paradise, CA (Camp Fire 2018). The backend serves results via a FastAPI REST API and is also runnable as a standalone CLI tool.

**Skills Reference:** engineering-backend-architect (system architecture, API design, service decomposition), engineering-data-engineer (data pipeline design, seed data processing, data quality).

## Glossary

- **Simulation_Engine**: The core Python module that executes the simplified Rothermel fire spread model on a NumPy grid, advancing fire state over discrete timesteps.
- **Monte_Carlo_Engine**: The module that orchestrates ~500 stochastic simulation runs per scenario, sampling wind speed, wind direction, civilian delay, and road closure probability from defined distributions.
- **Evacuation_Optimizer**: The module that computes evacuation routes over a NetworkX DiGraph road network, comparing baseline (shortest-path) and optimized (multi-factor cost) strategies.
- **Data_Pipeline**: The collection of preprocessing scripts and loaders that ingest seed data files and live wind data into simulation-ready formats.
- **API_Layer**: The FastAPI application that exposes simulation, results, wind, and scenario endpoints with Pydantic-validated request/response schemas.
- **Fire_Grid**: A 2D NumPy float32 array representing the simulation area at 100m cell resolution, where each cell holds burn state, ignition time, and spread probability.
- **Fuel_Grid**: A pre-processed NumPy float32 array derived from LANDFIRE FBFM40 data, containing spread rate multipliers (0.0–1.5) per cell.
- **Road_Graph**: A NetworkX DiGraph built from pre-fetched OpenStreetMap data, where edges carry travel_time, capacity, fire_exposure, and closure_probability attributes.
- **Burn_Probability_Map**: A 2D array aggregated over all Monte Carlo runs, where each cell value represents the fraction of runs in which that cell ignited.
- **Zone**: A census block group polygon with associated population count, vulnerability weights (elderly percentage, disability percentage), and computed evacuation priority score.
- **Route_Viability_Score**: The percentage of Monte Carlo runs in which a given evacuation route successfully reaches a shelter before fire arrival.
- **Cutoff_Time**: The latest simulation timestep at which a zone can still begin evacuation and have at least one viable route to a shelter.
- **Scenario**: A named configuration combining an ignition point, wind parameters, uncertainty settings, and optional presets (e.g., Fast Wind Shift, Night Evacuation).
- **Seed_Data**: Pre-fetched and pre-processed data files stored in `/backend/data/seed/` that the system loads at startup without live API calls.
- **NWS_Client**: The module responsible for fetching live wind forecast data from the National Weather Service api.weather.gov API.
- **Rothermel_Model**: The simplified fire behavior model using base spread rate R0=0.05 km/min, wind factor exponent 0.1783, and moisture dampening up to 0.8 reduction.
- **Pydantic_Schema**: A strict data contract defined using Pydantic models for all API request and response payloads.

## Requirements

### Requirement 1: Fire Spread Simulation on Grid

**User Story:** As an evacuation planner, I want to simulate wildfire spread on a realistic terrain grid, so that I can see how fire propagates under given conditions.

#### Acceptance Criteria

1. WHEN an ignition point and wind parameters are provided, THE Simulation_Engine SHALL compute fire spread on a Fire_Grid using the simplified Rothermel_Model with 100m cell resolution and 1-minute timesteps.
2. THE Simulation_Engine SHALL calculate spread probability for each cell using the formula: `spread_rate = R0 * fuel_multiplier * wind_factor * moisture_factor`, where `wind_factor = exp(0.1783 * wind_speed_mph * cos(wind_angle_to_cell))` and `moisture_factor = 1 - (relative_humidity / 100) * 0.8`.
3. WHEN computing spread direction, THE Simulation_Engine SHALL favor downwind propagation by applying the cosine-weighted wind factor relative to each neighboring cell's bearing from the burning cell.
4. THE Simulation_Engine SHALL use the Fuel_Grid spread rate multipliers (range 0.0 to 1.5) to modify the base spread rate R0 of 0.05 km/min per cell.
5. WHEN a cell has a non-burnable fuel code (FBFM40 codes 91–99, multiplier 0.0), THE Simulation_Engine SHALL prevent fire from spreading into that cell.
6. THE Simulation_Engine SHALL record the ignition timestep for each cell that catches fire during the simulation run.

### Requirement 2: Monte Carlo Stochastic Engine

**User Story:** As an evacuation planner, I want to run hundreds of stochastic simulations per scenario, so that I can understand the range of possible fire outcomes and make probability-informed decisions.

#### Acceptance Criteria

1. WHEN a scenario is submitted, THE Monte_Carlo_Engine SHALL execute approximately 500 independent simulation runs with stochastically sampled parameters.
2. THE Monte_Carlo_Engine SHALL sample wind speed from a Normal distribution centered on the NWS forecast value with σ=3 mph, clamped to the NWS wind gust value as an upper bound.
3. THE Monte_Carlo_Engine SHALL sample wind direction from a Normal distribution centered on the NWS forecast direction (converted to degrees) with σ=15°.
4. THE Monte_Carlo_Engine SHALL sample civilian evacuation delay from a Uniform(2, 15) distribution in minutes per run.
5. THE Monte_Carlo_Engine SHALL sample road closure probability per edge from a Beta(1.5, 8.5) distribution per run.
6. WHEN all runs complete, THE Monte_Carlo_Engine SHALL aggregate results into: a Burn_Probability_Map, arrival time distributions per cell, Zone Cutoff_Times, Route_Viability_Scores, evacuation success probability per zone, and uncertainty ranges for each metric.
7. THE Monte_Carlo_Engine SHALL produce stable probability estimates, where running the engine twice on the same scenario with the same random seed yields identical results.

### Requirement 3: Seed Data Loading and Preprocessing

**User Story:** As a developer, I want all non-wind data pre-bundled and loadable from local files, so that the demo runs reliably without external API dependencies.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL load the Camp Fire perimeter from `camp_fire_perimeter.geojson` in `/backend/data/seed/` and rasterize the polygon into a binary burn mask on the Fire_Grid at 100m resolution.
2. THE Data_Pipeline SHALL load the road network from `road_graph.json` in `/backend/data/seed/` and construct a NetworkX DiGraph with travel_time, capacity, fire_exposure, and closure_probability attributes per edge.
3. THE Data_Pipeline SHALL load the fuel model grid from `fuel_grid.npy` in `/backend/data/seed/` as a float32 NumPy array with values in the range 0.0 to 1.5.
4. THE Data_Pipeline SHALL load grid metadata from `grid_bounds.json` in `/backend/data/seed/` containing the bounding box coordinates and cell resolution.
5. THE Data_Pipeline SHALL load population and vulnerability zones from `zones.geojson` in `/backend/data/seed/`, where each feature includes population, elderly_pct, disability_pct, and evacuation_priority_weight fields.
6. THE Data_Pipeline SHALL load shelter locations from `shelters.json` in `/backend/data/seed/` with capacity and accessibility attributes per shelter.
7. THE Data_Pipeline SHALL load scenario presets from `scenario_presets.json` in `/backend/data/seed/` containing named configurations for Fast Wind Shift, Night Evacuation, and School Zone scenarios.
8. IF any seed data file is missing or malformed, THEN THE Data_Pipeline SHALL raise a descriptive error identifying the file path and the nature of the problem.

### Requirement 4: Live Wind Data Fetch

**User Story:** As an evacuation planner, I want current wind conditions fetched from the National Weather Service, so that simulations reflect real-time weather.

#### Acceptance Criteria

1. WHEN the system initializes a simulation or receives a wind fetch request, THE NWS_Client SHALL resolve grid coordinates by calling `GET https://api.weather.gov/points/{lat},{lon}` and extracting gridId, gridX, and gridY from the response.
2. WHEN grid coordinates are resolved, THE NWS_Client SHALL fetch the hourly forecast by calling `GET https://api.weather.gov/gridpoints/{gridId}/{gridX},{gridY}/forecast/hourly` and parsing the first period for windSpeed, windDirection, windGust, and relativeHumidity.
3. THE NWS_Client SHALL parse windSpeed and windGust string values (e.g., "14 mph") into numeric float values in mph.
4. THE NWS_Client SHALL convert windDirection compass strings (N, NE, E, SE, S, SW, W, NW) to degree values (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°).
5. THE NWS_Client SHALL set the HTTP header `User-Agent: EvacuAI/1.0` on all requests to api.weather.gov.
6. IF the NWS API call fails or times out, THEN THE NWS_Client SHALL return a fallback wind condition (wind speed 10 mph, direction SW/225°, gust 20 mph, humidity 20%) and log a warning.
7. WHEN manual wind override values are provided by the user, THE NWS_Client SHALL use the override values instead of fetching from the API.

### Requirement 5: Evacuation Route Optimization

**User Story:** As an evacuation planner, I want to compare baseline and optimized evacuation strategies, so that I can recommend the safest routes for each zone.

#### Acceptance Criteria

1. THE Evacuation_Optimizer SHALL compute a baseline strategy using shortest-path routing (minimum travel_time) to the nearest shelter for each Zone on the Road_Graph.
2. THE Evacuation_Optimizer SHALL compute an optimized strategy that minimizes a weighted cost function: `cost = α * travel_time + β * congestion + γ * fire_exposure + δ * road_closure`, where α, β, γ, δ are configurable weight coefficients.
3. WHEN computing fire_exposure per edge, THE Evacuation_Optimizer SHALL calculate the fraction of the route segment that is burning at the estimated time of traversal based on the current simulation run's Fire_Grid state.
4. THE Evacuation_Optimizer SHALL compute a Route_Viability_Score for each route as the percentage of Monte Carlo runs in which the route successfully reaches a shelter before fire arrival at any point along the route.
5. THE Evacuation_Optimizer SHALL compute a Cutoff_Time for each Zone representing the latest timestep at which evacuation can begin and still have at least one route with a Route_Viability_Score above 50%.
6. THE Evacuation_Optimizer SHALL produce an evacuation ordering of Zones sorted by descending evacuation_priority_weight, where `priority_weight = pop_weight + elderly_weight + disability_weight` and `priority_score = priority_weight * fire_exposure_probability`.
7. THE Evacuation_Optimizer SHALL output per-zone results including: best route (baseline), best route (optimized), Route_Viability_Score for each, Cutoff_Time, and failure risk percentage.

### Requirement 6: REST API Layer

**User Story:** As a frontend developer, I want a well-defined REST API with strict schema contracts, so that I can build the visualization layer independently.

#### Acceptance Criteria

1. THE API_Layer SHALL expose a `POST /api/simulate` endpoint that accepts a Pydantic_Schema request body containing ignition point (lat, lon), wind parameters (speed, direction, gust, humidity), number of Monte Carlo runs, and optional scenario preset name, and returns a simulation job identifier.
2. THE API_Layer SHALL expose a `GET /api/results/{job_id}` endpoint that returns the aggregated Monte Carlo results including Burn_Probability_Map, arrival time distributions, Zone Cutoff_Times, Route_Viability_Scores per zone, evacuation ordering, and baseline vs. optimized route comparisons.
3. THE API_Layer SHALL expose a `GET /api/wind` endpoint that accepts latitude and longitude query parameters and returns the current NWS wind conditions parsed into numeric values.
4. THE API_Layer SHALL expose a `GET /api/scenarios` endpoint that returns the list of available scenario presets from scenario_presets.json.
5. THE API_Layer SHALL validate all request payloads using Pydantic models and return HTTP 422 with descriptive error messages for invalid inputs.
6. THE API_Layer SHALL return all geospatial data (burn probability maps, route geometries, zone polygons) in GeoJSON-compatible format within the response schemas.
7. IF a simulation job is still running, THEN THE API_Layer SHALL return HTTP 202 with a status field indicating progress when `GET /api/results/{job_id}` is called.

### Requirement 7: CLI Execution Mode

**User Story:** As a developer, I want to run the full simulation pipeline from the command line without starting a web server, so that I can test and iterate on the computation independently.

#### Acceptance Criteria

1. THE system SHALL provide a CLI entry point via `python main.py` that accepts command-line arguments for ignition point (lat, lon), wind parameters, number of Monte Carlo runs, and optional scenario preset name.
2. WHEN executed via CLI, THE system SHALL run the full pipeline: load seed data, fetch or accept wind data, execute Monte Carlo simulations, compute evacuation routes, and output aggregated results.
3. THE system SHALL write CLI output results to a JSON file in a configurable output directory, containing the same data structure as the `GET /api/results/{job_id}` API response.
4. IF the `--no-wind-fetch` flag is provided, THEN THE system SHALL skip the live NWS API call and use default or user-provided wind values.

### Requirement 8: Project Structure and Module Separation

**User Story:** As a team member, I want a clean module structure with strict separation of concerns, so that multiple developers can work in parallel without conflicts.

#### Acceptance Criteria

1. THE system SHALL organize all backend code under the `/backend` directory with separate modules for: simulation (fire spread), monte_carlo (stochastic engine), evacuation (routing and optimization), data (loaders and pipeline), api (FastAPI endpoints and schemas), and models (Pydantic data models).
2. THE system SHALL use NumPy for all grid-based simulation computations, SciPy for probability distributions and sampling, and NetworkX for road graph construction and routing.
3. THE system SHALL define all API request and response models as Pydantic schemas in a dedicated models module, shared between the API_Layer and CLI output.
4. THE system SHALL not include any frontend, visualization, or UI code in the `/backend` directory.

### Requirement 9: Demo Region Configuration

**User Story:** As a demo presenter, I want the system pre-configured for the Paradise, CA Camp Fire region, so that the demo runs immediately with realistic data.

#### Acceptance Criteria

1. THE system SHALL default to the Paradise, CA demo region with bounding box 39.65°N to 39.90°N latitude, -121.75°W to -121.40°W longitude.
2. THE system SHALL use the Camp Fire perimeter from seed data as the default initial fire state at simulation time t=0.
3. WHEN no ignition point is specified, THE system SHALL use the Camp Fire origin coordinates as the default ignition point.
4. THE system SHALL include at least three scenario presets in seed data: Fast Wind Shift (wind direction change mid-simulation), Night Evacuation (reduced visibility and civilian delay), and School Zone (elevated population density near schools).

### Requirement 10: Simulation Output Serialization

**User Story:** As a frontend developer, I want simulation outputs in a well-defined serializable format, so that I can render burn maps, routes, and metrics without additional processing.

#### Acceptance Criteria

1. THE system SHALL serialize the Burn_Probability_Map as a 2D array of float values (0.0 to 1.0) with associated grid_bounds metadata (bounding box, cell size, grid dimensions).
2. THE system SHALL serialize arrival time distributions as per-cell statistics including mean, median, 10th percentile, and 90th percentile arrival timesteps.
3. THE system SHALL serialize evacuation routes as ordered lists of (lat, lon) coordinate pairs with per-segment Route_Viability_Score and travel_time.
4. THE system SHALL serialize zone results as GeoJSON features with properties including zone_id, population, Cutoff_Time, evacuation_priority_score, best_baseline_route_id, best_optimized_route_id, and failure_risk_percentage.
5. FOR ALL valid Scenario configurations, serializing results to JSON then deserializing back SHALL produce an equivalent data structure (round-trip property).
