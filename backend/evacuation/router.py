"""Baseline and optimized evacuation route computation.

Provides Dijkstra shortest-path routing from zone centroids to the
nearest shelter on a road graph, with graceful handling of disconnected
graphs and unreachable shelters.

Optimized routing uses a multi-factor cost function:
    cost = alpha * travel_time + beta * congestion
         + gamma * fire_exposure + delta * road_closure
"""

import logging
import math
from dataclasses import dataclass, field

import networkx as nx
import numpy as np

from backend.models.schemas import CostWeights, GridBounds, Shelter, Zone

logger = logging.getLogger(__name__)


@dataclass
class BaselineRouteResult:
    """Result of baseline shortest-path routing for a single zone."""

    zone_id: str
    shelter_id: str
    node_ids: list[int]
    path_coords: list[tuple[float, float]]  # (lat, lon) pairs
    total_travel_time: float
    failure_risk_pct: float  # 100.0 if no path found
    cutoff_time: int  # 0 if no path found


class EvacuationRouter:
    """Computes baseline and optimized evacuation routes.

    Baseline routing uses Dijkstra shortest-path (minimum travel_time)
    to the nearest shelter for each zone centroid on the road graph.

    Optimized routing uses a multi-factor cost function incorporating
    travel time, congestion, fire exposure, and road closure probability.
    """

    def __init__(
        self,
        road_graph: nx.DiGraph,
        zones: list[Zone],
        shelters: list[Shelter],
    ) -> None:
        self.road_graph = road_graph
        self.zones = zones
        self.shelters = shelters
        self._shelter_nodes: dict[str, int | None] | None = None

    def _get_shelter_nodes(self) -> dict[str, int | None]:
        """Pre-compute and cache nearest graph node for each shelter."""
        if self._shelter_nodes is None:
            self._shelter_nodes = {}
            for shelter in self.shelters:
                node = self._find_nearest_node(shelter.lat, shelter.lon)
                if node is None:
                    logger.warning(
                        "No graph node found near shelter %s (%s). Skipping.",
                        shelter.shelter_id, shelter.name,
                    )
                self._shelter_nodes[shelter.shelter_id] = node
        return self._shelter_nodes

    def _find_nearest_node(self, lat: float, lon: float) -> int | None:
        """Find the nearest graph node to a (lat, lon) point by Euclidean distance."""
        best_node: int | None = None
        best_dist = float("inf")

        for node_id, attrs in self.road_graph.nodes(data=True):
            node_lat = attrs.get("lat")
            node_lon = attrs.get("lon")
            if node_lat is None or node_lon is None:
                continue
            dist = math.hypot(lat - node_lat, lon - node_lon)
            if dist < best_dist:
                best_dist = dist
                best_node = node_id

        return best_node

    def _extract_path_coords(self, node_ids: list[int]) -> list[tuple[float, float]]:
        """Extract (lat, lon) coordinate pairs from a list of node IDs."""
        coords: list[tuple[float, float]] = []
        for node_id in node_ids:
            attrs = self.road_graph.nodes[node_id]
            lat = attrs.get("lat")
            lon = attrs.get("lon")
            if lat is not None and lon is not None:
                coords.append((lat, lon))
        return coords

    def _no_path_result(self, zone_id: str) -> BaselineRouteResult:
        """Return a failure result for a zone with no reachable shelter."""
        return BaselineRouteResult(
            zone_id=zone_id, shelter_id="", node_ids=[], path_coords=[],
            total_travel_time=0.0, failure_risk_pct=100.0, cutoff_time=0,
        )

    def compute_baseline_routes(self) -> dict[str, BaselineRouteResult]:
        """Compute Dijkstra shortest-path routes to nearest shelter per zone."""
        shelter_nodes = self._get_shelter_nodes()
        results: dict[str, BaselineRouteResult] = {}

        for zone in self.zones:
            zone_node = self._find_nearest_node(zone.centroid_lat, zone.centroid_lon)
            if zone_node is None:
                results[zone.zone_id] = self._no_path_result(zone.zone_id)
                continue

            best_path: list[int] | None = None
            best_travel_time = float("inf")
            best_shelter_id = ""

            for shelter in self.shelters:
                shelter_node = shelter_nodes.get(shelter.shelter_id)
                if shelter_node is None:
                    continue
                try:
                    travel_time, path = nx.single_source_dijkstra(
                        self.road_graph, zone_node, shelter_node,
                        weight="travel_time",
                    )
                except nx.NetworkXNoPath:
                    continue

                if travel_time < best_travel_time:
                    best_travel_time = travel_time
                    best_path = path
                    best_shelter_id = shelter.shelter_id

            if best_path is None:
                results[zone.zone_id] = self._no_path_result(zone.zone_id)
            else:
                results[zone.zone_id] = BaselineRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id=best_shelter_id,
                    node_ids=best_path,
                    path_coords=self._extract_path_coords(best_path),
                    total_travel_time=best_travel_time,
                    failure_risk_pct=0.0,
                    cutoff_time=0,
                )

        return results

    def compute_optimized_routes(
        self,
        burn_prob: np.ndarray,
        grid_bounds: GridBounds,
        weights: CostWeights | None = None,
    ) -> dict[str, BaselineRouteResult]:
        """Compute optimized routes using a multi-factor cost function.

        cost(u,v) = alpha * travel_time
                  + beta  * congestion
                  + gamma * fire_exposure
                  + delta * road_closure

        Args:
            burn_prob: 2D float array (H, W) of burn probabilities [0, 1].
            grid_bounds: Grid metadata for mapping node lat/lon to grid cells.
            weights: Cost function weights. Uses defaults if None.

        Returns:
            Dictionary mapping zone_id to BaselineRouteResult with strategy info.
        """
        w = weights or CostWeights()
        shelter_nodes = self._get_shelter_nodes()

        # Precompute fire exposure for each node
        node_fire_exposure = self._compute_node_fire_exposure(burn_prob, grid_bounds)

        def cost_fn(u: int, v: int, edge_data: dict) -> float:
            travel_time = edge_data.get("travel_time", 1.0)
            capacity = edge_data.get("capacity", 1)
            congestion = 1.0 / max(capacity, 1)
            closure = edge_data.get("closure_probability", 0.0)
            # Average fire exposure of the two endpoints
            fire_exp = (node_fire_exposure.get(u, 0.0) + node_fire_exposure.get(v, 0.0)) / 2.0
            return (
                w.alpha * travel_time
                + w.beta * congestion
                + w.gamma * fire_exp
                + w.delta * closure
            )

        results: dict[str, BaselineRouteResult] = {}

        for zone in self.zones:
            zone_node = self._find_nearest_node(zone.centroid_lat, zone.centroid_lon)
            if zone_node is None:
                results[zone.zone_id] = self._no_path_result(zone.zone_id)
                continue

            best_path: list[int] | None = None
            best_cost = float("inf")
            best_travel_time = float("inf")
            best_shelter_id = ""

            for shelter in self.shelters:
                shelter_node = shelter_nodes.get(shelter.shelter_id)
                if shelter_node is None:
                    continue
                try:
                    cost, path = nx.single_source_dijkstra(
                        self.road_graph, zone_node, shelter_node,
                        weight=cost_fn,
                    )
                except nx.NetworkXNoPath:
                    continue

                if cost < best_cost:
                    best_cost = cost
                    best_path = path
                    best_shelter_id = shelter.shelter_id
                    # Compute actual travel time along the chosen path
                    best_travel_time = sum(
                        self.road_graph[path[i]][path[i + 1]].get("travel_time", 0.0)
                        for i in range(len(path) - 1)
                    )

            if best_path is None:
                results[zone.zone_id] = self._no_path_result(zone.zone_id)
            else:
                results[zone.zone_id] = BaselineRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id=best_shelter_id,
                    node_ids=best_path,
                    path_coords=self._extract_path_coords(best_path),
                    total_travel_time=best_travel_time,
                    failure_risk_pct=0.0,
                    cutoff_time=0,
                )

        return results

    def _compute_node_fire_exposure(
        self,
        burn_prob: np.ndarray,
        grid_bounds: GridBounds,
    ) -> dict[int, float]:
        """Map each graph node to its burn probability from the grid."""
        rows, cols = burn_prob.shape
        lat_range = grid_bounds.max_lat - grid_bounds.min_lat
        lon_range = grid_bounds.max_lon - grid_bounds.min_lon
        exposure: dict[int, float] = {}

        for node_id, attrs in self.road_graph.nodes(data=True):
            lat = attrs.get("lat")
            lon = attrs.get("lon")
            if lat is None or lon is None:
                continue
            # Map to grid cell (same logic as FireSpreadEngine.latlon_to_grid)
            row_frac = (grid_bounds.max_lat - lat) / lat_range if lat_range > 0 else 0.0
            col_frac = (lon - grid_bounds.min_lon) / lon_range if lon_range > 0 else 0.0
            r = max(0, min(int(row_frac * (rows - 1)), rows - 1))
            c = max(0, min(int(col_frac * (cols - 1)), cols - 1))
            exposure[node_id] = float(burn_prob[r, c])

        return exposure
