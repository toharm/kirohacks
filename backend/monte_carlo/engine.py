from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import networkx as nx

from backend.models.schemas import GridBounds, Zone, Shelter
from backend.simulation.fire_spread import FireSpreadEngine, FireSpreadResult


@dataclass
class SingleRunResult:
    """Per-run output. Internal only."""
    run_index: int
    fire_grid: np.ndarray        # burn_mask bool (H, W)
    ignition_times: np.ndarray   # int32 (H, W)
    optimized_routes: dict       # zone_id → route result (filled later)
    civ_delay: float


@dataclass
class MonteCarloResult:
    burn_probability_map: np.ndarray   # float (H, W), values 0–1
    arrival_time_mean: np.ndarray      # float (H, W), nan = never
    arrival_time_median: np.ndarray
    arrival_time_p10: np.ndarray
    arrival_time_p90: np.ndarray
    grid_bounds: GridBounds
    cells_burned_per_run: list[int]
    run_results: list[SingleRunResult]
    num_runs: int


class MonteCarloEngine:
    """Orchestrates N stochastic fire simulation runs."""

    def __init__(
        self,
        fire_engine: FireSpreadEngine,
        road_graph: nx.DiGraph,
        zones: list[Zone],
        shelters: list[Shelter],
    ) -> None:
        self.fire_engine = fire_engine
        self.road_graph = road_graph
        self.zones = zones
        self.shelters = shelters

    def run(
        self,
        ignition_point: tuple[float, float],
        wind_speed_mph: float,
        wind_direction_deg: float,
        wind_gust_mph: float,
        relative_humidity: float,
        num_runs: int = 500,
        seed: Optional[int] = None,
        max_timesteps: int = 180,
    ) -> MonteCarloResult:
        ss = np.random.SeedSequence(seed)
        child_seeds = ss.spawn(num_runs)

        H, W = self.fire_engine.fuel_grid.shape
        burn_count = np.zeros((H, W), dtype=np.int32)
        arrival_accumulator: list[np.ndarray] = []
        cells_burned_per_run: list[int] = []
        run_results: list[SingleRunResult] = []

        for i in range(num_runs):
            rng = np.random.default_rng(child_seeds[i])

            # Sample parameters
            ws = float(np.clip(rng.normal(wind_speed_mph, 3.0), 0.0, wind_gust_mph))
            wd = float(rng.normal(wind_direction_deg, 15.0) % 360.0)
            civ_delay = float(rng.uniform(2.0, 15.0))

            # Sample road closures: Beta(1.5, 8.5) per edge
            road_closures: dict[tuple[int, int], float] = {}
            for u, v in self.road_graph.edges():
                road_closures[(u, v)] = float(rng.beta(1.5, 8.5))

            result: FireSpreadResult = self.fire_engine.run(
                ignition_point=ignition_point,
                wind_speed_mph=ws,
                wind_direction_deg=wd,
                relative_humidity=relative_humidity,
                max_timesteps=max_timesteps,
                rng=rng,
            )

            burn_count += result.burn_mask.astype(np.int32)
            arrival_accumulator.append(result.ignition_times.copy())
            cells_burned_per_run.append(result.cells_burned)

            run_results.append(SingleRunResult(
                run_index=i,
                fire_grid=result.burn_mask,
                ignition_times=result.ignition_times,
                optimized_routes={},
                civ_delay=civ_delay,
            ))

        # Aggregate
        burn_probability_map = burn_count.astype(np.float32) / num_runs

        stacked = np.stack(arrival_accumulator, axis=0).astype(np.float32)
        stacked[stacked < 0] = np.nan

        import warnings as _warnings
        with np.errstate(all='ignore'), _warnings.catch_warnings():
            _warnings.simplefilter("ignore")
            mean_arr = np.nanmean(stacked, axis=0)
            median_arr = np.nanmedian(stacked, axis=0)
            p10_arr = np.nanpercentile(stacked, 10, axis=0)
            p90_arr = np.nanpercentile(stacked, 90, axis=0)

        return MonteCarloResult(
            burn_probability_map=burn_probability_map,
            arrival_time_mean=mean_arr,
            arrival_time_median=median_arr,
            arrival_time_p10=p10_arr,
            arrival_time_p90=p90_arr,
            grid_bounds=self.fire_engine.grid_bounds,
            cells_burned_per_run=cells_burned_per_run,
            run_results=run_results,
            num_runs=num_runs,
        )
