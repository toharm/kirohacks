import json
import re
from math import ceil, cos, radians
from pathlib import Path

import requests

from backend.data.ingest.overpass import IngestError

_REPO_ROOT = Path(__file__).resolve().parents[3]  # kirohacks/


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _region_name(lat: float, lon: float) -> str:
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lon, "format": "json"},
            headers={"User-Agent": "EvacuAI/1.0"},
            timeout=5,
        )
        r.raise_for_status()
        data = r.json()
        return data.get("display_name") or data["address"].get("city") or data["address"].get("county", "")
    except Exception:
        return f"{lat:.2f}N, {abs(lon):.2f}W"


def generate_region_config(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    cell_size_m: float = 100.0,
    output_dir: Path | None = None,
) -> tuple[tuple[float, float, float, float], int, int, Path]:
    """Returns (bbox, grid_rows, grid_cols, seed_dir_path)"""
    if not (18 <= lat <= 72 and -180 <= lon <= -65):
        raise IngestError(f"Coordinates ({lat}, {lon}) are outside US bounds.")

    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * cos(radians(lat)))
    min_lat, max_lat = lat - delta_lat, lat + delta_lat
    min_lon, max_lon = lon - delta_lon, lon + delta_lon
    bbox = (min_lon, min_lat, max_lon, max_lat)

    grid_rows = ceil((max_lat - min_lat) * 111_000 / cell_size_m)
    grid_cols = ceil((max_lon - min_lon) * 111_000 * cos(radians(lat)) / cell_size_m)

    name = _region_name(lat, lon)
    slug = _slugify(name) + f"-{lat:.4f}-{lon:.4f}"

    seed_dir = output_dir or (_REPO_ROOT / "backend" / "data" / "seed" / slug)
    seed_dir.mkdir(parents=True, exist_ok=True)

    (seed_dir / "region_config.json").write_text(json.dumps({
        "region_name": name,
        "bounding_box": {"min_lat": min_lat, "max_lat": max_lat, "min_lon": min_lon, "max_lon": max_lon},
        "default_ignition_point": {"lat": lat, "lon": lon},
        "fire_perimeter_file": None,
    }, indent=2))

    (seed_dir / "grid_bounds.json").write_text(json.dumps({
        "min_lat": min_lat, "max_lat": max_lat,
        "min_lon": min_lon, "max_lon": max_lon,
        "cell_size_m": cell_size_m,
        "grid_rows": grid_rows,
        "grid_cols": grid_cols,
    }, indent=2))

    return bbox, grid_rows, grid_cols, seed_dir
