import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import networkx as nx
import numpy as np
import pytest

from backend.data.ingest.fuel import fetch_fuel_grid
from backend.data.ingest.orchestrator import generate_seed_data
from backend.data.ingest.overpass import IngestError
from backend.data.ingest.perimeters import fetch_perimeters
from backend.data.ingest.region import generate_region_config
from backend.data.ingest.roads import fetch_road_network
from backend.data.ingest.scenarios import generate_scenarios
from backend.data.ingest.shelters import fetch_shelters
from backend.data.ingest.zones import fetch_zones
from backend.data.loader import SeedDataLoader

PARADISE = (39.8103, -121.4377)
BBOX = (-121.4827, 39.7653, -121.3927, 39.8553)  # rough 5 km bbox


def _mock_nominatim(name="Paradise, CA"):
    m = MagicMock()
    m.raise_for_status = MagicMock()
    m.json.return_value = {"display_name": name}
    return m


def test_generate_region_config(tmp_path):
    with patch("backend.data.ingest.region.requests.get", return_value=_mock_nominatim()):
        bbox, grid_rows, grid_cols, seed_dir = generate_region_config(
            *PARADISE, radius_km=5, output_dir=tmp_path / "region"
        )

    assert len(bbox) == 4
    assert grid_rows > 0 and grid_cols > 0
    assert isinstance(seed_dir, Path)

    rc = json.loads((seed_dir / "region_config.json").read_text())
    assert "region_name" in rc
    assert "bounding_box" in rc
    assert "default_ignition_point" in rc
    assert rc["fire_perimeter_file"] is None

    gb = json.loads((seed_dir / "grid_bounds.json").read_text())
    assert "grid_rows" in gb and "grid_cols" in gb
    assert gb["grid_rows"] > 0 and gb["grid_cols"] > 0


def test_region_config_rejects_non_us(tmp_path):
    with pytest.raises(IngestError):
        generate_region_config(51.5, -0.12, output_dir=tmp_path / "london")


def test_fuel_grid_fallback(tmp_path):
    out = tmp_path / "fuel_grid.npy"
    rows, cols = 20, 25
    # Force fallback by ensuring rasterio path fails (no rasterio or mocked failure)
    with patch("backend.data.ingest.fuel._RASTERIO", False):
        fetch_fuel_grid(BBOX, rows, cols, out)

    assert out.exists()
    grid = np.load(out)
    assert grid.shape == (rows, cols)
    assert grid.min() >= 0.0 and grid.max() <= 1.5


def test_road_network_fallback(tmp_path):
    out = tmp_path / "road_graph.json"
    mock_client = MagicMock()
    mock_client.query.side_effect = IngestError("overpass down")

    fetch_road_network(BBOX, out, overpass_client=mock_client)

    assert out.exists()
    G = nx.node_link_graph(json.loads(out.read_text()))
    assert isinstance(G, nx.DiGraph)
    edge_data = list(G.edges(data=True))
    assert len(edge_data) > 0
    for _, _, attrs in edge_data:
        assert "travel_time" in attrs
        assert "capacity" in attrs


def test_shelters_fallback(tmp_path):
    out = tmp_path / "shelters.json"
    mock_client = MagicMock()
    mock_client.query.side_effect = IngestError("overpass down")

    fetch_shelters(BBOX, out, overpass_client=mock_client)

    assert out.exists()
    shelters = json.loads(out.read_text())
    assert len(shelters) >= 2
    for s in shelters:
        for key in ("shelter_id", "name", "lat", "lon", "capacity", "accessible"):
            assert key in s


def test_zones_fallback(tmp_path):
    out = tmp_path / "zones.geojson"
    with patch("backend.data.ingest.zones.requests.get", side_effect=Exception("no network")):
        fetch_zones(BBOX, out)

    assert out.exists()
    fc = json.loads(out.read_text())
    assert len(fc["features"]) == 4
    for feat in fc["features"]:
        props = feat["properties"]
        for key in ("zone_id", "population", "elderly_pct", "disability_pct",
                    "evacuation_priority_weight", "centroid_lat", "centroid_lon"):
            assert key in props


def test_scenarios_generated(tmp_path):
    out = tmp_path / "scenario_presets.json"
    generate_scenarios(BBOX, *PARADISE, out)

    assert out.exists()
    presets = json.loads(out.read_text())
    assert len(presets) == 3
    for p in presets:
        for key in ("name", "description", "ignition_lat", "ignition_lon",
                    "wind_speed_mph", "wind_direction_deg", "wind_gust_mph", "relative_humidity"):
            assert key in p


def test_perimeters_no_features(tmp_path):
    # Write a minimal region_config.json so fetch_perimeters can read it if needed
    (tmp_path / "region_config.json").write_text(json.dumps({"fire_perimeter_file": None}))

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"features": []}

    with patch("backend.data.ingest.perimeters.requests.get", return_value=mock_resp):
        result = fetch_perimeters(BBOX, tmp_path)

    assert result is False


def test_generate_seed_data_with_fallbacks(tmp_path):
    mock_nominatim = _mock_nominatim()
    mock_empty = MagicMock()
    mock_empty.raise_for_status = MagicMock()
    mock_empty.json.return_value = {"features": []}

    def requests_get_side_effect(url, **kwargs):
        if "nominatim" in url:
            return mock_nominatim
        return mock_empty

    with (
        patch("backend.data.ingest.region.requests.get", side_effect=requests_get_side_effect),
        patch("backend.data.ingest.zones.requests.get", side_effect=Exception("no network")),
        patch("backend.data.ingest.perimeters.requests.get", return_value=mock_empty),
        patch("backend.data.ingest.fuel._RASTERIO", False),
        patch("backend.data.ingest.overpass.OverpassClient.query", side_effect=IngestError("down")),
    ):
        result = generate_seed_data(*PARADISE, radius_km=5, cell_size_m=500)

    assert isinstance(result, Path)
    required = {"region_config.json", "grid_bounds.json", "fuel_grid.npy",
                "road_graph.json", "zones.geojson", "shelters.json", "scenario_presets.json"}
    for fname in required:
        assert (result / fname).exists(), f"Missing {fname}"

    SeedDataLoader(str(result)).load_all()
