"""EvacuAI Backend - CLI entry point.

Usage:
    python main.py --lat 39.7596 --lon -121.6219 --wind-speed 14 \\
                   --wind-dir 225 --humidity 18 --runs 500 \\
                   --seed-dir backend/data/seed/paradise-ca/ --output results/
"""

import argparse
import sys


def parse_args(argv=None):
    """Parse command-line arguments for the EvacuAI simulation pipeline."""
    parser = argparse.ArgumentParser(
        description="EvacuAI - Wildfire Evacuation Simulation Backend",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--lat",
        type=float,
        default=None,
        help="Ignition point latitude (defaults to region config default)",
    )
    parser.add_argument(
        "--lon",
        type=float,
        default=None,
        help="Ignition point longitude (defaults to region config default)",
    )
    parser.add_argument(
        "--wind-speed",
        type=float,
        default=14.0,
        help="Wind speed in mph",
    )
    parser.add_argument(
        "--wind-dir",
        type=float,
        default=225.0,
        help="Wind direction in degrees (0=N, 90=E, 180=S, 270=W)",
    )
    parser.add_argument(
        "--humidity",
        type=float,
        default=18.0,
        help="Relative humidity percentage (0-100)",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=500,
        help="Number of Monte Carlo simulation runs",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="results/",
        help="Output directory for results JSON",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducibility",
    )
    parser.add_argument(
        "--max-timesteps",
        type=int,
        default=180,
        help="Maximum simulation timesteps (1-minute intervals)",
    )
    parser.add_argument(
        "--seed-dir",
        type=str,
        default="backend/data/seed/paradise-ca/",
        help="Path to Region Dataset directory",
    )

    return parser.parse_args(argv)


def main(argv=None):
    """Main entry point for the EvacuAI simulation pipeline."""
    args = parse_args(argv)

    print("EvacuAI Backend - CLI entry point (not yet implemented)")
    print(f"  Region dataset: {args.seed_dir}")
    print(f"  Ignition point: ({args.lat}, {args.lon})")
    print(f"  Wind: {args.wind_speed} mph @ {args.wind_dir}°")
    print(f"  Humidity: {args.humidity}%")
    print(f"  Monte Carlo runs: {args.runs}")
    print(f"  Max timesteps: {args.max_timesteps}")
    print(f"  Output directory: {args.output}")

    if args.seed is not None:
        print(f"  Random seed: {args.seed}")

    # TODO: Wire up the full pipeline (Task 10)
    # 1. Load Region Dataset via SeedDataLoader(seed_dir)
    # 2. Fetch or override wind conditions
    # 3. Run Monte Carlo engine
    # 4. Write results JSON to output directory
    # 5. Print stdout summary

    return 0


if __name__ == "__main__":
    sys.exit(main())
