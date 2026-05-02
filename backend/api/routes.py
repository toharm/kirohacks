"""FastAPI endpoint definitions."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.data.loader import SeedDataLoader, SeedDataError
from backend.data.wind_client import NWSWindClient
from backend.models.schemas import (
    SimulationRequest,
    SimulationResponse,
    SimulationSummary,
    WindConditions,
    WindResponse,
    RouteResult,
    ZoneResult,
    ScenarioPreset,
)
from backend.monte_carlo.engine import MonteCarloEngine
from backend.simulation.fire_spread import FireSpreadEngine

router = APIRouter()

ALLOWED_SEED_BASE = Path("backend/data/seed/").resolve()
DEFAULT_SEED_DIR = "backend/data/seed/paradise-ca/"


def _validate_seed_dir(seed_dir: str) -> str:
    """Validate seed_dir stays within the allowed base directory."""
    resolved = Path(seed_dir).resolve()
    if not str(resolved).startswith(str(ALLOWED_SEED_BASE)):
        raise HTTPException(
            status_code=400,
            detail="seed_dir must be within backend/data/seed/",
        )
    return str(resolved)


@router.post("/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest):
    """Run a full Monte Carlo wildfire simulation."""
    # Load region dataset
    seed_dir = _validate_seed_dir(req.seed_dir or DEFAULT_SEED_DIR)
    try:
        loader = SeedDataLoader(seed_dir=seed_dir)
        data = loader.load_all()
    except SeedDataError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Apply scenario preset if specified
    scenario_name = "custom"
    if req.scenario_preset:
        preset = next((p for p in data.scenario_presets if p.name == req.scenario_preset), None)
        if preset is None:
            names = [p.name for p in data.scenario_presets]
            raise HTTPException(status_code=400, detail=f"Unknown scenario preset '{req.scenario_preset}'. Available: {names}")
        scenario_name = preset.name
        ignition_lat = preset.ignition_lat
        ignition_lon = preset.ignition_lon
        wind = WindConditions(
            wind_speed_mph=preset.wind_speed_mph,
            wind_direction_deg=preset.wind_direction_deg,
            wind_gust_mph=preset.wind_gust_mph,
            relative_humidity=preset.relative_humidity,
        )
    else:
        ignition_lat = req.ignition_lat
        ignition_lon = req.ignition_lon
        wind = WindConditions(
            wind_speed_mph=req.wind_speed_mph,
            wind_direction_deg=req.wind_direction_deg,
            wind_gust_mph=req.wind_gust_mph,
            relative_humidity=req.relative_humidity,
        )

    # Run Monte Carlo
    fire_engine = FireSpreadEngine(data.fuel_grid, data.grid_bounds)
    mc_engine = MonteCarloEngine(fire_engine, data.road_graph, data.zones, data.shelters)

    try:
        result = mc_engine.run(
            ignition_point=(ignition_lat, ignition_lon),
            wind_speed_mph=wind.wind_speed_mph,
            wind_direction_deg=wind.wind_direction_deg,
            wind_gust_mph=wind.wind_gust_mph,
            relative_humidity=wind.relative_humidity,
            num_runs=req.num_runs,
            seed=req.seed,
            max_timesteps=req.max_timesteps,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Build zone lookup for population/geometry
    zone_map = {z.zone_id: z for z in data.zones}

    # Build zone results and evacuation ordering
    zone_results = []
    for zr in result.zone_results:
        zone = zone_map[zr.zone_id]

        baseline_route = RouteResult(
            route_id=f"{zr.zone_id}-baseline",
            zone_id=zr.zone_id,
            shelter_id=zr.baseline_route.shelter_id if zr.baseline_route else "none",
            path_coords=zr.baseline_route.path_coords if zr.baseline_route else [],
            node_ids=zr.baseline_route.node_ids if zr.baseline_route else [],
            total_travel_time_min=zr.baseline_route.total_travel_time if zr.baseline_route else 0.0,
            viability_score=zr.viability_score,
            strategy="baseline",
        )

        optimized_route = None
        if zr.optimized_route and zr.optimized_route.node_ids:
            optimized_route = RouteResult(
                route_id=f"{zr.zone_id}-optimized",
                zone_id=zr.zone_id,
                shelter_id=zr.optimized_route.shelter_id,
                path_coords=zr.optimized_route.path_coords,
                node_ids=zr.optimized_route.node_ids,
                total_travel_time_min=zr.optimized_route.total_travel_time,
                viability_score=zr.viability_score,
                strategy="optimized",
            )

        zone_results.append(ZoneResult(
            zone_id=zr.zone_id,
            population=zone.population,
            evacuation_priority_score=zone.evacuation_priority_weight,
            cutoff_time=zr.cutoff_time,
            failure_risk_pct=zr.failure_risk_pct,
            baseline_route=baseline_route,
            optimized_route=optimized_route,
            geometry=zone.geometry,
        ))

    # Fire-aware evacuation ordering: sort by failure risk descending (most urgent first),
    # then by cutoff time ascending (least time to evacuate first)
    zone_results.sort(key=lambda z: (-z.failure_risk_pct, z.cutoff_time or 999))
    evacuation_ordering = [z.zone_id for z in zone_results]

    return SimulationResponse(
        region_name=data.region_config.region_name,
        scenario=scenario_name,
        num_runs=result.runs_completed,
        max_timesteps=req.max_timesteps,
        wind=wind,
        grid_bounds=data.grid_bounds,
        burn_probability_map=result.burn_probability_map,
        arrival_time_stats=result.arrival_time_stats,
        zone_results=zone_results,
        evacuation_ordering=evacuation_ordering,
        summary=SimulationSummary(
            mean_cells_burned=result.mean_cells_burned,
            median_cells_burned=result.median_cells_burned,
            simulation_duration_sec=result.simulation_duration_sec,
            runs_completed=result.runs_completed,
        ),
    )


@router.get("/wind", response_model=WindResponse)
def get_wind(lat: float, lon: float):
    """Fetch current wind conditions for a location from NWS."""
    client = NWSWindClient()
    result = client.fetch(lat=lat, lon=lon)

    return WindResponse(conditions=result.conditions, source=result.source)


@router.get("/scenarios", response_model=list[ScenarioPreset])
def list_scenarios(seed_dir: str = DEFAULT_SEED_DIR):
    """List available scenario presets for a region."""
    validated = _validate_seed_dir(seed_dir)
    try:
        loader = SeedDataLoader(seed_dir=validated)
        return loader.load_scenario_presets()
    except SeedDataError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
