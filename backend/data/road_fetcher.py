"""Fetch real road network data from OpenStreetMap via OSMnx.

Downloads the drivable road network for a bounding box and converts it
to the node-link JSON format expected by the EvacuAI road_graph.json schema:
  - Nodes: {id, lat, lon}
  - Links: {source, target, travel_time, capacity, highway}
"""

from __future__ import annotations

import logging

import networkx as nx

logger = logging.getLogger(__name__)

# Capacity estimates (vehicles/hour) by OSM highway type
_CAPACITY_BY_HIGHWAY: dict[str, int] = {
    "motorway": 2000,
    "trunk": 1800,
    "primary": 1500,
    "secondary": 1200,
    "tertiary": 1000,
    "residential": 800,
    "unclassified": 600,
    "motorway_link": 1500,
    "trunk_link": 1200,
    "primary_link": 1200,
    "secondary_link": 1000,
    "tertiary_link": 800,
    "living_street": 400,
    "service": 400,
}
_DEFAULT_CAPACITY = 600


class RoadGraphFetchError(Exception):
    """Raised when a road graph cannot be fetched or converted."""


def fetch_road_graph(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
) -> dict:
    """Download OSM road network and return node-link JSON dict.

    Args:
        min_lat: Southern boundary.
        min_lon: Western boundary.
        max_lat: Northern boundary.
        max_lon: Eastern boundary.

    Returns:
        A dict in NetworkX node-link format compatible with road_graph.json.
    """
    if min_lat >= max_lat or min_lon >= max_lon:
        raise RoadGraphFetchError("min_lat/min_lon must be less than max_lat/max_lon.")

    try:
        import osmnx as ox
    except ImportError as exc:
        raise RoadGraphFetchError(
            "OSMnx is required to generate road graphs. Install backend requirements first."
        ) from exc

    # OSMnx bbox order: (left, bottom, right, top) = (west, south, east, north)
    bbox = (min_lon, min_lat, max_lon, max_lat)
    logger.info("Fetching OSM road network for bbox %s", bbox)

    try:
        G = ox.graph_from_bbox(
            bbox=bbox,
            network_type="drive",
            simplify=True,
            retain_all=False,
            truncate_by_edge=True,
        )

        if G.number_of_nodes() == 0 or G.number_of_edges() == 0:
            raise RoadGraphFetchError("No drivable road data found for this region.")

        # Impute speeds and compute travel times (seconds)
        G = ox.routing.add_edge_speeds(G, fallback=40)
        G = ox.routing.add_edge_travel_times(G)
    except RoadGraphFetchError:
        raise
    except Exception as exc:
        raise RoadGraphFetchError(f"OSMnx road graph fetch failed: {exc}") from exc

    # Convert to simple DiGraph with sequential integer IDs
    return _to_node_link(G)


def _to_node_link(G: nx.MultiDiGraph) -> dict:
    """Convert OSMnx MultiDiGraph to the EvacuAI node-link format."""
    # Map OSM node IDs to sequential integers
    osm_to_int = {osm_id: i + 1 for i, osm_id in enumerate(G.nodes)}

    nodes = []
    for osm_id, data in G.nodes(data=True):
        nodes.append({
            "id": osm_to_int[osm_id],
            "lat": round(data["y"], 6),
            "lon": round(data["x"], 6),
        })

    # Deduplicate multi-edges: keep the one with shortest travel time
    seen: dict[tuple[int, int], dict] = {}
    for u, v, data in G.edges(data=True):
        src = osm_to_int[u]
        tgt = osm_to_int[v]
        key = (src, tgt)

        travel_time_sec = data.get("travel_time", 60)
        travel_time_min = round(travel_time_sec / 60.0, 2)

        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]

        capacity = _CAPACITY_BY_HIGHWAY.get(highway, _DEFAULT_CAPACITY)

        if key not in seen or travel_time_min < seen[key]["travel_time"]:
            seen[key] = {
                "source": src,
                "target": tgt,
                "travel_time": travel_time_min,
                "capacity": capacity,
                "highway": highway,
            }

    return {
        "directed": True,
        "multigraph": False,
        "graph": {},
        "nodes": nodes,
        "links": list(seen.values()),
    }
