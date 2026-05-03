from __future__ import annotations

import networkx as nx

from backend.evacuation.router import EvacuationRouter
from backend.models.schemas import Shelter, Zone


def _zone(zone_id: str, population: int, lat: float, lon: float) -> Zone:
    return Zone(
        zone_id=zone_id,
        population=population,
        elderly_pct=0.0,
        disability_pct=0.0,
        evacuation_priority_weight=1.0,
        centroid_lat=lat,
        centroid_lon=lon,
        geometry={},
    )


def _shelter(shelter_id: str, lat: float, lon: float) -> Shelter:
    return Shelter(
        shelter_id=shelter_id,
        name=shelter_id,
        lat=lat,
        lon=lon,
        capacity=100,
        accessible=True,
    )


def test_compute_baseline_routes_uses_nearest_reachable_shelter():
    graph = nx.DiGraph()
    graph.add_node(1, lat=0.0, lon=0.0)
    graph.add_node(2, lat=0.0, lon=1.0)
    graph.add_node(3, lat=0.0, lon=2.0)
    graph.add_node(4, lat=1.0, lon=0.0)
    graph.add_node(5, lat=1.0, lon=1.0)

    graph.add_edge(1, 2, travel_time=1.0, capacity=100)
    graph.add_edge(2, 3, travel_time=1.0, capacity=100)
    graph.add_edge(1, 4, travel_time=5.0, capacity=100)
    graph.add_edge(4, 5, travel_time=1.0, capacity=100)
    graph.add_edge(2, 5, travel_time=10.0, capacity=100)

    zones = [
        _zone("zone-a", 50, 0.0, 0.0),
        _zone("zone-b", 30, 1.0, 0.0),
    ]
    shelters = [
        _shelter("shelter-east", 0.0, 2.0),
        _shelter("shelter-south", 1.0, 1.0),
    ]

    router = EvacuationRouter(graph, zones, shelters)
    routes = router.compute_baseline_routes()

    assert routes["zone-a"].shelter_id == "shelter-east"
    assert routes["zone-a"].node_ids == [1, 2, 3]
    assert routes["zone-a"].total_travel_time == 2.0

    assert routes["zone-b"].shelter_id == "shelter-south"
    assert routes["zone-b"].node_ids == [4, 5]
    assert routes["zone-b"].total_travel_time == 1.0


def test_compute_baseline_routes_returns_none_when_unreachable():
    graph = nx.DiGraph()
    graph.add_node(1, lat=0.0, lon=0.0)
    graph.add_node(2, lat=0.0, lon=1.0)
    graph.add_node(3, lat=1.0, lon=1.0)
    graph.add_edge(1, 2, travel_time=1.0, capacity=100)

    zones = [_zone("zone-a", 50, 0.0, 0.0)]
    shelters = [_shelter("shelter-a", 1.0, 1.0)]

    router = EvacuationRouter(graph, zones, shelters)
    routes = router.compute_baseline_routes()

    assert routes["zone-a"].shelter_id == "none"
    assert routes["zone-a"].node_ids == []
    assert routes["zone-a"].total_travel_time == float("inf")
