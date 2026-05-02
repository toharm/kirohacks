"""Monte Carlo stochastic simulation orchestrator.

Executes N independent fire simulation runs with stochastically sampled
parameters, then aggregates results into burn probability maps, arrival
time statistics, and per-zone evacuation results.

Sampling distributions per run:
    wind_speed:     Normal(μ, σ=3), clamped to [0, wind_gust_mph]
    wind_direction: Normal(μ, σ=15), wrapped at 360°
    civ_delay:      Uniform(2, 15) minutes
    road_closure:   Beta(1.5, 8.5) per edge per run

Deterministic reproducibility is achieved via numpy.random.SeedSequence:
each run derives its own Generator from the master seed, so results are
identical across calls with the same seed.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import networkx as nx
import numpy as np

from backend.evacuation.router import BaselineRouteResult, EvacuationRouter
from backend.models.schemas import ArrivalTimeStats, BurnProbabilityMap, CostWeights, GridBounds, Shelter, Zone
from backend.simulation.fire_spread import FireSpreadEngine

logger = logging.getLogger(__name__)

# Stochastic sampling parameters
WIND_SPEED_SIGMA = 3.0       # mph
WIND_DIR_SIGMA = 15.0        # degrees
CIV_DELAY_LOW = 2.0          # minutes
CIV_DELAY_HIGH = 15.0        # minutes
ROAD_CLOSURE_ALPHA = 1.5     # Beta distribution shape parameter
ROAD_CLOSURE_BETA = 8.5      # Beta distribution shape parameter


@dataclass
class SingleRunResult:
    """Results from a single Monte Carlo simulation run."""

    run_index: int
    wind_speed_mph: float
    wind_direction_deg: float
    civ_delay_min: float
    cells_burned: int
    burn_mask: np.ndarray          # bool (H, W)
    ignition_times: np.ndarray     # int32 (H, W), -1 = unburned
    zone_routes: dict[str, BaselineRouteResult]
    road_closures: np.ndarray      # float64, one value per edge


@dataclass
class ZoneMCResult:
    """Aggregated per-zone results across all Monte Carlo runs."""

    zone_id: str
    baseline_route: BaselineRouteResult | None
    optimized_route: BaselineRouteResult | None
    runs_with_route: int
    total_runs: int
    viability_score: float  # % of runs where route completes before fire
    cutoff_time: int | None  # latest safe start timestep (viability > 50%)
    failure_risk_pct: float  # % of runs with no viable route


@dataclass
class MonteCarloResult:
    """Aggregated results from all Monte Carlo simulation runs.

    Attributes:
        burn_probability_map: BurnProbabilityMap Pydantic model with grid_bounds
            and 2D data array where each cell = count_ignited / num_runs.
        arrival_time_stats: ArrivalTimeStats Pydantic model with mean and median
            arrival timesteps per cell (computed only over runs where cell ignited).
        zone_results: Per-zone aggregated results across all runs.
        runs_completed: Number of runs that completed successfully.
        mean_cells_burned: Mean number of cells burned across all runs.
        median_cells_burned: Median number of cells burned across all runs.
        simulation_duration_sec: Wall-clock time for the full MC run in seconds.
    """

    burn_probability_map: BurnProbabilityMap
    arrival_time_stats: ArrivalTimeStats
    zone_results: list[ZoneMCResult]
    runs_completed: int
    mean_cells_burned: float
    median_cells_burned: float
    simulation_duration_sec: float


class MonteCarloEngine:
    """Orchestrates N stochastic fire simulation runs.

    Each run samples wind speed, wind direction, civilian delay, and road
    closure probabilities from defined distributions, executes a deterministic
    fire spread simulation with those parameters, and computes evacuation
    routes on the (possibly modified) road graph.

    Results are aggregated into a burn probability map and arrival time
    statistics across all runs.
    """

    def __init__(
        self,
        fire_engine: FireSpreadEngine,
        road_graph: nx.DiGraph,
        zones: list[Zone],
        shelters: list[Shelter],
    ) -> None:
        """Initialize the Monte Carlo engine.

        Args:
            fire_engine: Configured FireSpreadEngine with fuel grid and grid bounds.
            road_graph: NetworkX DiGraph with travel_time and capacity edge attributes.
            zones: List of Zone models with centroid coordinates and vulnerability data.
            shelters: List of Shelter models with location and capacity data.
        """
        self.fire_engine = fire_engine
        self.road_graph = road_graph
        self.zones = zones
        self.shelters = shelters

        # Cache the list of edges for road closure sampling
        self._edges = list(road_graph.edges())

    def run(
        self,
        ignition_point: tuple[float, float],
        wind_speed_mph: float,
        wind_direction_deg: float,
        wind_gust_mph: float,
        relative_humidity: float,
        num_runs: int = 500,
        seed: int | None = None,
        max_timesteps: int = 180,
    ) -> MonteCarloResult:
        """Execute N independent simulation runs with stochastic sampling.

        Each run:
        1. Derives a fresh numpy.random.Generator from the master SeedSequence.
        2. Samples wind_speed ~ Normal(μ, σ=3), clamped to [0, wind_gust_mph].
        3. Samples wind_dir ~ Normal(μ, σ=15), wrapped at 360°.
        4. Samples civ_delay ~ Uniform(2, 15).
        5. Samples road_closure ~ Beta(1.5, 8.5) per edge.
        6. Runs fire spread simulation with sampled parameters.
        7. Computes baseline evacuation routes on the (closure-weighted) graph.

        After all runs, aggregates:
        - burn_probability_map[i,j] = count_ignited[i,j] / num_runs
        - arrival_time_stats: mean and median over runs where cell ignited

        Args:
            ignition_point: (lat, lon) of the fire ignition point.
            wind_speed_mph: Mean wind speed in mph (μ for Normal sampling).
            wind_direction_deg: Mean wind direction in degrees (μ for Normal sampling).
            wind_gust_mph: Upper bound for wind speed clamping.
            relative_humidity: Relative humidity percentage (constant across runs).
            num_runs: Number of independent simulation runs to execute.
            seed: Master random seed for deterministic reproducibility. If None,
                  results are non-deterministic.
            max_timesteps: Maximum simulation timesteps per run.

        Returns:
            MonteCarloResult with aggregated burn probability map, arrival time
            statistics, per-zone results, and run metadata.
        """
        start_time = time.monotonic()

        rows, cols = self.fire_engine.rows, self.fire_engine.cols
        grid_bounds = self.fire_engine.grid_bounds
        num_edges = len(self._edges)

        # Accumulators for aggregation
        burn_count = np.zeros((rows, cols), dtype=np.int32)
        # Store ignition times per run for cells that ignited — use a list of arrays
        # to compute mean/median efficiently
        ignition_time_accumulator: list[np.ndarray] = []  # each entry: int32 (H, W)

        cells_burned_per_run: list[int] = []
        single_run_results: list[SingleRunResult] = []

        # Set up SeedSequence for deterministic per-run seeding
        seed_seq = np.random.SeedSequence(seed)
        child_seeds = seed_seq.spawn(num_runs)

        runs_completed = 0

        for run_idx in range(num_runs):
            rng = np.random.default_rng(child_seeds[run_idx])

            # --- Sample stochastic parameters ---

            # wind_speed ~ Normal(μ, σ=3), clamped to [0, wind_gust_mph]
            sampled_wind_speed = rng.normal(wind_speed_mph, WIND_SPEED_SIGMA)
            sampled_wind_speed = float(np.clip(sampled_wind_speed, 0.0, wind_gust_mph))

            # wind_dir ~ Normal(μ, σ=15), wrapped at 360°
            sampled_wind_dir = rng.normal(wind_direction_deg, WIND_DIR_SIGMA)
            sampled_wind_dir = float(sampled_wind_dir % 360.0)

            # civ_delay ~ Uniform(2, 15) minutes
            civ_delay = float(rng.uniform(CIV_DELAY_LOW, CIV_DELAY_HIGH))

            # road_closure ~ Beta(1.5, 8.5) per edge per run
            road_closures = rng.beta(ROAD_CLOSURE_ALPHA, ROAD_CLOSURE_BETA, size=num_edges)

            # --- Run fire spread simulation ---
            try:
                fire_result = self.fire_engine.run(
                    ignition_point=ignition_point,
                    wind_speed_mph=sampled_wind_speed,
                    wind_direction_deg=sampled_wind_dir,
                    relative_humidity=relative_humidity,
                    max_timesteps=max_timesteps,
                )
            except ValueError as exc:
                logger.warning("Run %d failed with error: %s. Skipping.", run_idx, exc)
                continue

            # --- Accumulate burn data ---
            burn_count += fire_result.burn_mask.astype(np.int32)
            ignition_time_accumulator.append(fire_result.ignition_times.copy())
            cells_burned_per_run.append(fire_result.cells_burned)

            # --- Compute evacuation routes with road closures applied ---
            modified_graph = self._apply_road_closures(road_closures)
            router = EvacuationRouter(modified_graph, self.zones, self.shelters)
            zone_routes = router.compute_baseline_routes()

            single_run_results.append(
                SingleRunResult(
                    run_index=run_idx,
                    wind_speed_mph=sampled_wind_speed,
                    wind_direction_deg=sampled_wind_dir,
                    civ_delay_min=civ_delay,
                    cells_burned=fire_result.cells_burned,
                    burn_mask=fire_result.burn_mask,
                    ignition_times=fire_result.ignition_times,
                    zone_routes=zone_routes,
                    road_closures=road_closures,
                )
            )

            runs_completed += 1

        # --- Aggregate results ---
        burn_probability_map = self._compute_burn_probability_map(
            burn_count, runs_completed, grid_bounds
        )
        arrival_time_stats = self._compute_arrival_time_stats(
            ignition_time_accumulator, grid_bounds
        )
        zone_results = self._aggregate_zone_results(single_run_results, runs_completed)

        cells_burned_arr = np.array(cells_burned_per_run, dtype=np.float64)
        mean_cells = float(np.mean(cells_burned_arr)) if len(cells_burned_arr) > 0 else 0.0
        median_cells = float(np.median(cells_burned_arr)) if len(cells_burned_arr) > 0 else 0.0

        simulation_duration_sec = time.monotonic() - start_time

        return MonteCarloResult(
            burn_probability_map=burn_probability_map,
            arrival_time_stats=arrival_time_stats,
            zone_results=zone_results,
            runs_completed=runs_completed,
            mean_cells_burned=mean_cells,
            median_cells_burned=median_cells,
            simulation_duration_sec=simulation_duration_sec,
        )

    def _apply_road_closures(self, road_closures: np.ndarray) -> nx.DiGraph:
        """Return a copy of the road graph with closure_probability set per edge.

        Road closure probabilities are sampled once per run and stored as the
        ``closure_probability`` edge attribute. The graph copy is shallow for
        performance — only edge data is updated.

        Args:
            road_closures: Float64 array of shape (num_edges,) with Beta-sampled
                           closure probabilities in [0, 1].

        Returns:
            A new DiGraph with updated closure_probability attributes.
        """
        modified = self.road_graph.copy()
        for idx, (u, v) in enumerate(self._edges):
            if modified.has_edge(u, v):
                modified[u][v]["closure_probability"] = float(road_closures[idx])
        return modified

    def _compute_burn_probability_map(
        self,
        burn_count: np.ndarray,
        num_runs: int,
        grid_bounds: GridBounds,
    ) -> BurnProbabilityMap:
        """Compute burn_probability_map[i,j] = count_ignited[i,j] / num_runs.

        Args:
            burn_count: int32 array (H, W) counting how many runs each cell ignited.
            num_runs: Total number of completed runs (denominator).
            grid_bounds: Grid bounding box and resolution metadata.

        Returns:
            BurnProbabilityMap Pydantic model with 2D data array (values in [0, 1]).
        """
        if num_runs == 0:
            prob_map = np.zeros_like(burn_count, dtype=np.float64)
        else:
            prob_map = burn_count.astype(np.float64) / num_runs

        # Convert to nested Python list for Pydantic serialization
        data = prob_map.tolist()

        return BurnProbabilityMap(grid_bounds=grid_bounds, data=data)

    def _compute_arrival_time_stats(
        self,
        ignition_time_accumulator: list[np.ndarray],
        grid_bounds: GridBounds,
    ) -> ArrivalTimeStats:
        """Compute mean and median arrival times per cell over runs where cell ignited.

        Cells that never ignited in any run get mean/median/p10/p90 of -1.0.

        Args:
            ignition_time_accumulator: List of int32 arrays (H, W), one per run.
                                       -1 indicates the cell did not ignite in that run.
            grid_bounds: Grid bounding box and resolution metadata.

        Returns:
            ArrivalTimeStats Pydantic model with mean, median, p10, p90 arrays.
        """
        if not ignition_time_accumulator:
            rows, cols = self.fire_engine.rows, self.fire_engine.cols
            empty = np.full((rows, cols), -1.0, dtype=np.float64)
            empty_list = empty.tolist()
            return ArrivalTimeStats(
                grid_bounds=grid_bounds,
                mean=empty_list,
                median=empty_list,
                p10=empty_list,
                p90=empty_list,
            )

        # Stack all runs: shape (num_runs, H, W)
        stacked = np.stack(ignition_time_accumulator, axis=0).astype(np.float64)

        rows, cols = stacked.shape[1], stacked.shape[2]

        mean_arr = np.full((rows, cols), -1.0, dtype=np.float64)
        median_arr = np.full((rows, cols), -1.0, dtype=np.float64)
        p10_arr = np.full((rows, cols), -1.0, dtype=np.float64)
        p90_arr = np.full((rows, cols), -1.0, dtype=np.float64)

        # For each cell, compute stats only over runs where it ignited (value >= 0)
        for i in range(rows):
            for j in range(cols):
                cell_times = stacked[:, i, j]
                ignited_times = cell_times[cell_times >= 0]
                if len(ignited_times) > 0:
                    mean_arr[i, j] = float(np.mean(ignited_times))
                    median_arr[i, j] = float(np.median(ignited_times))
                    p10_arr[i, j] = float(np.percentile(ignited_times, 10))
                    p90_arr[i, j] = float(np.percentile(ignited_times, 90))

        return ArrivalTimeStats(
            grid_bounds=grid_bounds,
            mean=mean_arr.tolist(),
            median=median_arr.tolist(),
            p10=p10_arr.tolist(),
            p90=p90_arr.tolist(),
        )

    def _aggregate_zone_results(
        self,
        single_run_results: list[SingleRunResult],
        total_runs: int,
    ) -> list[ZoneMCResult]:
        """Aggregate per-zone route results with viability scoring.

        Viability: a route is viable in a given run if the evacuee reaches
        every node on the path before fire does (accounting for civ_delay).

        Cutoff time: the latest start timestep where viability > 50%.

        Args:
            single_run_results: List of SingleRunResult from each completed run.
            total_runs: Total number of completed runs.

        Returns:
            List of ZoneMCResult with viability scores and cutoff times.
        """
        grid_bounds = self.fire_engine.grid_bounds
        rows, cols = self.fire_engine.rows, self.fire_engine.cols
        lat_range = grid_bounds.max_lat - grid_bounds.min_lat
        lon_range = grid_bounds.max_lon - grid_bounds.min_lon

        zone_ids = [z.zone_id for z in self.zones]
        zone_route_counts: dict[str, int] = {zid: 0 for zid in zone_ids}
        zone_viable_counts: dict[str, int] = {zid: 0 for zid in zone_ids}
        zone_best_route: dict[str, BaselineRouteResult | None] = {zid: None for zid in zone_ids}

        # For cutoff time: track viability at different delay offsets
        max_delay_check = 60  # check start delays 0..59 minutes
        zone_viable_at_delay: dict[str, list[int]] = {
            zid: [0] * max_delay_check for zid in zone_ids
        }

        for run_result in single_run_results:
            for zone_id, route in run_result.zone_routes.items():
                if route.failure_risk_pct >= 100.0:
                    continue
                zone_route_counts[zone_id] = zone_route_counts.get(zone_id, 0) + 1
                if zone_best_route.get(zone_id) is None:
                    zone_best_route[zone_id] = route

                # Check viability: does evacuee beat fire at every node?
                viable = self._check_route_viability(
                    route, run_result.ignition_times, run_result.civ_delay_min,
                    grid_bounds, rows, cols, lat_range, lon_range,
                )
                if viable:
                    zone_viable_counts[zone_id] = zone_viable_counts.get(zone_id, 0) + 1

                # Check viability at increasing start delays for cutoff
                for delay in range(max_delay_check):
                    total_delay = run_result.civ_delay_min + delay
                    v = self._check_route_viability(
                        route, run_result.ignition_times, total_delay,
                        grid_bounds, rows, cols, lat_range, lon_range,
                    )
                    if v:
                        zone_viable_at_delay[zone_id][delay] += 1

        # Compute optimized routes using aggregated burn probability
        burn_prob_data = np.zeros((rows, cols), dtype=np.float64)
        if total_runs > 0 and single_run_results:
            for sr in single_run_results:
                burn_prob_data += sr.burn_mask.astype(np.float64)
            burn_prob_data /= total_runs

        opt_router = EvacuationRouter(self.road_graph, self.zones, self.shelters)
        optimized_routes = opt_router.compute_optimized_routes(burn_prob_data, grid_bounds)

        results: list[ZoneMCResult] = []
        for zone_id in zone_ids:
            viable = zone_viable_counts.get(zone_id, 0)
            viability_score = (viable / total_runs * 100.0) if total_runs > 0 else 0.0
            failure_risk = 100.0 - viability_score

            # Cutoff: latest delay where viability > 50%
            cutoff: int | None = None
            for delay in range(max_delay_check):
                delay_viable = zone_viable_at_delay[zone_id][delay]
                if total_runs > 0 and (delay_viable / total_runs * 100.0) > 50.0:
                    cutoff = delay
                else:
                    break

            results.append(
                ZoneMCResult(
                    zone_id=zone_id,
                    baseline_route=zone_best_route.get(zone_id),
                    optimized_route=optimized_routes.get(zone_id),
                    runs_with_route=zone_route_counts.get(zone_id, 0),
                    total_runs=total_runs,
                    viability_score=viability_score,
                    cutoff_time=cutoff,
                    failure_risk_pct=failure_risk,
                )
            )

        return results

    def _check_route_viability(
        self,
        route: BaselineRouteResult,
        ignition_times: np.ndarray,
        start_delay: float,
        grid_bounds: GridBounds,
        rows: int,
        cols: int,
        lat_range: float,
        lon_range: float,
    ) -> bool:
        """Check if an evacuee on this route beats fire at every node.

        The evacuee starts at start_delay minutes, then accumulates
        travel_time along each edge. At each node, if fire has arrived
        (ignition_time <= evacuee_arrival_time), the route is not viable.
        """
        if not route.node_ids:
            return False

        graph = self.road_graph
        cumulative_time = start_delay

        for i, node_id in enumerate(route.node_ids):
            if i > 0:
                prev = route.node_ids[i - 1]
                edge_data = graph[prev][node_id] if graph.has_edge(prev, node_id) else {}
                cumulative_time += edge_data.get("travel_time", 0.0)

            # Map node to grid cell
            attrs = graph.nodes[node_id]
            lat = attrs.get("lat")
            lon = attrs.get("lon")
            if lat is None or lon is None:
                continue

            row_frac = (grid_bounds.max_lat - lat) / lat_range if lat_range > 0 else 0.0
            col_frac = (lon - grid_bounds.min_lon) / lon_range if lon_range > 0 else 0.0
            r = max(0, min(int(row_frac * (rows - 1)), rows - 1))
            c = max(0, min(int(col_frac * (cols - 1)), cols - 1))

            fire_arrival = ignition_times[r, c]
            # If fire arrived at this cell before or when evacuee arrives, not viable
            if fire_arrival >= 0 and fire_arrival <= cumulative_time:
                return False

        return True
