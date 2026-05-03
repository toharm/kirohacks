"""Region Dataset loading and validation.

Provides the SeedDataLoader class for discovering, validating, and loading
a Region Dataset from a configurable directory path. Raises SeedDataError
with descriptive messages when files are missing or malformed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import networkx as nx
import numpy as np
from shapely.geometry import shape

from backend.models.schemas import (
    GridBounds,
    RegionConfig,
    ScenarioPreset,
    Shelter,
    Zone,
)


class SeedDataError(Exception):
    """Raised when a Region Dataset file is missing or malformed."""


@dataclass
class SeedData:
    """Container for all loaded Region Dataset data."""

    region_config: RegionConfig
    fuel_grid: np.ndarray
    grid_bounds: GridBounds
    burn_perimeter: np.ndarray | None  # binary mask, None if no perimeter file
    road_graph: nx.DiGraph
    zones: list[Zone]
    shelters: list[Shelter]
    scenario_presets: list[ScenarioPreset]
    warnings: list[dict] = None  # data quality warnings from ingest

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class SeedDataLoader:
    """Loads and validates a Region Dataset from a configurable directory."""

    REQUIRED_FILES = [
        "region_config.json",
        "fuel_grid.npy",
        "grid_bounds.json",
        "road_graph.json",
        "zones.geojson",
        "shelters.json",
        "scenario_presets.json",
    ]

    def __init__(self, seed_dir: str = "backend/data/seed/paradise-ca/") -> None:
        """
        Args:
            seed_dir: Path to the Region Dataset directory. Defaults to the
                      bundled Paradise, CA dataset.
        """
        self.seed_dir = Path(seed_dir)

    def _file_path(self, filename: str) -> Path:
        """Return the full path for a file within the seed directory."""
        return self.seed_dir / filename

    def load_region_config(self) -> RegionConfig:
        """Load and validate region_config.json against the RegionConfig model.

        Raises:
            SeedDataError: If the file is missing or fails schema validation.
        """
        filepath = self._file_path("region_config.json")
        if not filepath.exists():
            raise SeedDataError(
                f"region_config.json not found at {filepath}"
            )
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"region_config.json at {filepath} is not valid JSON: {exc}"
            ) from exc

        try:
            return RegionConfig(**data)
        except Exception as exc:
            raise SeedDataError(
                f"region_config.json at {filepath} failed schema validation: {exc}"
            ) from exc

    def validate_required_files(self) -> None:
        """Check that all REQUIRED_FILES exist in seed_dir.

        Raises:
            SeedDataError: Listing ALL missing files if any are absent.
        """
        missing = [
            f for f in self.REQUIRED_FILES
            if not self._file_path(f).exists()
        ]
        if missing:
            raise SeedDataError(
                f"Missing required files in {self.seed_dir}: {', '.join(missing)}"
            )

    def load_fuel_grid(self) -> np.ndarray:
        """Load fuel_grid.npy as a float32 NumPy array.

        Validates that all values are in the range [0.0, 1.5].

        Raises:
            SeedDataError: If the file is missing, unreadable, or contains
                out-of-range values.
        """
        filepath = self._file_path("fuel_grid.npy")
        if not filepath.exists():
            raise SeedDataError(f"fuel_grid.npy not found at {filepath}")
        try:
            grid = np.load(str(filepath)).astype(np.float32)
        except Exception as exc:
            raise SeedDataError(
                f"fuel_grid.npy at {filepath} could not be loaded: {exc}"
            ) from exc

        if grid.ndim != 2:
            raise SeedDataError(
                f"fuel_grid.npy at {filepath} must be a 2D array, got {grid.ndim}D"
            )
        if np.any(grid < 0.0) or np.any(grid > 1.5):
            raise SeedDataError(
                f"fuel_grid.npy at {filepath} contains values outside [0.0, 1.5]"
            )
        return grid

    def load_grid_bounds(self) -> GridBounds:
        """Load grid_bounds.json and return a GridBounds model.

        Raises:
            SeedDataError: If the file is missing or fails validation.
        """
        filepath = self._file_path("grid_bounds.json")
        if not filepath.exists():
            raise SeedDataError(f"grid_bounds.json not found at {filepath}")
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"grid_bounds.json at {filepath} is not valid JSON: {exc}"
            ) from exc

        try:
            return GridBounds(**data)
        except Exception as exc:
            raise SeedDataError(
                f"grid_bounds.json at {filepath} failed validation: {exc}"
            ) from exc

    def load_fire_perimeter(
        self, filename: str, grid_bounds: GridBounds
    ) -> np.ndarray:
        """Load fire perimeter GeoJSON and rasterize to a binary burn mask.

        Args:
            filename: The perimeter GeoJSON filename from
                region_config.fire_perimeter_file.
            grid_bounds: Grid metadata used for rasterization.

        Returns:
            A boolean NumPy array (grid_rows, grid_cols) where True indicates
            the cell is inside the fire perimeter polygon.

        Raises:
            SeedDataError: If the file is missing or malformed.
        """
        filepath = self._file_path(filename)
        if not filepath.exists():
            raise SeedDataError(
                f"Fire perimeter file '{filename}' not found at {filepath}"
            )
        try:
            with open(filepath, "r") as f:
                geojson = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"Fire perimeter file '{filename}' at {filepath} is not valid JSON: {exc}"
            ) from exc

        # Extract the polygon geometry from the first feature
        try:
            features = geojson.get("features", [])
            if not features:
                raise SeedDataError(
                    f"Fire perimeter file '{filename}' at {filepath} has no features"
                )
            geometry = features[0].get("geometry")
            if geometry is None:
                raise SeedDataError(
                    f"Fire perimeter file '{filename}' at {filepath}: first feature has no geometry"
                )
            polygon = shape(geometry)
        except SeedDataError:
            raise
        except Exception as exc:
            raise SeedDataError(
                f"Fire perimeter file '{filename}' at {filepath} has invalid geometry: {exc}"
            ) from exc

        # Rasterize: for each grid cell center, check if it falls inside the polygon
        from shapely.geometry import Point

        rows = grid_bounds.grid_rows
        cols = grid_bounds.grid_cols
        burn_mask = np.zeros((rows, cols), dtype=bool)

        lat_step = (grid_bounds.max_lat - grid_bounds.min_lat) / rows
        lon_step = (grid_bounds.max_lon - grid_bounds.min_lon) / cols

        for r in range(rows):
            cell_lat = grid_bounds.min_lat + (r + 0.5) * lat_step
            for c in range(cols):
                cell_lon = grid_bounds.min_lon + (c + 0.5) * lon_step
                if polygon.contains(Point(cell_lon, cell_lat)):
                    burn_mask[r, c] = True

        return burn_mask

    def load_road_graph(self) -> nx.DiGraph:
        """Load road_graph.json as a NetworkX DiGraph.

        Verifies that edges have travel_time and capacity attributes.

        Raises:
            SeedDataError: If the file is missing, malformed, or edges lack
                required attributes.
        """
        filepath = self._file_path("road_graph.json")
        if not filepath.exists():
            raise SeedDataError(f"road_graph.json not found at {filepath}")
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"road_graph.json at {filepath} is not valid JSON: {exc}"
            ) from exc

        try:
            graph = nx.node_link_graph(
                data, directed=True, multigraph=False, edges="links"
            )
        except Exception as exc:
            raise SeedDataError(
                f"road_graph.json at {filepath} could not be parsed as a NetworkX graph: {exc}"
            ) from exc

        # Verify required edge attributes
        for u, v, attrs in graph.edges(data=True):
            if "travel_time" not in attrs:
                raise SeedDataError(
                    f"road_graph.json at {filepath}: edge ({u}, {v}) missing 'travel_time' attribute"
                )
            if "capacity" not in attrs:
                raise SeedDataError(
                    f"road_graph.json at {filepath}: edge ({u}, {v}) missing 'capacity' attribute"
                )

        return graph

    def load_zones(self) -> list[Zone]:
        """Load zones.geojson and return a list of Zone models.

        Raises:
            SeedDataError: If the file is missing or features fail validation.
        """
        filepath = self._file_path("zones.geojson")
        if not filepath.exists():
            raise SeedDataError(f"zones.geojson not found at {filepath}")
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"zones.geojson at {filepath} is not valid JSON: {exc}"
            ) from exc

        zones: list[Zone] = []
        features = data.get("features", [])
        for i, feature in enumerate(features):
            props = feature.get("properties", {})
            geometry = feature.get("geometry", {})
            try:
                zone = Zone(
                    zone_id=props["zone_id"],
                    population=props["population"],
                    elderly_pct=props["elderly_pct"],
                    disability_pct=props["disability_pct"],
                    evacuation_priority_weight=props["evacuation_priority_weight"],
                    centroid_lat=props["centroid_lat"],
                    centroid_lon=props["centroid_lon"],
                    geometry=geometry,
                )
                zones.append(zone)
            except (KeyError, Exception) as exc:
                raise SeedDataError(
                    f"zones.geojson at {filepath}: feature {i} failed validation: {exc}"
                ) from exc

        return zones

    def load_shelters(self) -> list[Shelter]:
        """Load shelters.json and return a list of Shelter models.

        Raises:
            SeedDataError: If the file is missing or entries fail validation.
        """
        filepath = self._file_path("shelters.json")
        if not filepath.exists():
            raise SeedDataError(f"shelters.json not found at {filepath}")
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"shelters.json at {filepath} is not valid JSON: {exc}"
            ) from exc

        shelters: list[Shelter] = []
        for i, entry in enumerate(data):
            try:
                shelter = Shelter(**entry)
                shelters.append(shelter)
            except Exception as exc:
                raise SeedDataError(
                    f"shelters.json at {filepath}: entry {i} failed validation: {exc}"
                ) from exc

        return shelters

    def load_scenario_presets(self) -> list[ScenarioPreset]:
        """Load scenario_presets.json and return a list of ScenarioPreset models.

        Raises:
            SeedDataError: If the file is missing or entries fail validation.
        """
        filepath = self._file_path("scenario_presets.json")
        if not filepath.exists():
            raise SeedDataError(
                f"scenario_presets.json not found at {filepath}"
            )
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise SeedDataError(
                f"scenario_presets.json at {filepath} is not valid JSON: {exc}"
            ) from exc

        presets: list[ScenarioPreset] = []
        for i, entry in enumerate(data):
            try:
                preset = ScenarioPreset(**entry)
                presets.append(preset)
            except Exception as exc:
                raise SeedDataError(
                    f"scenario_presets.json at {filepath}: entry {i} failed validation: {exc}"
                ) from exc

        return presets

    def load_warnings(self) -> list[dict]:
        """Load _warnings.json if it exists. Returns empty list if absent."""
        filepath = self._file_path("_warnings.json")
        if not filepath.exists():
            return []
        try:
            with open(filepath, "r") as f:
                return json.load(f)
        except Exception:
            return []

    def load_all(self) -> SeedData:
        """Validate and load all Region Dataset files.

        Orchestration order:
        1. Load and validate region_config.json.
        2. Validate all required files are present.
        3. Load each data file with type-specific validation.

        Raises:
            SeedDataError: With file path and problem description on failure.

        Returns:
            SeedData containing all loaded region data.
        """
        # Step 1: Load and validate region config
        region_config = self.load_region_config()

        # Step 2: Validate all required files exist
        self.validate_required_files()

        # Step 3: Load each data file
        fuel_grid = self.load_fuel_grid()
        grid_bounds = self.load_grid_bounds()

        # Load fire perimeter if specified in region config
        burn_perimeter: np.ndarray | None = None
        if region_config.fire_perimeter_file:
            burn_perimeter = self.load_fire_perimeter(
                region_config.fire_perimeter_file, grid_bounds
            )

        road_graph = self.load_road_graph()
        zones = self.load_zones()
        shelters = self.load_shelters()
        scenario_presets = self.load_scenario_presets()
        warnings = self.load_warnings()

        return SeedData(
            region_config=region_config,
            fuel_grid=fuel_grid,
            grid_bounds=grid_bounds,
            burn_perimeter=burn_perimeter,
            road_graph=road_graph,
            zones=zones,
            shelters=shelters,
            scenario_presets=scenario_presets,
            warnings=warnings,
        )
