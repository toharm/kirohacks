import json
from pathlib import Path


def generate_scenarios(
    bbox: tuple[float, float, float, float],  # (min_lon, min_lat, max_lon, max_lat)
    center_lat: float,
    center_lon: float,
    output_path: Path,
) -> None:
    min_lon, min_lat, max_lon, max_lat = bbox
    offset = 0.01

    presets = [
        {
            "name": "Moderate Wind",
            "description": "Moderate southwest wind with average humidity conditions.",
            "ignition_lat": center_lat,
            "ignition_lon": center_lon,
            "wind_speed_mph": 10.0,
            "wind_direction_deg": 225.0,
            "wind_gust_mph": 15.0,
            "relative_humidity": 25.0,
        },
        {
            "name": "High Wind Event",
            "description": "Strong northeast wind with low humidity; ignition at NE corner.",
            "ignition_lat": max_lat - offset,
            "ignition_lon": max_lon - offset,
            "wind_speed_mph": 25.0,
            "wind_direction_deg": 45.0,
            "wind_gust_mph": 40.0,
            "relative_humidity": 10.0,
        },
        {
            "name": "Red Flag Warning",
            "description": "Extreme north wind with critically low humidity; ignition at north edge.",
            "ignition_lat": max_lat - offset,
            "ignition_lon": center_lon,
            "wind_speed_mph": 35.0,
            "wind_direction_deg": 0.0,
            "wind_gust_mph": 55.0,
            "relative_humidity": 5.0,
        },
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(presets, indent=2))
