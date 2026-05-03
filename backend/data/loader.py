from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import networkx as nx
from shapely.geometry import shape, Point

from backend.models.schemas import (
    GridBounds, RegionConfig, Zone, Shelter, ScenarioPreset, SeedData
)


class SeedDataError(Exception):
    pass


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

    DEFAULT_SEED_DIR = "backend/data/seed/paradise-ca/"

    def __init__(self, seed_dir: str = DEFAULT_SEED_DIR) -> None:
        self.seed_dir = Path(seed_dir)
        if not self.seed_dir.exists():
            raise SeedDataError(f"Directory not found: {self.seed_dir}")

    def _path(self, filename: str) -> Path:
        return self.seed_dir / filename

    def load_all(self, *, load_fire_perimeter: bool = True) -> SeedData:
        region_config = self.load_region_config()
        self.validate_required_files()
        grid_bounds = self.load_grid_bounds()
        fuel_grid = self.load_fuel_grid()
        road_graph = self.load_road_graph()
        zones = self.load_zones()
        shelters = self.load_shelters()
        scenario_presets = self.load_scenario_presets()

        fire_perimeter = None
        if load_fire_perimeter and region_config.fire_perimeter_file:
            perimeter_path = self._path(region_config.fire_perimeter_file)
            if not perimeter_path.exists():
                raise SeedDataError(
                    f"Fire perimeter file not found: {perimeter_path}"
                )
            fire_perimeter = self.load_fire_perimeter(
                region_config.fire_perimeter_file, grid_bounds
            )

        return SeedData(
            region_config=region_config,
            grid_bounds=grid_bounds,
            fuel_grid=fuel_grid,
            road_graph=road_graph,
            zones=zones,
            shelters=shelters,
            scenario_presets=scenario_presets,
            fire_perimeter=fire_perimeter,
        )

    def load_region_config(self) -> RegionConfig:
        p = self._path("region_config.json")
        if not p.exists():
            raise SeedDataError(f"region_config.json not found in {self.seed_dir}")
        try:
            with open(p) as f:
                data = json.load(f)
            return RegionConfig(**data)
        except Exception as e:
            raise SeedDataError(f"region_config.json malformed: {e}") from e

    def validate_required_files(self) -> None:
        missing = [f for f in self.REQUIRED_FILES if not self._path(f).exists()]
        if missing:
            raise SeedDataError(f"Missing required files in {self.seed_dir}: {missing}")

    def load_fuel_grid(self) -> np.ndarray:
        p = self._path("fuel_grid.npy")
        try:
            grid = np.load(str(p)).astype(np.float32)
        except Exception as e:
            raise SeedDataError(f"fuel_grid.npy malformed: {e}") from e
        if grid.min() < 0.0 or grid.max() > 1.5:
            raise SeedDataError(
                f"fuel_grid.npy values out of range [0.0, 1.5]: "
                f"min={grid.min()}, max={grid.max()}"
            )
        return grid

    def load_grid_bounds(self) -> GridBounds:
        p = self._path("grid_bounds.json")
        try:
            with open(p) as f:
                data = json.load(f)
            return GridBounds(**data)
        except Exception as e:
            raise SeedDataError(f"grid_bounds.json malformed: {e}") from e

    def load_fire_perimeter(self, filename: str, grid_bounds: GridBounds) -> np.ndarray:
        """Load fire perimeter GeoJSON and rasterize to binary mask."""
        p = self._path(filename)
        try:
            with open(p) as f:
                geojson = json.load(f)
        except Exception as e:
            raise SeedDataError(f"{filename} malformed: {e}") from e

        gb = grid_bounds
        mask = np.zeros((gb.grid_rows, gb.grid_cols), dtype=bool)

        # Collect all geometry shapes from features
        polygons = []
        for feat in geojson.get("features", []):
            geom = feat.get("geometry")
            if geom:
                polygons.append(shape(geom))

        if not polygons:
            return mask

        from shapely.ops import unary_union
        merged = unary_union(polygons)

        # Rasterize: check each cell center against the polygon
        for r in range(gb.grid_rows):
            lat = gb.max_lat - (r + 0.5) * (gb.max_lat - gb.min_lat) / gb.grid_rows
            for c in range(gb.grid_cols):
                lon = gb.min_lon + (c + 0.5) * (gb.max_lon - gb.min_lon) / gb.grid_cols
                if merged.contains(Point(lon, lat)):
                    mask[r, c] = True

        return mask

    def load_road_graph(self) -> nx.DiGraph:
        p = self._path("road_graph.json")
        try:
            with open(p) as f:
                data = json.load(f)
        except Exception as e:
            raise SeedDataError(f"road_graph.json malformed: {e}") from e

        G = nx.DiGraph()
        for node in data.get("nodes", []):
            G.add_node(node["id"], lat=node["lat"], lon=node["lon"])

        for link in data.get("links", []):
            if "travel_time" not in link or "capacity" not in link:
                raise SeedDataError(
                    f"road_graph.json link missing required attributes: {link}"
                )
            G.add_edge(
                link["source"],
                link["target"],
                travel_time=link["travel_time"],
                capacity=link["capacity"],
                highway=link.get("highway", "residential"),
            )
        return G

    def load_zones(self) -> list[Zone]:
        p = self._path("zones.geojson")
        try:
            with open(p) as f:
                geojson = json.load(f)
        except Exception as e:
            raise SeedDataError(f"zones.geojson malformed: {e}") from e

        zones = []
        for feat in geojson.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            required = ["zone_id", "population", "elderly_pct", "disability_pct",
                        "evacuation_priority_weight", "centroid_lat", "centroid_lon"]
            missing = [k for k in required if k not in props]
            if missing:
                raise SeedDataError(
                    f"zones.geojson feature missing fields: {missing}"
                )
            zones.append(Zone(
                zone_id=props["zone_id"],
                population=props["population"],
                elderly_pct=props["elderly_pct"],
                disability_pct=props["disability_pct"],
                evacuation_priority_weight=props["evacuation_priority_weight"],
                centroid_lat=props["centroid_lat"],
                centroid_lon=props["centroid_lon"],
                geometry=geom,
            ))
        return zones

    def load_shelters(self) -> list[Shelter]:
        p = self._path("shelters.json")
        try:
            with open(p) as f:
                data = json.load(f)
            return [Shelter(**s) for s in data]
        except Exception as e:
            raise SeedDataError(f"shelters.json malformed: {e}") from e

    def load_scenario_presets(self) -> list[ScenarioPreset]:
        p = self._path("scenario_presets.json")
        try:
            with open(p) as f:
                data = json.load(f)
            return [ScenarioPreset(**s) for s in data]
        except Exception as e:
            raise SeedDataError(f"scenario_presets.json malformed: {e}") from e
