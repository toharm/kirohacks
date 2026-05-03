"""Fetch NLCD land cover fuel grid for a bounding box via MRLC WCS."""
from __future__ import annotations

import io
import logging
from pathlib import Path

import numpy as np
import requests

logger = logging.getLogger(__name__)

NLCD_WCS_URL = "https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wcs"

# NLCD 2021 land cover class → fire spread rate multiplier (0.0–1.5)
NLCD_TO_MULTIPLIER = {
    11: 0.0,   # Open Water
    12: 0.0,   # Perennial Ice/Snow
    21: 0.05,  # Developed, Open Space
    22: 0.02,  # Developed, Low Intensity
    23: 0.01,  # Developed, Medium Intensity
    24: 0.0,   # Developed, High Intensity
    31: 0.1,   # Barren Rock/Sand/Clay
    41: 0.9,   # Deciduous Forest
    42: 1.3,   # Evergreen Forest
    43: 1.1,   # Mixed Forest
    52: 1.2,   # Shrub/Scrub
    71: 1.0,   # Grassland/Herbaceous
    81: 0.6,   # Pasture/Hay
    82: 0.5,   # Cultivated Crops
    90: 0.4,   # Woody Wetlands
    95: 0.3,   # Emergent Herbaceous Wetlands
}


def _nlcd_to_multiplier(code: int) -> float:
    return NLCD_TO_MULTIPLIER.get(int(code), 0.5)


def fetch_fuel_grid(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    grid_rows: int, grid_cols: int,
    output_path: Path,
) -> np.ndarray:
    """
    Fetch NLCD 2021 land cover raster via WCS and convert to spread rate multipliers.
    Falls back to a synthetic grid if the API is unavailable.
    """
    try:
        params = [
            ("SERVICE", "WCS"),
            ("VERSION", "2.0.1"),
            ("REQUEST", "GetCoverage"),
            ("COVERAGEID", "NLCD_2021_Land_Cover_L48"),
            ("FORMAT", "image/tiff"),
            ("SUBSET", f"Long({min_lon},{max_lon})"),
            ("SUBSET", f"Lat({min_lat},{max_lat})"),
            ("SUBSETTINGCRS", "http://www.opengis.net/def/crs/EPSG/0/4326"),
        ]
        r = requests.get(NLCD_WCS_URL, params=params, timeout=60,
                         headers={"User-Agent": "EvacuAI/1.0"})
        r.raise_for_status()

        import rasterio
        from rasterio.enums import Resampling
        with rasterio.open(io.BytesIO(r.content)) as src:
            # Resample to target grid dimensions
            data = src.read(
                1,
                out_shape=(grid_rows, grid_cols),
                resampling=Resampling.nearest,
            )

        grid = np.vectorize(_nlcd_to_multiplier)(data).astype(np.float32)
        np.save(str(output_path), grid)
        logger.info("NLCD fuel grid saved: %s (shape %s)", output_path, grid.shape)
        return grid

    except Exception as e:
        logger.warning("NLCD fetch failed (%s), using synthetic fuel grid", e)
        return _synthetic_fuel_grid(grid_rows, grid_cols, output_path)


def _synthetic_fuel_grid(rows: int, cols: int, output_path: Path) -> np.ndarray:
    """Generate a realistic-looking synthetic fuel grid as fallback."""
    rng = np.random.default_rng(42)
    grid = rng.uniform(0.3, 1.2, size=(rows, cols)).astype(np.float32)
    non_burnable = rng.random(size=(rows, cols)) < 0.10
    grid[non_burnable] = 0.0
    np.save(str(output_path), grid)
    logger.warning("Synthetic fuel grid written to %s (DEGRADED DATA)", output_path)
    return grid
