import json
import logging
from pathlib import Path

import networkx as nx

from backend.data.ingest.overpass import IngestError
from backend.data.road_fetcher import RoadGraphFetchError, fetch_road_graph

log = logging.getLogger(__name__)


def fetch_road_network(
    bbox: tuple[float, float, float, float],
    output_path: Path,
) -> None:
    """Generate road_graph.json from OSMnx instead of a raw Overpass query.

    The ingest bbox is ordered as (min_lon, min_lat, max_lon, max_lat), while
    the API-level road graph helper accepts latitude/longitude bounds.
    """
    min_lon, min_lat, max_lon, max_lat = bbox

    try:
        graph_data = fetch_road_graph(
            min_lat=min_lat,
            min_lon=min_lon,
            max_lat=max_lat,
            max_lon=max_lon,
        )
    except RoadGraphFetchError as exc:
        raise IngestError(str(exc)) from exc

    graph = nx.node_link_graph(graph_data, directed=True, multigraph=False, edges="links")
    if graph.number_of_nodes() == 0 or graph.number_of_edges() == 0:
        raise IngestError("No road data found for this region. Cannot compute evacuation routes.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(graph_data))
    log.info(
        "Wrote road graph (%d nodes, %d edges) to %s",
        graph.number_of_nodes(),
        graph.number_of_edges(),
        output_path,
    )
