"""Fetch road network from OpenStreetMap via Overpass API."""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

from backend.data.ingest.overpass import overpass_query

logger = logging.getLogger(__name__)

# Highway class → (speed_kmh, capacity_veh_per_hour)
HIGHWAY_DEFAULTS = {
    "motorway": (110, 2000),
    "trunk": (90, 1500),
    "primary": (70, 1200),
    "secondary": (60, 900),
    "tertiary": (50, 600),
    "residential": (30, 300),
    "unclassified": (40, 400),
    "service": (20, 200),
}
DEFAULT_SPEED = 40
DEFAULT_CAPACITY = 400


def _travel_time(length_m: float, speed_kmh: float) -> float:
    """Travel time in minutes."""
    return (length_m / 1000.0) / speed_kmh * 60.0


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_road_network(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    output_path: Path,
) -> dict:
    query = f"""
[out:json][timeout:60];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"]
    ({min_lat},{min_lon},{max_lat},{max_lon});
);
out body;
>;
out skel qt;
"""
    try:
        data = overpass_query(query)
    except Exception as e:
        logger.warning("Overpass road fetch failed: %s", e)
        result = _synthetic_road_graph(min_lat, max_lat, min_lon, max_lon)
        with open(output_path, "w") as f:
            json.dump(result, f)
        return result

    # Build node lookup
    nodes_by_id: dict[int, dict] = {}
    for el in data.get("elements", []):
        if el["type"] == "node":
            nodes_by_id[el["id"]] = {"id": el["id"], "lat": el["lat"], "lon": el["lon"]}

    nodes = []
    links = []
    seen_nodes: set[int] = set()

    for el in data.get("elements", []):
        if el["type"] != "way":
            continue
        tags = el.get("tags", {})
        highway = tags.get("highway", "unclassified")
        speed, capacity = HIGHWAY_DEFAULTS.get(highway, (DEFAULT_SPEED, DEFAULT_CAPACITY))
        way_nodes = el.get("nodes", [])

        for i in range(len(way_nodes) - 1):
            src_id = way_nodes[i]
            tgt_id = way_nodes[i + 1]
            if src_id not in nodes_by_id or tgt_id not in nodes_by_id:
                continue

            for nid in [src_id, tgt_id]:
                if nid not in seen_nodes:
                    seen_nodes.add(nid)
                    nodes.append(nodes_by_id[nid])

            src = nodes_by_id[src_id]
            tgt = nodes_by_id[tgt_id]
            dist = _haversine(src["lat"], src["lon"], tgt["lat"], tgt["lon"])
            tt = _travel_time(dist, speed)

            links.append({
                "source": src_id, "target": tgt_id,
                "travel_time": round(tt, 4),
                "capacity": capacity,
                "highway": highway,
            })
            # Bidirectional unless oneway
            if tags.get("oneway") != "yes":
                links.append({
                    "source": tgt_id, "target": src_id,
                    "travel_time": round(tt, 4),
                    "capacity": capacity,
                    "highway": highway,
                })

    result = {"nodes": nodes, "links": links}
    with open(output_path, "w") as f:
        json.dump(result, f)
    logger.info("Road graph saved: %s (%d nodes, %d links)", output_path, len(nodes), len(links))
    return result


def _synthetic_road_graph(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float
) -> dict:
    """Minimal synthetic road graph as fallback."""
    logger.warning("Using synthetic road graph (DEGRADED DATA)")
    lat_mid = (min_lat + max_lat) / 2
    lon_mid = (min_lon + max_lon) / 2
    nodes = [
        {"id": 1, "lat": min_lat + 0.05, "lon": lon_mid},
        {"id": 2, "lat": lat_mid, "lon": lon_mid},
        {"id": 3, "lat": max_lat - 0.05, "lon": lon_mid},
        {"id": 4, "lat": lat_mid, "lon": min_lon + 0.05},
        {"id": 5, "lat": lat_mid, "lon": max_lon - 0.05},
    ]
    links = []
    for src, tgt in [(1, 2), (2, 3), (2, 4), (2, 5)]:
        s = next(n for n in nodes if n["id"] == src)
        t = next(n for n in nodes if n["id"] == tgt)
        dist = _haversine(s["lat"], s["lon"], t["lat"], t["lon"])
        tt = _travel_time(dist, 50)
        links += [
            {"source": src, "target": tgt, "travel_time": round(tt, 4), "capacity": 600, "highway": "primary"},
            {"source": tgt, "target": src, "travel_time": round(tt, 4), "capacity": 600, "highway": "primary"},
        ]
    return {"nodes": nodes, "links": links}
