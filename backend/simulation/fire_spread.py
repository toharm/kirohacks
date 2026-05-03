from __future__ import annotations

import numpy as np
from dataclasses import dataclass
from typing import Optional

from backend.models.schemas import GridBounds


@dataclass
class FireSpreadResult:
    burn_mask: np.ndarray      # bool (H, W)
    ignition_times: np.ndarray  # int32 (H, W), -1 = never
    cells_burned: int


class FireSpreadEngine:
    """Simplified Rothermel fire spread on a 2D NumPy grid."""

    R0 = 0.05  # base spread rate km/min

    # 8-neighbor offsets: (dr, dc, bearing_deg)
    NEIGHBOR_OFFSETS = [
        (-1, 0, 0.0),    # N
        (-1, 1, 45.0),   # NE
        (0, 1, 90.0),    # E
        (1, 1, 135.0),   # SE
        (1, 0, 180.0),   # S
        (1, -1, 225.0),  # SW
        (0, -1, 270.0),  # W
        (-1, -1, 315.0), # NW
    ]

    def __init__(self, fuel_grid: np.ndarray, grid_bounds: GridBounds) -> None:
        self.fuel_grid = fuel_grid.astype(np.float32)
        self.grid_bounds = grid_bounds

    def _latlon_to_cell(self, lat: float, lon: float) -> tuple[int, int]:
        gb = self.grid_bounds
        row = int((gb.max_lat - lat) / (gb.max_lat - gb.min_lat) * gb.grid_rows)
        col = int((lon - gb.min_lon) / (gb.max_lon - gb.min_lon) * gb.grid_cols)
        row = max(0, min(gb.grid_rows - 1, row))
        col = max(0, min(gb.grid_cols - 1, col))
        return row, col

    def run(
        self,
        ignition_point: tuple[float, float],
        wind_speed_mph: float,
        wind_direction_deg: float,
        relative_humidity: float,
        max_timesteps: int = 180,
        rng: Optional[np.random.Generator] = None,
    ) -> FireSpreadResult:
        if rng is None:
            rng = np.random.default_rng(0)  # deterministic fallback

        lat, lon = ignition_point
        gb = self.grid_bounds

        if not (gb.min_lat <= lat <= gb.max_lat and gb.min_lon <= lon <= gb.max_lon):
            raise ValueError(
                f"Ignition point ({lat}, {lon}) outside grid bounds "
                f"({gb.min_lat}-{gb.max_lat}, {gb.min_lon}-{gb.max_lon})"
            )

        ig_row, ig_col = self._latlon_to_cell(lat, lon)
        if self.fuel_grid[ig_row, ig_col] == 0.0:
            raise ValueError(
                f"Ignition point ({lat}, {lon}) maps to non-burnable cell ({ig_row}, {ig_col})"
            )

        H, W = self.fuel_grid.shape
        ignition_times = np.full((H, W), -1, dtype=np.int32)
        fire_grid = np.zeros((H, W), dtype=np.float32)

        ignition_times[ig_row, ig_col] = 0
        fire_grid[ig_row, ig_col] = 1.0

        # Wind: meteorological convention → downwind direction
        downwind_deg = (wind_direction_deg + 180.0) % 360.0

        moisture_factor = 1.0 - (relative_humidity / 100.0) * 0.8

        # Precompute wind factors for each neighbor direction
        wind_factors = []
        for _, _, bearing_deg in self.NEIGHBOR_OFFSETS:
            angle_diff = np.radians(bearing_deg - downwind_deg)
            wf = np.exp(0.1783 * wind_speed_mph * np.cos(angle_diff))
            wind_factors.append(wf)

        for t in range(1, max_timesteps + 1):
            burning_rows, burning_cols = np.where(fire_grid > 0)
            if len(burning_rows) == 0:
                break

            new_ignitions = []
            for idx, (dr, dc, _) in enumerate(self.NEIGHBOR_OFFSETS):
                nr = burning_rows + dr
                nc = burning_cols + dc
                valid = (nr >= 0) & (nr < H) & (nc >= 0) & (nc < W)
                nr, nc = nr[valid], nc[valid]

                # Only consider unburned, burnable cells
                unburned = ignition_times[nr, nc] == -1
                burnable = self.fuel_grid[nr, nc] > 0.0
                mask = unburned & burnable
                nr, nc = nr[mask], nc[mask]

                if len(nr) == 0:
                    continue

                wf = wind_factors[idx]
                fuel = self.fuel_grid[nr, nc]
                spread_rate = self.R0 * fuel * wf * moisture_factor
                prob = np.minimum(1.0, spread_rate)

                rand_vals = rng.random(len(nr))
                ignited = rand_vals < prob
                new_ignitions.extend(zip(nr[ignited], nc[ignited]))

            for r, c in new_ignitions:
                if ignition_times[r, c] == -1:
                    ignition_times[r, c] = t
                    fire_grid[r, c] = 1.0

        burn_mask = ignition_times >= 0
        return FireSpreadResult(
            burn_mask=burn_mask,
            ignition_times=ignition_times,
            cells_burned=int(burn_mask.sum()),
        )
