"""Orchestrates the full data ingestion pipeline."""
from __future__ import annotations

import logging
import re
from pathlib import Path

from backend.data.ingest.fuel import fetch_fuel_grid
from backend.data.ingest.roads import fetch_road_network
from backend.data.ingest.zones import fetch_zones
from backend.data.ingest.shelters import fetch_shelters
from backend.data.ingest.perimeters import fetch_perimeter
from backend.data.ingest.region import generate_region_config, generate_grid_bounds
from backend.data.ingest.scenarios import generate_scenario_presets

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def run_ingestion(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    region_name: str | None = None,
    fire_name: str | None = None,
    output_base: str = "backend/data/seed",
    progress_callback=None,
) -> tuple[str, list[str]]:
    """
    Run full ingestion pipeline. Returns (region_slug, warnings).
    progress_callback(pct, completed_files) called after each step.
    """
    if region_name is None:
        region_name = f"Region ({lat:.3f}, {lon:.3f})"
    region_slug = _slugify(region_name)
    out_dir = Path(output_base) / region_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    completed: list[str] = []

    def _step(pct: int, fname: str):
        completed.append(fname)
        if progress_callback:
            progress_callback(pct, list(completed))

    # 1. Region config + grid bounds
    bbox_config = generate_region_config(
        lat=lat, lon=lon, radius_km=radius_km,
        region_name=region_name,
        fire_perimeter_file=f"{region_slug}_perimeter.geojson" if fire_name else None,
        output_path=out_dir / "region_config.json",
    )
    bbox = bbox_config["bounding_box"]
    grid_bounds = generate_grid_bounds(bbox, output_path=out_dir / "grid_bounds.json")
    _step(10, "region_config.json")
    _step(15, "grid_bounds.json")

    # 2. Fuel grid
    try:
        fetch_fuel_grid(
            bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"],
            grid_bounds["grid_rows"], grid_bounds["grid_cols"],
            out_dir / "fuel_grid.npy",
        )
        _step(30, "fuel_grid.npy")
    except Exception as e:
        warnings.append(f"fuel_grid: {e}")
        _step(30, "fuel_grid.npy (degraded)")

    # 3. Road network
    try:
        fetch_road_network(
            bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"],
            out_dir / "road_graph.json",
        )
        _step(50, "road_graph.json")
    except Exception as e:
        warnings.append(f"road_graph: {e}")
        _step(50, "road_graph.json (degraded)")

    # 4. Zones
    try:
        fetch_zones(
            bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"],
            out_dir / "zones.geojson",
        )
        _step(65, "zones.geojson")
    except Exception as e:
        warnings.append(f"zones: {e}")
        _step(65, "zones.geojson (degraded)")

    # 5. Shelters
    try:
        fetch_shelters(
            bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"],
            out_dir / "shelters.json",
        )
        _step(80, "shelters.json")
    except Exception as e:
        warnings.append(f"shelters: {e}")
        _step(80, "shelters.json (degraded)")

    # 6. Fire perimeter (optional)
    if fire_name:
        try:
            fetch_perimeter(
                bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"],
                fire_name=fire_name,
                output_path=out_dir / f"{region_slug}_perimeter.geojson",
            )
            _step(90, f"{region_slug}_perimeter.geojson")
        except Exception as e:
            warnings.append(f"perimeter: {e}")
            _step(90, "perimeter (degraded)")
    else:
        _step(90, "perimeter (skipped — no fire_name provided)")

    # 7. Scenario presets
    generate_scenario_presets(lat, lon, out_dir / "scenario_presets.json", region_name)
    _step(100, "scenario_presets.json")

    if warnings:
        logger.warning("Ingestion completed with warnings: %s", warnings)
    else:
        logger.info("Ingestion complete for %s", region_slug)

    return region_slug, warnings
