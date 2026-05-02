"""EvacuAI Backend - CLI entry point.

Usage:
    python main.py --lat 39.7596 --lon -121.6219 --wind-speed 14 \
                   --wind-dir 225 --humidity 18 --runs 500 \
                   --seed-dir backend/data/seed/paradise-ca/ --output results/
"""

import argparse
import json
import os
import sys

from backend.data.loader import SeedDataLoader
from backend.data.wind_client import NWSWindClient
from backend.models.schemas import WindConditions
from backend.monte_carlo.engine import MonteCarloEngine
from backend.simulation.fire_spread import FireSpreadEngine


def parse_args(argv=None):
    """Parse command-line arguments for the EvacuAI simulation pipeline."""
    parser = argparse.ArgumentParser(
        description="EvacuAI - Wildfire Evacuation Simulation Backend",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument("--lat", type=float, default=None, help="Ignition point latitude (defaults to region config default)")
    parser.add_argument("--lon", type=float, default=None, help="Ignition point longitude (defaults to region config default)")
    parser.add_argument("--wind-speed", type=float, default=14.0, help="Wind speed in mph")
    parser.add_argument("--wind-dir", type=float, default=225.0, help="Wind direction in degrees (0=N, 90=E, 180=S, 270=W)")
    parser.add_argument("--wind-gust", type=float, default=None, help="Wind gust speed in mph (defaults to 1.5x wind speed)")
    parser.add_argument("--humidity", type=float, default=18.0, help="Relative humidity percentage (0-100)")
    parser.add_argument("--runs", type=int, default=500, help="Number of Monte Carlo simulation runs")
    parser.add_argument("--output", type=str, default="results/", help="Output directory for results JSON")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--max-timesteps", type=int, default=180, help="Maximum simulation timesteps (1-minute intervals)")
    parser.add_argument("--seed-dir", type=str, default="backend/data/seed/paradise-ca/", help="Path to Region Dataset directory")

    return parser.parse_args(argv)


def main(argv=None):
    """Main entry point for the EvacuAI simulation pipeline."""
    args = parse_args(argv)

    # 1. Load region dataset
    print(f"Loading region dataset from {args.seed_dir}...")
    loader = SeedDataLoader(seed_dir=args.seed_dir)
    data = loader.load_all()
    print(f"  Region: {data.region_config.region_name}")

    # Resolve ignition point
    lat = args.lat if args.lat is not None else data.region_config.default_ignition_point.lat
    lon = args.lon if args.lon is not None else data.region_config.default_ignition_point.lon

    # 2. Fetch or override wind conditions
    wind_gust = args.wind_gust if args.wind_gust is not None else args.wind_speed * 1.5
    override = WindConditions(
        wind_speed_mph=args.wind_speed,
        wind_direction_deg=args.wind_dir,
        wind_gust_mph=wind_gust,
        relative_humidity=args.humidity,
    )
    client = NWSWindClient()
    wind_result = client.fetch(lat=lat, lon=lon, override=override)
    wind = wind_result.conditions
    print(f"  Wind: {wind.wind_speed_mph} mph @ {wind.wind_direction_deg}°, humidity {wind.relative_humidity}%")

    # 3. Run Monte Carlo engine
    fire_engine = FireSpreadEngine(data.fuel_grid, data.grid_bounds)
    mc_engine = MonteCarloEngine(fire_engine, data.road_graph, data.zones, data.shelters)

    print(f"Running {args.runs} Monte Carlo simulations (max {args.max_timesteps} timesteps)...")
    result = mc_engine.run(
        ignition_point=(lat, lon),
        wind_speed_mph=wind.wind_speed_mph,
        wind_direction_deg=wind.wind_direction_deg,
        wind_gust_mph=wind.wind_gust_mph,
        relative_humidity=wind.relative_humidity,
        num_runs=args.runs,
        seed=args.seed,
        max_timesteps=args.max_timesteps,
    )

    # 4. Write results JSON to output directory
    os.makedirs(args.output, exist_ok=True)
    output_path = os.path.join(args.output, "simulation_results.json")

    output_data = {
        "region_name": data.region_config.region_name,
        "ignition_point": {"lat": lat, "lon": lon},
        "wind": wind.model_dump(),
        "runs_completed": result.runs_completed,
        "mean_cells_burned": result.mean_cells_burned,
        "median_cells_burned": result.median_cells_burned,
        "simulation_duration_sec": result.simulation_duration_sec,
        "zone_results": [
            {
                "zone_id": zr.zone_id,
                "runs_with_route": zr.runs_with_route,
                "total_runs": zr.total_runs,
                "viability_score": zr.viability_score,
                "cutoff_time": zr.cutoff_time,
                "failure_risk_pct": zr.failure_risk_pct,
                "has_baseline_route": zr.baseline_route is not None,
                "baseline_travel_time": zr.baseline_route.total_travel_time if zr.baseline_route else None,
                "baseline_shelter": zr.baseline_route.shelter_id if zr.baseline_route else None,
                "has_optimized_route": zr.optimized_route is not None,
                "optimized_travel_time": zr.optimized_route.total_travel_time if zr.optimized_route else None,
                "optimized_shelter": zr.optimized_route.shelter_id if zr.optimized_route else None,
            }
            for zr in result.zone_results
        ],
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)
    print(f"Results written to {output_path}")

    # 5. Print summary
    print("\n--- Simulation Summary ---")
    print(f"  Runs completed: {result.runs_completed}/{args.runs}")
    print(f"  Mean cells burned: {result.mean_cells_burned:.1f}")
    print(f"  Median cells burned: {result.median_cells_burned:.1f}")
    print(f"  Duration: {result.simulation_duration_sec:.2f}s")
    for zr in result.zone_results:
        route_pct = (zr.runs_with_route / zr.total_runs * 100) if zr.total_runs > 0 else 0
        travel = f"{zr.baseline_route.total_travel_time:.1f} min → {zr.baseline_route.shelter_id}" if zr.baseline_route else "no route"
        cutoff = f"cutoff={zr.cutoff_time}min" if zr.cutoff_time is not None else "no cutoff"
        opt = f"opt={zr.optimized_route.total_travel_time:.1f}min" if zr.optimized_route else "no opt"
        print(f"  {zr.zone_id}: viability={zr.viability_score:.0f}%, {cutoff}, {travel}, {opt}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
