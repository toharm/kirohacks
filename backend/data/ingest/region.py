"""Generate region_config.json and grid_bounds.json."""
from __future__ import annotations

import json
import math
from pathlib import Path


def _bbox_from_center(lat: float, lon: float, radius_km: float) -> dict:
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * math.cos(math.radians(lat)))
    return {
        "min_lat": round(lat - delta_lat, 6),
        "max_lat": round(lat + delta_lat, 6),
        "min_lon": round(lon - delta_lon, 6),
        "max_lon": round(lon + delta_lon, 6),
    }


def generate_region_config(
    lat: float, lon: float, radius_km: float,
    region_name: str,
    fire_perimeter_file: str | None,
    output_path: Path,
) -> dict:
    bbox = _bbox_from_center(lat, lon, radius_km)
    config = {
        "region_name": region_name,
        "bounding_box": bbox,
        "default_ignition_point": {"lat": lat, "lon": lon},
        "fire_perimeter_file": fire_perimeter_file,
    }
    with open(output_path, "w") as f:
        json.dump(config, f, indent=2)
    return config


def generate_grid_bounds(
    bbox: dict,
    cell_size_m: float = 100.0,
    output_path: Path | None = None,
) -> dict:
    lat_span = bbox["max_lat"] - bbox["min_lat"]
    lon_span = bbox["max_lon"] - bbox["min_lon"]
    # Approximate degrees per meter at this latitude
    lat_per_m = 1.0 / 111000.0
    lon_per_m = 1.0 / (111000.0 * math.cos(math.radians((bbox["min_lat"] + bbox["max_lat"]) / 2)))
    grid_rows = max(10, int(lat_span / (cell_size_m * lat_per_m)))
    grid_cols = max(10, int(lon_span / (cell_size_m * lon_per_m)))

    bounds = {
        "min_lat": bbox["min_lat"],
        "max_lat": bbox["max_lat"],
        "min_lon": bbox["min_lon"],
        "max_lon": bbox["max_lon"],
        "cell_size_m": cell_size_m,
        "grid_rows": grid_rows,
        "grid_cols": grid_cols,
    }
    if output_path:
        with open(output_path, "w") as f:
            json.dump(bounds, f, indent=2)
    return bounds
