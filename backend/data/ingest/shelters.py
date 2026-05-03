import json
import logging
import math
from pathlib import Path

from backend.data.ingest.overpass import IngestError, OverpassClient

log = logging.getLogger(__name__)

_CAPACITY = {
    "community_centre": 500,
    "place_of_worship": 300,
    "school": 400,
    "shelter": 200,
    "civic": 600,
    "assembly_point": 250,
}

_QUERY = """[out:json][timeout:30];
(
  node["amenity"~"^(shelter|community_centre|place_of_worship|school)$"]
    ({min_lat},{min_lon},{max_lat},{max_lon});
  node["emergency"="assembly_point"]
    ({min_lat},{min_lon},{max_lat},{max_lon});
  node["building"="civic"]
    ({min_lat},{min_lon},{max_lat},{max_lon});
);
out body;"""


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _capacity(tags: dict) -> int:
    return _CAPACITY.get(tags.get("amenity", ""), None) \
        or _CAPACITY.get(tags.get("building", ""), None) \
        or _CAPACITY.get(tags.get("emergency", ""), None) \
        or 200


def _deduplicate(shelters: list[dict]) -> list[dict]:
    kept: list[dict] = []
    for s in shelters:
        if not any(_haversine_m(s["lat"], s["lon"], k["lat"], k["lon"]) < 50 for k in kept):
            kept.append(s)
    return kept


def _synthetic(shelter_id: str, lat: float, lon: float) -> dict:
    return {"shelter_id": shelter_id, "name": f"Shelter at {lat:.4f}, {lon:.4f}",
            "lat": lat, "lon": lon, "capacity": 500, "accessible": True}


def fetch_shelters(
    bbox: tuple[float, float, float, float],
    output_path: Path,
    overpass_client: OverpassClient | None = None,
) -> None:
    min_lon, min_lat, max_lon, max_lat = bbox
    client = overpass_client or OverpassClient()

    try:
        data = client.query(_QUERY.format(min_lat=min_lat, min_lon=min_lon,
                                          max_lat=max_lat, max_lon=max_lon))
        shelters = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            lat, lon = el["lat"], el["lon"]
            shelters.append({
                "shelter_id": f"osm_{el['id']}",
                "name": tags.get("name") or f"Shelter at {lat:.4f}, {lon:.4f}",
                "lat": lat,
                "lon": lon,
                "capacity": _capacity(tags),
                "accessible": True,
            })
        shelters = _deduplicate(shelters)
    except IngestError as e:
        log.warning("Overpass failed, using fallback: %s", e)
        shelters = []

    if len(shelters) < 2:
        existing_ids = {s["shelter_id"] for s in shelters}
        for sid, lat, lon in [("synthetic_sw", min_lat, min_lon), ("synthetic_ne", max_lat, max_lon)]:
            if sid not in existing_ids:
                shelters.append(_synthetic(sid, lat, lon))
            if len(shelters) >= 2:
                break

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(shelters, indent=2))
    log.info("Wrote %d shelters to %s", len(shelters), output_path)
