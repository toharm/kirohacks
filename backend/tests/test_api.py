"""Tests for FastAPI endpoints (api/routes.py)."""

import pytest
from fastapi.testclient import TestClient

from backend.api.app import app

client = TestClient(app)

SEED_DIR = "backend/data/seed/paradise-ca/"


class TestScenariosEndpoint:
    """GET /api/scenarios"""

    def test_list_scenarios_returns_presets(self):
        resp = client.get("/api/scenarios", params={"region": "paradise-ca"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "name" in data[0]
        assert "wind_speed_mph" in data[0]

    def test_list_scenarios_bad_region(self):
        resp = client.get("/api/scenarios", params={"region": "nonexistent"})
        assert resp.status_code == 404


class TestWindEndpoint:
    """GET /api/wind"""

    def test_wind_returns_conditions(self):
        # Non-US coords will hit fallback, which is fine
        resp = client.get("/api/wind", params={"lat": 0.0, "lon": 0.0})
        assert resp.status_code == 200
        data = resp.json()
        assert "conditions" in data
        assert "source" in data
        assert "wind_speed_mph" in data["conditions"]


class TestSimulateEndpoint:
    """POST /api/simulate"""

    def test_simulate_minimal(self):
        resp = client.post("/api/simulate", json={
            "ignition_lat": 39.8103,
            "ignition_lon": -121.4377,
            "num_runs": 2,
            "max_timesteps": 5,
            "seed": 42,
            "region": "paradise-ca",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["region_name"] == "Paradise, CA"
        assert data["num_runs"] >= 1
        assert "burn_probability_map" in data
        assert "zone_results" in data
        assert "summary" in data
        assert "evacuation_ordering" in data

    def test_simulate_with_preset(self):
        # First get a valid preset name
        presets = client.get("/api/scenarios", params={"region": "paradise-ca"}).json()
        preset_name = presets[0]["name"]

        resp = client.post("/api/simulate", json={
            "ignition_lat": 39.8103,
            "ignition_lon": -121.4377,
            "num_runs": 2,
            "max_timesteps": 5,
            "seed": 42,
            "scenario_preset": preset_name,
            "region": "paradise-ca",
        })
        assert resp.status_code == 200
        assert resp.json()["scenario"] == preset_name

    def test_simulate_bad_preset(self):
        resp = client.post("/api/simulate", json={
            "ignition_lat": 39.8103,
            "ignition_lon": -121.4377,
            "num_runs": 2,
            "max_timesteps": 5,
            "scenario_preset": "nonexistent_preset",
            "region": "paradise-ca",
        })
        assert resp.status_code == 400

    def test_simulate_bad_region(self):
        resp = client.post("/api/simulate", json={
            "ignition_lat": 39.8103,
            "ignition_lon": -121.4377,
            "num_runs": 2,
            "max_timesteps": 5,
            "region": "nonexistent",
        })
        assert resp.status_code == 404
