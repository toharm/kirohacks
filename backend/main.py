#!/usr/bin/env python3
"""EvacuAI CLI entry point."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def _zone_fire_exposure(zones, burn_probability_map, grid_bounds):
    """Compute mean burn probability across grid cells within each zone polygon."""
    import numpy as np
    from shapely.geometry import shape, Point

    gb = grid_bounds
    H, W = burn_probability_map.shape
    fire_exposure_probs = {}

    for zone in zones:
        geom = zone.geometry
        if not geom or not geom.get("coordinates"):
            # Fallback to centroid cell
            row = max(0, min(H - 1, int((gb.max_lat - zone.centroid_lat) / (gb.max_lat - gb.min_lat) * H)))
            col = max(0, min(W - 1, int((zone.centroid_lon - gb.min_lon) / (gb.max_lon - gb.min_lon) * W)))
            fire_exposure_probs[zone.zone_id] = float(burn_probability_map[row, col])
            continue

        poly = shape(geom)
        vals = []
        # Get bounding box of polygon to limit iteration
        minx, miny, maxx, maxy = poly.bounds  # (min_lon, min_lat, max_lon, max_lat)
        r_start = max(0, int((gb.max_lat - maxy) / (gb.max_lat - gb.min_lat) * H))
        r_end = min(H, int((gb.max_lat - miny) / (gb.max_lat - gb.min_lat) * H) + 1)
        c_start = max(0, int((minx - gb.min_lon) / (gb.max_lon - gb.min_lon) * W))
        c_end = min(W, int((maxx - gb.min_lon) / (gb.max_lon - gb.min_lon) * W) + 1)

        for r in range(r_start, r_end):
            lat = gb.max_lat - (r + 0.5) * (gb.max_lat - gb.min_lat) / H
            for c in range(c_start, c_end):
                lon = gb.min_lon + (c + 0.5) * (gb.max_lon - gb.min_lon) / W
                if poly.contains(Point(lon, lat)):
                    vals.append(float(burn_probability_map[r, c]))

        fire_exposure_probs[zone.zone_id] = float(np.mean(vals)) if vals else 0.0

    return fire_exposure_probs


def _run_simulation(args) -> dict:
    import numpy as np
    from backend.data.loader import SeedDataLoader
    from backend.simulation.fire_spread import FireSpreadEngine
    from backend.monte_carlo.engine import MonteCarloEngine
    from backend.evacuation.router import EvacuationRouter
    from backend.models.schemas import (
        WindConditions, SimulationResponse, SimulationSummary,
        BurnProbabilityMap, ArrivalTimeStats, ZoneResult, RouteResult,
    )

    loader = SeedDataLoader(seed_dir=args.seed_dir)
    data = loader.load_all(load_fire_perimeter=False)

    ignition_lat = args.lat if args.lat is not None else data.region_config.default_ignition_point.lat
    ignition_lon = args.lon if args.lon is not None else data.region_config.default_ignition_point.lon

    engine = FireSpreadEngine(data.fuel_grid, data.grid_bounds)
    mc = MonteCarloEngine(engine, data.road_graph, data.zones, data.shelters)

    t0 = time.time()
    result = mc.run(
        ignition_point=(ignition_lat, ignition_lon),
        wind_speed_mph=args.wind_speed,
        wind_direction_deg=args.wind_dir,
        wind_gust_mph=args.wind_gust,
        relative_humidity=args.humidity,
        num_runs=args.num_runs,
        seed=args.seed,
        max_timesteps=args.max_timesteps,
    )
    duration = time.time() - t0

    router = EvacuationRouter(data.road_graph, data.zones, data.shelters, grid_bounds=data.grid_bounds)
    baseline_routes = router.compute_baseline_routes()

    fire_exposure_probs = _zone_fire_exposure(data.zones, result.burn_probability_map, data.grid_bounds)
    ordering = router.compute_evacuation_ordering(data.zones, fire_exposure_probs)

    cells_arr = result.cells_burned_per_run
    mean_burned = float(np.mean(cells_arr))
    median_burned = float(np.median(cells_arr))

    def _nan_to_none(arr):
        return [[None if np.isnan(v) else float(v) for v in row] for row in arr]

    wind = WindConditions(
        wind_speed_mph=args.wind_speed,
        wind_direction_deg=args.wind_dir,
        wind_gust_mph=args.wind_gust,
        relative_humidity=args.humidity,
    )

    zone_results = []
    for z in data.zones:
        br = baseline_routes.get(z.zone_id)
        if br is None:
            continue
        baseline_route = RouteResult(
            route_id=f"baseline_{z.zone_id}",
            zone_id=z.zone_id,
            shelter_id=br.shelter_id,
            path_coords=br.path_coords,
            node_ids=br.node_ids,
            total_travel_time_min=br.total_travel_time,
            strategy="baseline",
        )
        fe = fire_exposure_probs.get(z.zone_id, 0.0)
        max_pop = max((zz.population for zz in data.zones), default=1)
        priority = (z.population / max_pop + (z.elderly_pct / 100) * 2.0 + (z.disability_pct / 100) * 1.5) * fe

        zone_results.append(ZoneResult(
            zone_id=z.zone_id,
            population=z.population,
            evacuation_priority_score=priority,
            baseline_route=baseline_route,
            geometry=z.geometry,
        ))

    response = SimulationResponse(
        region_name=data.region_config.region_name,
        scenario=args.scenario_preset or "custom",
        num_runs=result.num_runs,
        max_timesteps=args.max_timesteps,
        wind=wind,
        grid_bounds=data.grid_bounds,
        burn_probability_map=BurnProbabilityMap(
            grid_bounds=data.grid_bounds,
            data=result.burn_probability_map.tolist(),
        ),
        arrival_time_stats=ArrivalTimeStats(
            grid_bounds=data.grid_bounds,
            mean=_nan_to_none(result.arrival_time_mean),
            median=_nan_to_none(result.arrival_time_median),
            p10=_nan_to_none(result.arrival_time_p10),
            p90=_nan_to_none(result.arrival_time_p90),
        ),
        zone_results=zone_results,
        evacuation_ordering=[o.zone_id for o in ordering],
        summary=SimulationSummary(
            mean_cells_burned=mean_burned,
            median_cells_burned=median_burned,
            simulation_duration_sec=round(duration, 2),
            runs_completed=result.num_runs,
        ),
    )

    return response.model_dump()


def _run_ingest(args) -> None:
    # m6: Validate US-only coordinates
    if not (18.0 <= args.lat <= 72.0 and -180.0 <= args.lon <= -65.0):
        print("Error: Ingestion requires US coordinates (lat 18-72, lon -180 to -65)", file=sys.stderr)
        sys.exit(1)

    from backend.data.ingest.orchestrator import run_ingestion
    print(f"Starting ingestion for ({args.lat}, {args.lon}), radius={args.radius}km...")
    slug, warnings = run_ingestion(
        lat=args.lat, lon=args.lon, radius_km=args.radius,
        fire_name=args.fire_name,
    )
    print(f"Ingestion complete. Region slug: {slug}")
    if warnings:
        print("Warnings (degraded data sources):")
        for w in warnings:
            print(f"  - {w}")


def main():
    parser = argparse.ArgumentParser(description="EvacuAI — Wildfire Evacuation Simulator")
    subparsers = parser.add_subparsers(dest="command")

    parser.add_argument("--lat", type=float, default=None)
    parser.add_argument("--lon", type=float, default=None)
    parser.add_argument("--wind-speed", type=float, default=14.0, dest="wind_speed")
    parser.add_argument("--wind-dir", type=float, default=225.0, dest="wind_dir")
    parser.add_argument("--wind-gust", type=float, default=20.0, dest="wind_gust")
    parser.add_argument("--humidity", type=float, default=18.0)
    parser.add_argument("--num-runs", type=int, default=500, dest="num_runs")
    parser.add_argument("--max-timesteps", type=int, default=180, dest="max_timesteps")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--seed-dir", type=str, default="backend/data/seed/paradise-ca/", dest="seed_dir")
    parser.add_argument("--output", type=str, default="results/")
    parser.add_argument("--scenario-preset", type=str, default=None, dest="scenario_preset")

    ingest_parser = subparsers.add_parser("ingest", help="Ingest real data for a region")
    ingest_parser.add_argument("--lat", type=float, required=True)
    ingest_parser.add_argument("--lon", type=float, required=True)
    ingest_parser.add_argument("--radius", type=float, default=10.0)
    ingest_parser.add_argument("--fire-name", type=str, default=None, dest="fire_name")

    args = parser.parse_args()

    if args.command == "ingest":
        _run_ingest(args)
        return

    if not Path(args.seed_dir).exists():
        print(f"Region dataset directory not found: {args.seed_dir}", file=sys.stderr)
        sys.exit(1)

    try:
        output = _run_simulation(args)
    except Exception as e:
        print(f"Simulation failed: {e}", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.output)
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Output directory not writable: {e}", file=sys.stderr)
        sys.exit(1)

    out_file = out_dir / "simulation_results.json"
    with open(out_file, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    s = output["summary"]
    print(f"Region: {output['region_name']}")
    print(f"Runs completed: {s['runs_completed']}")
    print(f"Mean cells burned: {s['mean_cells_burned']:.1f}")
    print(f"Median cells burned: {s['median_cells_burned']:.1f}")
    print(f"Simulation duration: {s['simulation_duration_sec']:.2f}s")
    print(f"Output written to: {out_file}")


if __name__ == "__main__":
    main()
