"""Generate scenario_presets.json."""
from __future__ import annotations

import json
from pathlib import Path


def generate_scenario_presets(
    lat: float, lon: float,
    output_path: Path,
    region_name: str = "",
) -> list[dict]:
    presets = [
        {
            "name": "Fast Wind Shift",
            "description": f"High wind NE scenario for {region_name}",
            "ignition_lat": lat,
            "ignition_lon": lon,
            "wind_speed_mph": 25.0,
            "wind_direction_deg": 45.0,
            "wind_gust_mph": 40.0,
            "relative_humidity": 10.0,
        },
        {
            "name": "Night Evacuation",
            "description": f"Low wind SW scenario for {region_name}",
            "ignition_lat": lat,
            "ignition_lon": lon,
            "wind_speed_mph": 10.0,
            "wind_direction_deg": 225.0,
            "wind_gust_mph": 15.0,
            "relative_humidity": 30.0,
        },
        {
            "name": "School Zone",
            "description": f"N wind scenario near schools for {region_name}",
            "ignition_lat": lat,
            "ignition_lon": lon,
            "wind_speed_mph": 15.0,
            "wind_direction_deg": 0.0,
            "wind_gust_mph": 25.0,
            "relative_humidity": 15.0,
        },
    ]
    with open(output_path, "w") as f:
        json.dump(presets, f, indent=2)
    return presets
