"""Pydantic request/response models for EvacuAI.

Defines all data contracts shared between the CLI and API layers,
including region configuration, simulation requests/responses,
core data models, and result serialization schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Region Configuration
# ---------------------------------------------------------------------------

class BoundingBox(BaseModel):
    """Geographic bounding box for a region."""

    min_lat: float = Field(..., description="Southern boundary latitude")
    max_lat: float = Field(..., description="Northern boundary latitude")
    min_lon: float = Field(..., description="Western boundary longitude")
    max_lon: float = Field(..., description="Eastern boundary longitude")


class DefaultIgnitionPoint(BaseModel):
    """Default ignition point for a region."""

    lat: float = Field(..., description="Ignition latitude")
    lon: float = Field(..., description="Ignition longitude")


class RegionConfig(BaseModel):
    """Region metadata loaded from region_config.json.

    Contains the region name, geographic bounding box, default ignition
    point, and an optional fire perimeter filename.
    """

    region_name: str = Field(..., description="Human-readable region name")
    bounding_box: BoundingBox = Field(..., description="Geographic bounding box for the region")
    default_ignition_point: DefaultIgnitionPoint = Field(
        ..., description="Default ignition point when none is specified by the user"
    )
    fire_perimeter_file: Optional[str] = Field(
        None, description="Filename of the fire perimeter GeoJSON within the region dataset"
    )


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class SimulationRequest(BaseModel):
    """Request body for POST /api/simulate.

    Accepts worldwide coordinates (lat -90 to 90, lon -180 to 180) and
    optional parameters for wind, Monte Carlo runs, and region dataset.
    """

    ignition_lat: float = Field(
        ..., ge=-90.0, le=90.0, description="Ignition latitude (worldwide, -90 to 90)"
    )
    ignition_lon: float = Field(
        ..., ge=-180.0, le=180.0, description="Ignition longitude (worldwide, -180 to 180)"
    )
    wind_speed_mph: float = Field(
        14.0, ge=0, le=100, description="Wind speed in mph"
    )
    wind_direction_deg: float = Field(
        225.0, ge=0, lt=360, description="Wind direction in degrees (0=N, 90=E, 180=S, 270=W)"
    )
    wind_gust_mph: float = Field(
        20.0, ge=0, le=150, description="Wind gust speed in mph"
    )
    relative_humidity: float = Field(
        18.0, ge=0, le=100, description="Relative humidity percentage"
    )
    num_runs: int = Field(
        500, ge=1, le=2000, description="Number of Monte Carlo simulation runs"
    )
    max_timesteps: int = Field(
        180, ge=1, le=1440, description="Maximum simulation timesteps (1-min each)"
    )
    scenario_preset: Optional[str] = Field(
        None, description="Named scenario preset to apply"
    )
    seed: Optional[int] = Field(
        None, description="Random seed for deterministic reproducibility"
    )
    seed_dir: Optional[str] = Field(
        None, description="Path to Region Dataset directory (defaults to bundled Paradise, CA)"
    )


# ---------------------------------------------------------------------------
# Core Data Models
# ---------------------------------------------------------------------------

class GridBounds(BaseModel):
    """Bounding box and resolution metadata for the simulation grid."""

    min_lat: float = Field(..., description="Southern boundary latitude")
    max_lat: float = Field(..., description="Northern boundary latitude")
    min_lon: float = Field(..., description="Western boundary longitude")
    max_lon: float = Field(..., description="Eastern boundary longitude")
    cell_size_m: float = Field(100.0, description="Cell size in meters")
    grid_rows: int = Field(..., description="Number of rows in the grid")
    grid_cols: int = Field(..., description="Number of columns in the grid")


class WindConditions(BaseModel):
    """Parsed wind conditions from NWS or manual override."""

    wind_speed_mph: float = Field(..., ge=0, le=200, description="Wind speed in mph")
    wind_direction_deg: float = Field(..., ge=0, lt=360, description="Wind direction in degrees")
    wind_gust_mph: float = Field(..., ge=0, le=300, description="Wind gust speed in mph")
    relative_humidity: float = Field(..., ge=0, le=100, description="Relative humidity percentage")


class Zone(BaseModel):
    """Census block group with population and vulnerability data."""

    zone_id: str = Field(..., description="Unique zone identifier")
    population: int = Field(..., description="Total population in the zone")
    elderly_pct: float = Field(..., description="Percentage of elderly residents")
    disability_pct: float = Field(..., description="Percentage of residents with disabilities")
    evacuation_priority_weight: float = Field(
        ..., description="Computed evacuation priority weight"
    )
    centroid_lat: float = Field(..., description="Zone centroid latitude")
    centroid_lon: float = Field(..., description="Zone centroid longitude")
    geometry: dict = Field(..., description="GeoJSON polygon geometry")


class Shelter(BaseModel):
    """Evacuation shelter with capacity and accessibility attributes."""

    shelter_id: str = Field(..., description="Unique shelter identifier")
    name: str = Field(..., description="Shelter name")
    lat: float = Field(..., description="Shelter latitude")
    lon: float = Field(..., description="Shelter longitude")
    capacity: int = Field(..., description="Maximum shelter capacity")
    accessible: bool = Field(..., description="Whether the shelter is ADA accessible")


class ScenarioPreset(BaseModel):
    """Named scenario configuration with ignition and wind parameters."""

    name: str = Field(..., description="Preset name (e.g. 'Fast Wind Shift')")
    description: str = Field(..., description="Human-readable scenario description")
    ignition_lat: float = Field(..., description="Scenario ignition latitude")
    ignition_lon: float = Field(..., description="Scenario ignition longitude")
    wind_speed_mph: float = Field(..., description="Wind speed in mph")
    wind_direction_deg: float = Field(..., description="Wind direction in degrees")
    wind_gust_mph: float = Field(..., description="Wind gust speed in mph")
    relative_humidity: float = Field(..., description="Relative humidity percentage")


class CostWeights(BaseModel):
    """Configurable weights for the optimized routing cost function.

    cost = alpha * travel_time + beta * congestion
         + gamma * fire_exposure + delta * road_closure
    """

    alpha: float = Field(1.0, description="Weight for travel_time component")
    beta: float = Field(0.5, description="Weight for congestion component")
    gamma: float = Field(2.0, description="Weight for fire_exposure component")
    delta: float = Field(1.5, description="Weight for road_closure component")


# ---------------------------------------------------------------------------
# Result Models
# ---------------------------------------------------------------------------

class BurnProbabilityMap(BaseModel):
    """Aggregated burn probability across Monte Carlo runs.

    Each cell value represents the fraction of runs in which that cell
    ignited (0.0 to 1.0).
    """

    grid_bounds: GridBounds = Field(..., description="Grid bounding box and resolution metadata")
    data: list[list[float]] = Field(
        ..., description="2D array of burn probabilities (0.0 to 1.0)"
    )


class ArrivalTimeStats(BaseModel):
    """Per-cell arrival time statistics across Monte Carlo runs."""

    grid_bounds: GridBounds = Field(..., description="Grid bounding box and resolution metadata")
    mean: list[list[float]] = Field(..., description="Mean arrival timestep per cell")
    median: list[list[float]] = Field(..., description="Median arrival timestep per cell")
    p10: list[list[float]] = Field(..., description="10th percentile arrival timestep per cell")
    p90: list[list[float]] = Field(..., description="90th percentile arrival timestep per cell")


class RouteResult(BaseModel):
    """A single evacuation route with path and viability metadata."""

    route_id: str = Field(..., description="Unique route identifier")
    zone_id: str = Field(..., description="Source zone identifier")
    shelter_id: str = Field(..., description="Destination shelter identifier")
    path_coords: list[tuple[float, float]] = Field(
        ..., description="Ordered (lat, lon) coordinate pairs along the route"
    )
    node_ids: list[int] = Field(..., description="Ordered road graph node IDs along the route")
    total_travel_time_min: float = Field(..., description="Total travel time in minutes")
    viability_score: Optional[float] = Field(
        None, description="Percentage of MC runs where route reaches shelter before fire"
    )
    strategy: str = Field(..., description="Routing strategy: 'baseline' or 'optimized'")


class ZoneResult(BaseModel):
    """Per-zone evacuation results including routes and risk metrics."""

    zone_id: str = Field(..., description="Zone identifier")
    population: int = Field(..., description="Zone population")
    evacuation_priority_score: float = Field(
        ..., description="Computed evacuation priority score"
    )
    cutoff_time: Optional[int] = Field(
        None, description="Latest safe evacuation start timestep (viability > 50%)"
    )
    failure_risk_pct: Optional[float] = Field(
        None, description="Percentage of MC runs with no viable route"
    )
    baseline_route: RouteResult = Field(..., description="Baseline shortest-path route")
    optimized_route: Optional[RouteResult] = Field(
        None, description="Optimized multi-factor cost route"
    )
    geometry: dict = Field(..., description="GeoJSON polygon geometry for the zone")


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------

class SimulationSummary(BaseModel):
    """High-level summary statistics for a simulation run."""

    mean_cells_burned: float = Field(..., description="Mean cells burned across MC runs")
    median_cells_burned: float = Field(..., description="Median cells burned across MC runs")
    simulation_duration_sec: float = Field(..., description="Wall-clock simulation duration in seconds")
    runs_completed: int = Field(..., description="Number of MC runs completed")


class SimulationResponse(BaseModel):
    """Full response for POST /api/simulate.

    Contains the complete simulation results including burn probability
    maps, arrival time statistics, per-zone evacuation results, and
    summary metrics.
    """

    region_name: str = Field(..., description="Name of the simulated region")
    scenario: str = Field(..., description="Scenario name or 'custom'")
    num_runs: int = Field(..., description="Number of Monte Carlo runs executed")
    max_timesteps: int = Field(..., description="Maximum simulation timesteps")
    wind: WindConditions = Field(..., description="Wind conditions used for the simulation")
    grid_bounds: GridBounds = Field(..., description="Simulation grid metadata")
    burn_probability_map: BurnProbabilityMap = Field(
        ..., description="Aggregated burn probability map"
    )
    arrival_time_stats: ArrivalTimeStats = Field(
        ..., description="Per-cell arrival time statistics"
    )
    zone_results: list[ZoneResult] = Field(
        ..., description="Per-zone evacuation results"
    )
    evacuation_ordering: list[str] = Field(
        ..., description="Zone IDs in evacuation priority order (descending)"
    )
    summary: SimulationSummary = Field(..., description="High-level simulation summary")


class WindResponse(BaseModel):
    """Response for GET /api/wind."""

    conditions: WindConditions = Field(..., description="Parsed wind conditions")
    source: str = Field(
        ..., description="Data source: 'nws_live', 'fallback', or 'manual_override'"
    )
    forecast_text: Optional[str] = Field(
        None, description="Raw forecast text from NWS (if available)"
    )
