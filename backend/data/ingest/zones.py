import json
import logging
from pathlib import Path

import requests
from shapely.geometry import Polygon, mapping, shape

from backend.data.ingest.overpass import IngestError

log = logging.getLogger(__name__)

TIGER_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/10/query"
ACS_URL = "https://api.census.gov/data/2022/acs/acs5"
ACS_VARS = "B01001_001E,B01001_020E,B01001_021E,B01001_022E,B01001_023E,B01001_024E,B01001_025E,B18101_001E,B18101_004E,B18101_007E"


def _largest_polygon(geom) -> Polygon:
    """Return the largest polygon from a MultiPolygon, or the polygon itself."""
    s = shape(geom)
    if s.geom_type == "MultiPolygon":
        return max(s.geoms, key=lambda p: p.area)
    return s


def _fetch_tiger(bbox: tuple[float, float, float, float]) -> list[dict]:
    min_lon, min_lat, max_lon, max_lat = bbox
    resp = requests.get(TIGER_URL, params={
        "geometry": f"{min_lon},{min_lat},{max_lon},{max_lat}",
        "geometryType": "esriGeometryEnvelope",
        "outFields": "GEOID,STATE,COUNTY,BLKGRP",
        "f": "geojson",
        "outSR": "4326",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()["features"]


def _fetch_acs(state: str, county: str, key: str | None) -> dict[str, dict]:
    params = {"get": ACS_VARS, "for": "block group:*", "in": f"state:{state} county:{county}"}
    if key:
        params["key"] = key
    resp = requests.get(ACS_URL, params=params, timeout=30)
    resp.raise_for_status()
    rows = resp.json()
    headers = rows[0]
    _geo_keys = {"state", "county", "tract", "block group"}
    result = {}
    for row in rows[1:]:
        d = dict(zip(headers, row))
        geoid = d["state"] + d["county"] + d["tract"] + d["block group"]
        result[geoid] = {k: int(v) if v is not None else 0 for k, v in d.items() if k not in _geo_keys}
    return result


def _compute_props(geoid: str, acs: dict) -> dict:
    pop = acs.get("B01001_001E", 0)
    elderly = sum(acs.get(k, 0) for k in ["B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E"])
    dis_universe = acs.get("B18101_001E", 0)
    dis_count = acs.get("B18101_004E", 0) + acs.get("B18101_007E", 0)
    elderly_pct = elderly / pop * 100 if pop > 0 else 0.0
    disability_pct = dis_count / dis_universe * 100 if dis_universe > 0 else 0.0
    return {
        "zone_id": geoid,
        "population": pop,
        "elderly_pct": round(elderly_pct, 2),
        "disability_pct": round(disability_pct, 2),
        "evacuation_priority_weight": round(1.0 + elderly_pct / 50 + disability_pct / 25, 4),
    }


def _fallback_zones(bbox: tuple[float, float, float, float]) -> list[dict]:
    min_lon, min_lat, max_lon, max_lat = bbox
    mid_lon = (min_lon + max_lon) / 2
    mid_lat = (min_lat + max_lat) / 2
    quads = [
        (min_lon, min_lat, mid_lon, mid_lat),
        (mid_lon, min_lat, max_lon, mid_lat),
        (min_lon, mid_lat, mid_lon, max_lat),
        (mid_lon, mid_lat, max_lon, max_lat),
    ]
    features = []
    for i, (x0, y0, x1, y1) in enumerate(quads):
        poly = Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
        c = poly.centroid
        features.append({
            "type": "Feature",
            "geometry": mapping(poly),
            "properties": {
                "zone_id": f"synthetic_{i}",
                "population": 2000,
                "elderly_pct": 20.0,
                "disability_pct": 8.0,
                "evacuation_priority_weight": round(1.0 + 20.0 / 50 + 8.0 / 25, 4),
                "centroid_lat": c.y,
                "centroid_lon": c.x,
            },
        })
    return features


def fetch_zones(
    bbox: tuple[float, float, float, float],
    output_path: Path,
    census_api_key: str | None = None,
) -> None:
    try:
        tiger_features = _fetch_tiger(bbox)

        # Collect unique (state, county) pairs
        state_county_pairs: set[tuple[str, str]] = {
            (f["properties"]["STATE"], f["properties"]["COUNTY"])
            for f in tiger_features
        }

        # Fetch ACS for each pair
        acs_data: dict[str, dict] = {}
        for state, county in state_county_pairs:
            acs_data.update(_fetch_acs(state, county, census_api_key))

        features = []
        for feat in tiger_features:
            geoid = feat["properties"]["GEOID"]
            poly = _largest_polygon(feat["geometry"])
            c = poly.centroid
            acs = acs_data.get(geoid, {})
            props = _compute_props(geoid, acs)
            props["centroid_lat"] = c.y
            props["centroid_lon"] = c.x
            features.append({"type": "Feature", "geometry": mapping(poly), "properties": props})

    except Exception as exc:
        log.warning("Census API fetch failed (%s); using synthetic fallback zones.", exc)
        features = _fallback_zones(bbox)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, indent=2))
    log.info("Wrote %d zones to %s", len(features), output_path)
