from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Optional

import numpy as np
import networkx as nx

from backend.models.schemas import Zone, Shelter, CostWeights, GridBounds

logger = logging.getLogger(__name__)


@dataclass
class BaselineRouteResult:
    zone_id: str
    shelter_id: str
    node_ids: list[int]
    path_coords: list[tuple[float, float]]
    total_travel_time: float


@dataclass
class OptimizedRouteResult:
    zone_id: str
    shelter_id: str
    node_ids: list[int]
    path_coords: list[tuple[float, float]]
    total_travel_time: float
    total_cost: float


@dataclass
class ViabilityResult:
    zone_id: str
    viability_score: float   # % of runs route succeeds
    cutoff_time: Optional[int]
    failure_risk_pct: float


@dataclass
class ZoneOrderResult:
    zone_id: str
    priority_score: float

def _path_coords(G: nx.DiGraph, node_ids: list[int]) -> list[tuple[float, float]]:
    return [(G.nodes[n]["lat"], G.nodes[n]["lon"]) for n in node_ids]


class EvacuationRouter:
    def __init__(
        self,
        road_graph: nx.DiGraph,
        zones: list[Zone],
        shelters: list[Shelter],
        grid_bounds: Optional[GridBounds] = None,
    ) -> None:
        self.G = road_graph
        self.zones = zones
        self.shelters = shelters
        self.grid_bounds = grid_bounds
        node_items = list(road_graph.nodes(data=True))
        self._node_ids = [nid for nid, _ in node_items]
        self._node_lats = np.asarray([data["lat"] for _, data in node_items], dtype=np.float64)
        self._node_lons = np.asarray([data["lon"] for _, data in node_items], dtype=np.float64)
        self._zone_nodes = {
            z.zone_id: self._nearest_node(z.centroid_lat, z.centroid_lon)
            for z in zones
        }
        self._shelter_nodes = {
            s.shelter_id: self._nearest_node(s.lat, s.lon)
            for s in shelters
        }
        self._shelter_node_to_id: dict[int, str] = {}
        for shelter_id, node_id in self._shelter_nodes.items():
            self._shelter_node_to_id.setdefault(node_id, shelter_id)

    def _nearest_node(self, lat: float, lon: float) -> int:
        """Approximate nearest-node lookup using vectorized lat/lon distance."""
        if not self._node_ids:
            raise ValueError("Road graph has no nodes")

        lon_scale = math.cos(math.radians(lat))
        lat_diff = self._node_lats - lat
        lon_diff = (self._node_lons - lon) * lon_scale
        idx = int(np.argmin(lat_diff * lat_diff + lon_diff * lon_diff))
        return self._node_ids[idx]

    def compute_baseline_routes(self) -> dict[str, BaselineRouteResult]:
        if not self.shelters:
            return {
                zone.zone_id: BaselineRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id="none",
                    node_ids=[],
                    path_coords=[],
                    total_travel_time=float("inf"),
                )
                for zone in self.zones
            }

        reversed_graph = self.G.reverse(copy=False)
        shelter_nodes = list(self._shelter_node_to_id)
        distances, reversed_paths = nx.multi_source_dijkstra(
            reversed_graph,
            shelter_nodes,
            weight="travel_time",
        )

        results = {}
        for zone in self.zones:
            src = self._zone_nodes.get(zone.zone_id)
            best: Optional[BaselineRouteResult] = None

            if src in distances:
                path = list(reversed(reversed_paths[src]))
                shelter_node = path[-1]
                shelter_id = self._shelter_node_to_id.get(shelter_node, "none")
                best = BaselineRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id=shelter_id,
                    node_ids=path,
                    path_coords=_path_coords(self.G, path),
                    total_travel_time=float(distances[src]),
                )
            else:
                logger.debug("No path from zone %s to any shelter", zone.zone_id)

            if best is None:
                best = BaselineRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id="none",
                    node_ids=[],
                    path_coords=[],
                    total_travel_time=float("inf"),
                )
            results[zone.zone_id] = best
        return results

    def compute_optimized_routes(
        self,
        fire_grid: np.ndarray,
        ignition_times: np.ndarray,
        road_closures: dict[tuple[int, int], float],
        civ_delay: float,
        weights: Optional[CostWeights] = None,
        zone_priority_order: Optional[list[str]] = None,
    ) -> dict[str, OptimizedRouteResult]:
        if weights is None:
            weights = CostWeights()

        edge_congestion: dict[tuple[int, int], float] = {}

        zones_ordered = self.zones
        if zone_priority_order:
            zone_map = {z.zone_id: z for z in self.zones}
            zones_ordered = [zone_map[zid] for zid in zone_priority_order if zid in zone_map]

        results = {}
        for zone in zones_ordered:
            src = self._zone_nodes.get(zone.zone_id)
            best: Optional[OptimizedRouteResult] = None

            if src is None:
                results[zone.zone_id] = OptimizedRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id="none",
                    node_ids=[],
                    path_coords=[],
                    total_travel_time=float("inf"),
                    total_cost=float("inf"),
                )
                continue

            for shelter in self.shelters:
                tgt = self._shelter_nodes[shelter.shelter_id]

                def edge_cost(u, v, data):
                    tt = data.get("travel_time", 1.0)
                    cap = max(1, data.get("capacity", 400))
                    cong = edge_congestion.get((u, v), 0.0) / cap
                    fe = self._fire_exposure(u, v, fire_grid, ignition_times, civ_delay)
                    rc = road_closures.get((u, v), 0.0)
                    return (weights.alpha * tt + weights.beta * cong
                            + weights.gamma * fe + weights.delta * rc)

                try:
                    path = nx.dijkstra_path(self.G, src, tgt, weight=edge_cost)
                    tt = sum(
                        self.G[path[i]][path[i + 1]]["travel_time"]
                        for i in range(len(path) - 1)
                    )
                    cost = sum(
                        edge_cost(path[i], path[i + 1], self.G[path[i]][path[i + 1]])
                        for i in range(len(path) - 1)
                    )
                    if best is None or cost < best.total_cost:
                        best = OptimizedRouteResult(
                            zone_id=zone.zone_id,
                            shelter_id=shelter.shelter_id,
                            node_ids=path,
                            path_coords=_path_coords(self.G, path),
                            total_travel_time=tt,
                            total_cost=cost,
                        )
                except nx.NetworkXNoPath:
                    pass

            if best is None:
                best = OptimizedRouteResult(
                    zone_id=zone.zone_id,
                    shelter_id="none",
                    node_ids=[],
                    path_coords=[],
                    total_travel_time=float("inf"),
                    total_cost=float("inf"),
                )
            else:
                for i in range(len(best.node_ids) - 1):
                    e = (best.node_ids[i], best.node_ids[i + 1])
                    edge_congestion[e] = edge_congestion.get(e, 0.0) + zone.population

            results[zone.zone_id] = best
        return results

    def _fire_exposure(
        self,
        u: int, v: int,
        fire_grid: np.ndarray,
        ignition_times: np.ndarray,
        civ_delay: float,
    ) -> float:
        """Fraction of cells along edge that are burning at traversal time."""
        if self.grid_bounds is None or u not in self.G.nodes or v not in self.G.nodes:
            return 0.0
        gb = self.grid_bounds
        u_data = self.G.nodes[u]
        v_data = self.G.nodes[v]
        tt = self.G[u][v].get("travel_time", 1.0)
        traversal_time = civ_delay + tt / 2.0

        H, W = fire_grid.shape
        n_samples = 3
        burning_count = 0
        for t in range(n_samples):
            frac = t / max(1, n_samples - 1)
            lat = u_data["lat"] + frac * (v_data["lat"] - u_data["lat"])
            lon = u_data["lon"] + frac * (v_data["lon"] - u_data["lon"])

            if gb.max_lat == gb.min_lat or gb.max_lon == gb.min_lon:
                continue

            row = int((gb.max_lat - lat) / (gb.max_lat - gb.min_lat) * H)
            col = int((lon - gb.min_lon) / (gb.max_lon - gb.min_lon) * W)
            row = max(0, min(H - 1, row))
            col = max(0, min(W - 1, col))

            cell_ignition = ignition_times[row, col]
            if cell_ignition >= 0 and cell_ignition <= traversal_time:
                burning_count += 1

        return burning_count / n_samples

    def compute_viability_scores(
        self,
        mc_run_results,  # list[SingleRunResult]
        baseline_routes: dict[str, BaselineRouteResult],
        max_timesteps: int = 180,
    ) -> dict[str, ViabilityResult]:
        """Compute viability scores across all MC runs."""
        zone_ids = [z.zone_id for z in self.zones]
        num_runs = len(mc_run_results)
        results = {}

        for zone_id in zone_ids:
            baseline = baseline_routes.get(zone_id)
            if baseline is None or not baseline.node_ids:
                results[zone_id] = ViabilityResult(
                    zone_id=zone_id,
                    viability_score=0.0,
                    cutoff_time=0,
                    failure_risk_pct=100.0,
                )
                continue

            # For each run, compute the latest start time at which the route
            # still succeeds (fire hasn't reached any edge before traversal).
            # A route "succeeds at start_time T" if for every edge, fire
            # arrives after the evacuee passes through.
            per_run_max_start: list[Optional[float]] = []

            for run in mc_run_results:
                path = baseline.node_ids
                # Compute cumulative travel time at each node
                cum_times = [0.0]
                for i in range(len(path) - 1):
                    u, v = path[i], path[i + 1]
                    if u not in self.G.nodes or v not in self.G.nodes:
                        cum_times.append(cum_times[-1] + 1.0)
                    else:
                        cum_times.append(cum_times[-1] + self.G[u][v].get("travel_time", 1.0))

                # For each edge, find the earliest fire arrival along it
                min_fire_arrival = float("inf")
                for i in range(len(path) - 1):
                    u, v = path[i], path[i + 1]
                    if u not in self.G.nodes or v not in self.G.nodes:
                        continue
                    # Check fire arrival at edge midpoint
                    if self.grid_bounds is None:
                        continue
                    gb = self.grid_bounds
                    u_data = self.G.nodes[u]
                    v_data = self.G.nodes[v]
                    H, W = run.ignition_times.shape
                    mid_lat = (u_data["lat"] + v_data["lat"]) / 2
                    mid_lon = (u_data["lon"] + v_data["lon"]) / 2
                    if gb.max_lat != gb.min_lat and gb.max_lon != gb.min_lon:
                        row = max(0, min(H - 1, int((gb.max_lat - mid_lat) / (gb.max_lat - gb.min_lat) * H)))
                        col = max(0, min(W - 1, int((mid_lon - gb.min_lon) / (gb.max_lon - gb.min_lon) * W)))
                        cell_ign = run.ignition_times[row, col]
                        if cell_ign >= 0:
                            # Fire arrives at this cell at cell_ign.
                            # Evacuee passes through at start_time + cum_times[midpoint]
                            edge_midpoint_time = (cum_times[i] + cum_times[i + 1]) / 2
                            # Max start = fire_arrival - edge_midpoint_time
                            max_start_for_edge = cell_ign - edge_midpoint_time
                            min_fire_arrival = min(min_fire_arrival, max_start_for_edge)

                if min_fire_arrival == float("inf"):
                    # Fire never reaches route — any start time works
                    per_run_max_start.append(float(max_timesteps))
                elif min_fire_arrival > 0:
                    per_run_max_start.append(min_fire_arrival)
                else:
                    per_run_max_start.append(None)  # route already blocked

            # Viability at start_time=0: fraction of runs where route succeeds
            success_at_zero = sum(1 for ms in per_run_max_start if ms is not None and ms >= 0)
            viability = (success_at_zero / num_runs) * 100.0
            failure_risk = 100.0 - viability

            # Cutoff time: latest T where viability > 50%
            cutoff_time = None
            for t in range(max_timesteps, -1, -1):
                successes = sum(1 for ms in per_run_max_start if ms is not None and ms >= t)
                if (successes / num_runs) * 100.0 > 50.0:
                    cutoff_time = t
                    break

            results[zone_id] = ViabilityResult(
                zone_id=zone_id,
                viability_score=viability,
                cutoff_time=cutoff_time,
                failure_risk_pct=failure_risk,
            )
        return results

    def compute_evacuation_ordering(
        self,
        zones: list[Zone],
        fire_exposure_probs: dict[str, float],
    ) -> list[ZoneOrderResult]:
        max_pop = max((z.population for z in zones), default=1)
        scored = []
        for z in zones:
            pop_weight = z.population / max_pop
            fe_prob = fire_exposure_probs.get(z.zone_id, 0.0)
            score = (
                pop_weight
                + (z.elderly_pct / 100.0) * 2.0
                + (z.disability_pct / 100.0) * 1.5
            ) * fe_prob
            scored.append(ZoneOrderResult(zone_id=z.zone_id, priority_score=score))
        scored.sort(key=lambda x: x.priority_score, reverse=True)
        return scored
