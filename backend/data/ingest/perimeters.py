"""Fetch fire perimeter from NIFC GeoMAC historical or WFIGS."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

# Historical fires (pre-2020) live in year-specific GeoMAC endpoints
GEOMAC_URL_TEMPLATE = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "Historic_Geomac_Perimeters_{year}/FeatureServer/0/query"
)
# Current/recent fires (2020+) live in WFIGS
WFIGS_URL = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Interagency_Perimeters/FeatureServer/0/query"
)


def fetch_perimeter(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    fire_name: str,
    output_path: Path,
    year: int = 2018,
) -> dict:
    """
    Fetch fire perimeter by name. Tries GeoMAC historical years first,
    then WFIGS for recent fires. If fire_name is None or not found, uses
    a bbox-based spatial query against WFIGS.
    """
    # Sanitize fire_name to prevent injection
    import re
    safe_name = re.sub(r"[^a-zA-Z0-9 ]", "", fire_name) if fire_name else ""

    # Try WFIGS first (covers 2020+)
    try:
        r = requests.get(WFIGS_URL, params=[
            ("where", f"IncidentName LIKE '%{safe_name}%'"),
            ("outFields", "IncidentName,GISAcres"),
            ("orderByFields", "GISAcres DESC"),
            ("resultRecordCount", "1"),
            ("returnGeometry", "true"),
            ("outSR", "4326"),
            ("f", "geojson"),
        ], timeout=30, headers={"User-Agent": "EvacuAI/1.0"})
        r.raise_for_status()
        data = r.json()
        features = data.get("features", [])
        if features:
            result = {"type": "FeatureCollection", "features": [features[0]]}
            with open(output_path, "w") as f:
                json.dump(result, f)
            logger.info("Fire perimeter saved from WFIGS: %s", output_path)
            return result
    except Exception as e:
        logger.debug("WFIGS perimeter attempt failed: %s", e)

    # Try GeoMAC historical years (covers pre-2020 fires)
    # Try the specified year first, then scan nearby years
    years_to_try = [year] + [y for y in range(2019, 2013, -1) if y != year]
    for yr in years_to_try:
        geomac_url = GEOMAC_URL_TEMPLATE.format(year=yr)
        try:
            r = requests.get(geomac_url, params=[
                ("where", f"incidentname LIKE '%{safe_name.upper()}%'"),
                ("outFields", "incidentname,gisacres,state"),
                ("orderByFields", "gisacres DESC"),
                ("resultRecordCount", "1"),
                ("returnGeometry", "true"),
                ("outSR", "4326"),
                ("f", "geojson"),
            ], timeout=30, headers={"User-Agent": "EvacuAI/1.0"})
            r.raise_for_status()
            data = r.json()
            features = data.get("features", [])
            if features:
                result = {"type": "FeatureCollection", "features": [features[0]]}
                with open(output_path, "w") as f:
                    json.dump(result, f)
                acres = features[0].get("properties", {}).get("gisacres", "?")
                logger.info("Fire perimeter saved from GeoMAC %d: %s (%.0f acres)",
                            yr, output_path, float(acres) if acres != "?" else 0)
                return result
        except Exception as e:
            logger.debug("GeoMAC %d perimeter attempt failed: %s", yr, e)

    logger.warning("No perimeter found for '%s', using synthetic fallback", fire_name)
    return _synthetic_perimeter(min_lat, max_lat, min_lon, max_lon, output_path)


def _synthetic_perimeter(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    output_path: Path,
) -> dict:
    logger.warning("Using synthetic fire perimeter (DEGRADED DATA)")
    lat_c = (min_lat + max_lat) / 2
    lon_c = (min_lon + max_lon) / 2
    d = 0.02
    result = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon_c - d, lat_c - d], [lon_c + d, lat_c - d],
                    [lon_c + d, lat_c + d], [lon_c - d, lat_c + d],
                    [lon_c - d, lat_c - d],
                ]],
            },
            "properties": {"incidentname": "Synthetic", "gisacres": 1000},
        }],
    }
    with open(output_path, "w") as f:
        json.dump(result, f)
    return result
