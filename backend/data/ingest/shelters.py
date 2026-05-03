"""Fetch shelter locations from OpenStreetMap via Overpass."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from backend.data.ingest.overpass import overpass_query

logger = logging.getLogger(__name__)

SHELTER_TAGS = [
    '["amenity"="shelter"]',
    '["amenity"="community_centre"]',
    '["amenity"="school"]',
    '["amenity"="place_of_worship"]',
    '["building"="civic"]',
    '["emergency"="assembly_point"]',
]


def fetch_shelters(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    output_path: Path,
) -> list[dict]:
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    tag_queries = "\n".join(f'  node{tag}({bbox});' for tag in SHELTER_TAGS)
    query = f"[out:json][timeout:60];\n(\n{tag_queries}\n);\nout body;"

    try:
        data = overpass_query(query)
        shelters = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("amenity", "Shelter")
            accessible = tags.get("wheelchair") in ("yes", "designated")
            capacity_str = tags.get("capacity", "100")
            try:
                capacity = int(capacity_str)
            except (ValueError, TypeError):
                capacity = 100

            shelters.append({
                "shelter_id": f"osm_{el['id']}",
                "name": name,
                "lat": el["lat"],
                "lon": el["lon"],
                "capacity": capacity,
                "accessible": accessible,
            })

        if not shelters:
            raise ValueError("No shelters found in OSM data")

        with open(output_path, "w") as f:
            json.dump(shelters, f)
        logger.info("Shelters saved: %s (%d shelters)", output_path, len(shelters))
        return shelters

    except Exception as e:
        logger.warning("Overpass shelter fetch failed: %s", e)
        return _synthetic_shelters(min_lat, max_lat, min_lon, max_lon, output_path)


def _synthetic_shelters(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    output_path: Path,
) -> list[dict]:
    logger.warning("Using synthetic shelters (DEGRADED DATA)")
    lat_mid = (min_lat + max_lat) / 2
    lon_mid = (min_lon + max_lon) / 2
    shelters = [
        {"shelter_id": "osm_s1", "name": "Community Center", "lat": min_lat + 0.03, "lon": lon_mid, "capacity": 500, "accessible": True},
        {"shelter_id": "osm_s2", "name": "High School", "lat": lat_mid, "lon": min_lon + 0.03, "capacity": 800, "accessible": True},
        {"shelter_id": "osm_s3", "name": "Fairgrounds", "lat": max_lat - 0.03, "lon": max_lon - 0.03, "capacity": 1200, "accessible": False},
    ]
    with open(output_path, "w") as f:
        json.dump(shelters, f)
    return shelters
