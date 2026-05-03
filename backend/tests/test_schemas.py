"""Tests for backend.models.schemas — Pydantic data models.

Covers:
- Region config models (BoundingBox, DefaultIgnitionPoint, RegionConfig)
- SimulationRequest worldwide coordinate validation
- Core data models (GridBounds, WindConditions, Zone, Shelter, ScenarioPreset, CostWeights)
- Result models (BurnProbabilityMap, ArrivalTimeStats, RouteResult, ZoneResult)
- Response models (SimulationResponse, SimulationSummary, WindResponse)
- Serialization round-trip
"""

import pytest
from pydantic import ValidationError

from backend.models.schemas import (
    ArrivalTimeStats,
    BoundingBox,
    BurnProbabilityMap,
    CostWeights,
    DefaultIgnitionPoint,
    GridBounds,
    RegionConfig,
    RouteResult,
    ScenarioPreset,
    Shelter,
    SimulationRequest,
    SimulationResponse,
    SimulationSummary,
    WindConditions,
    WindResponse,
    Zone,
    ZoneResult,
)


# ---------------------------------------------------------------------------
# Region Configuration
# ---------------------------------------------------------------------------

class TestBoundingBox:
    def test_valid(self):
        bb = BoundingBox(min_lat=39.65, max_lat=39.90, min_lon=-121.75, max_lon=-121.40)
        assert bb.min_lat == 39.65
        assert bb.max_lon == -121.40

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            BoundingBox(min_lat=39.65, max_lat=39.90, min_lon=-121.75)


class TestRegionConfig:
    def test_valid_with_perimeter(self):
        rc = RegionConfig(
            region_name="Paradise, CA",
            bounding_box=BoundingBox(min_lat=39.65, max_lat=39.90, min_lon=-121.75, max_lon=-121.40),
            default_ignition_point=DefaultIgnitionPoint(lat=39.81, lon=-121.44),
            fire_perimeter_file="camp_fire_perimeter.geojson",
        )
        assert rc.region_name == "Paradise, CA"
        assert rc.fire_perimeter_file == "camp_fire_perimeter.geojson"

    def test_valid_without_perimeter(self):
        rc = RegionConfig(
            region_name="Test Region",
            bounding_box=BoundingBox(min_lat=0, max_lat=1, min_lon=0, max_lon=1),
            default_ignition_point=DefaultIgnitionPoint(lat=0.5, lon=0.5),
        )
        assert rc.fire_perimeter_file is None

    def test_missing_region_name_raises(self):
        with pytest.raises(ValidationError):
            RegionConfig(
                bounding_box=BoundingBox(min_lat=0, max_lat=1, min_lon=0, max_lon=1),
                default_ignition_point=DefaultIgnitionPoint(lat=0.5, lon=0.5),
            )


# ---------------------------------------------------------------------------
# SimulationRequest — Worldwide Coordinate Validation
# ---------------------------------------------------------------------------

class TestSimulationRequest:
    def test_valid_coordinates(self):
        req = SimulationRequest(ignition_lat=39.76, ignition_lon=-121.62)
        assert req.ignition_lat == 39.76
        assert req.ignition_lon == -121.62

    def test_boundary_coordinates(self):
        """Lat/lon at exact boundaries should be accepted."""
        req_min = SimulationRequest(ignition_lat=-90.0, ignition_lon=-180.0)
        assert req_min.ignition_lat == -90.0
        req_max = SimulationRequest(ignition_lat=90.0, ignition_lon=180.0)
        assert req_max.ignition_lat == 90.0

    def test_lat_too_high_rejected(self):
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=90.1, ignition_lon=0.0)

    def test_lat_too_low_rejected(self):
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=-90.1, ignition_lon=0.0)

    def test_lon_too_high_rejected(self):
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=0.0, ignition_lon=180.1)

    def test_lon_too_low_rejected(self):
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=0.0, ignition_lon=-180.1)

    def test_defaults_applied(self):
        req = SimulationRequest(ignition_lat=0.0, ignition_lon=0.0)
        assert req.wind_speed_mph == 14.0
        assert req.wind_direction_deg == 225.0
        assert req.num_runs == 500
        assert req.max_timesteps == 180
        assert req.region is None

    def test_optional_region(self):
        req = SimulationRequest(
            ignition_lat=0.0, ignition_lon=0.0,
            region="paradise-ca",
        )
        assert req.region == "paradise-ca"

    def test_wind_direction_lt_360(self):
        """wind_direction_deg must be < 360 (lt, not le)."""
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=0.0, ignition_lon=0.0, wind_direction_deg=360.0)

    def test_num_runs_bounds(self):
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=0.0, ignition_lon=0.0, num_runs=0)
        with pytest.raises(ValidationError):
            SimulationRequest(ignition_lat=0.0, ignition_lon=0.0, num_runs=2001)


# ---------------------------------------------------------------------------
# Core Data Models
# ---------------------------------------------------------------------------

class TestCostWeights:
    def test_defaults(self):
        cw = CostWeights()
        assert cw.alpha == 1.0
        assert cw.beta == 0.5
        assert cw.gamma == 2.0
        assert cw.delta == 1.5

    def test_custom_weights(self):
        cw = CostWeights(alpha=2.0, beta=1.0, gamma=3.0, delta=0.5)
        assert cw.alpha == 2.0


class TestWindConditions:
    def test_valid(self):
        wc = WindConditions(
            wind_speed_mph=14.0,
            wind_direction_deg=225.0,
            wind_gust_mph=20.0,
            relative_humidity=18.0,
        )
        assert wc.wind_speed_mph == 14.0


class TestZone:
    def test_valid(self):
        z = Zone(
            zone_id="Z1", population=4200, elderly_pct=22.5,
            disability_pct=8.3, evacuation_priority_weight=1.8,
            centroid_lat=39.76, centroid_lon=-121.62,
            geometry={"type": "Polygon", "coordinates": []},
        )
        assert z.zone_id == "Z1"
        assert z.population == 4200


class TestShelter:
    def test_valid(self):
        s = Shelter(
            shelter_id="S1", name="Test Shelter",
            lat=39.76, lon=-121.62, capacity=500, accessible=True,
        )
        assert s.accessible is True


# ---------------------------------------------------------------------------
# Serialization Round-Trip
# ---------------------------------------------------------------------------

class TestSerializationRoundTrip:
    """Verify JSON serialize → deserialize produces equivalent objects."""

    def test_simulation_request_round_trip(self):
        req = SimulationRequest(ignition_lat=39.76, ignition_lon=-121.62, num_runs=10)
        data = req.model_dump()
        restored = SimulationRequest(**data)
        assert restored == req

    def test_region_config_round_trip(self):
        rc = RegionConfig(
            region_name="Test",
            bounding_box=BoundingBox(min_lat=0, max_lat=1, min_lon=0, max_lon=1),
            default_ignition_point=DefaultIgnitionPoint(lat=0.5, lon=0.5),
            fire_perimeter_file="test.geojson",
        )
        json_str = rc.model_dump_json()
        restored = RegionConfig.model_validate_json(json_str)
        assert restored == rc

    def test_wind_response_round_trip(self):
        wr = WindResponse(
            conditions=WindConditions(
                wind_speed_mph=14.0, wind_direction_deg=225.0,
                wind_gust_mph=20.0, relative_humidity=18.0,
            ),
            source="nws_live",
            forecast_text="Sunny with light winds",
        )
        json_str = wr.model_dump_json()
        restored = WindResponse.model_validate_json(json_str)
        assert restored == wr
