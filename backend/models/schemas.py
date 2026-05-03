from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# --- Region Configuration ---

class BoundingBox(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


class DefaultIgnitionPoint(BaseModel):
    lat: float
    lon: float


class RegionConfig(BaseModel):
    region_name: str
    bounding_box: BoundingBox
    default_ignition_point: DefaultIgnitionPoint
    fire_perimeter_file: Optional[str] = None


# --- Request Models ---

class SimulationRequest(BaseModel):
    ignition_lat: float = Field(..., ge=-90.0, le=90.0)
    ignition_lon: float = Field(..., ge=-180.0, le=180.0)
    wind_speed_mph: float = Field(14.0, ge=0, le=100)
    wind_direction_deg: float = Field(225.0, ge=0, lt=360)
    wind_gust_mph: float = Field(20.0, ge=0, le=150)
    relative_humidity: float = Field(18.0, ge=0, le=100)
    num_runs: int = Field(500, ge=1, le=2000)
    max_timesteps: int = Field(180, ge=1, le=1440)
    scenario_preset: Optional[str] = None
    seed: Optional[int] = None
    seed_dir: Optional[str] = None


# --- Core Data Models ---

class GridBounds(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float
    cell_size_m: float = 100.0
    grid_rows: int
    grid_cols: int


class WindConditions(BaseModel):
    wind_speed_mph: float
    wind_direction_deg: float
    wind_gust_mph: float
    relative_humidity: float


class Zone(BaseModel):
    zone_id: str
    population: int
    elderly_pct: float
    disability_pct: float
    evacuation_priority_weight: float
    centroid_lat: float
    centroid_lon: float
    geometry: dict[str, Any]


class Shelter(BaseModel):
    shelter_id: str
    name: str
    lat: float
    lon: float
    capacity: int
    accessible: bool


class ScenarioPreset(BaseModel):
    name: str
    description: str
    ignition_lat: float
    ignition_lon: float
    wind_speed_mph: float
    wind_direction_deg: float
    wind_gust_mph: float
    relative_humidity: float


class CostWeights(BaseModel):
    alpha: float = Field(1.0, description="travel_time weight")
    beta: float = Field(0.5, description="congestion weight")
    gamma: float = Field(2.0, description="fire_exposure weight")
    delta: float = Field(1.5, description="road_closure weight")


# --- Result Models ---

class BurnProbabilityMap(BaseModel):
    grid_bounds: GridBounds
    data: list[list[float]]


class ArrivalTimeStats(BaseModel):
    grid_bounds: GridBounds
    mean: list[list[Optional[float]]]
    median: list[list[Optional[float]]]
    p10: list[list[Optional[float]]]
    p90: list[list[Optional[float]]]


class RouteResult(BaseModel):
    route_id: str
    zone_id: str
    shelter_id: str
    path_coords: list[tuple[float, float]]
    node_ids: list[int]
    total_travel_time_min: float
    viability_score: Optional[float] = None
    strategy: str  # "baseline" or "optimized"


class ZoneResult(BaseModel):
    zone_id: str
    population: int
    evacuation_priority_score: float
    cutoff_time: Optional[int] = None
    failure_risk_pct: Optional[float] = None
    baseline_route: RouteResult
    optimized_route: Optional[RouteResult] = None
    geometry: dict[str, Any]


# --- Response Models ---

class SimulationSummary(BaseModel):
    mean_cells_burned: float
    median_cells_burned: float
    simulation_duration_sec: float
    runs_completed: int


class SimulationResponse(BaseModel):
    region_name: str
    scenario: str
    num_runs: int
    max_timesteps: int
    wind: WindConditions
    grid_bounds: GridBounds
    burn_probability_map: BurnProbabilityMap
    arrival_time_stats: ArrivalTimeStats
    zone_results: list[ZoneResult]
    evacuation_ordering: list[str]
    summary: SimulationSummary


class WindResponse(BaseModel):
    conditions: WindConditions
    source: str
    forecast_text: Optional[str] = None


# --- Ingest Models ---

class IngestRequest(BaseModel):
    lat: float = Field(..., ge=18.0, le=72.0)
    lon: float = Field(..., ge=-180.0, le=-65.0)
    radius_km: float = Field(10.0, ge=1.0, le=50.0)


class IngestResponse(BaseModel):
    status: str
    region_slug: str
    warnings: list[str] = []


class IngestStatusResponse(BaseModel):
    status: str
    progress_pct: int
    completed_files: list[str] = []
    warnings: list[str] = []


# --- Seed Data Container ---
# Internal container — not serialized over the wire, so use a dataclass.

from dataclasses import dataclass as _dataclass, field as _field
import numpy as _np
import networkx as _nx

@_dataclass
class SeedData:
    region_config: RegionConfig
    grid_bounds: GridBounds
    fuel_grid: _np.ndarray
    road_graph: _nx.DiGraph
    zones: list[Zone]
    shelters: list[Shelter]
    scenario_presets: list[ScenarioPreset]
    fire_perimeter: Any = None
