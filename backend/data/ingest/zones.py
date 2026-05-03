"""Fetch population zones from US Census ACS + TIGER."""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

CENSUS_ACS_URL = "https://api.census.gov/data/2022/acs/acs5"
TIGER_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2022/MapServer/8/query"


def _centroid(coords: list) -> tuple[float, float]:
    """Compute centroid of a polygon ring."""
    ring = coords[0] if coords else []
    if not ring:
        return 0.0, 0.0
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return sum(lats) / len(lats), sum(lons) / len(lons)


def fetch_zones(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    output_path: Path,
) -> dict:
    """Fetch Census block groups with demographics and geometry."""
    try:
        # Get state/county FIPS from centroid
        lat_c = (min_lat + max_lat) / 2
        lon_c = (min_lon + max_lon) / 2

        geo_url = f"https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
        r = requests.get(geo_url, params={
            "x": lon_c, "y": lat_c,
            "benchmark": "Public_AR_Current",
            "vintage": "Current_Current",
            "format": "json",
        }, timeout=30, headers={"User-Agent": "EvacuAI/1.0"})
        r.raise_for_status()

        geo_data = r.json()
        geographies = geo_data.get("result", {}).get("geographies", {})
        counties = geographies.get("Counties", [{}])
        state_fips = counties[0].get("STATE", "06")
        county_fips = counties[0].get("COUNTY", "007")

        # Fetch ACS demographics for block groups in county
        # B01001: male 65+ (020-025), female 65+ (044-049)
        # C18108_001E: total pop for disability, C18108_002E: with disability
        elderly_male_cols = ",".join(f"B01001_0{c:02d}E" for c in range(20, 26))
        elderly_female_cols = ",".join(f"B01001_0{c:02d}E" for c in range(44, 50))
        acs_r = requests.get(CENSUS_ACS_URL, params={
            "get": f"B01001_001E,{elderly_male_cols},{elderly_female_cols},C18108_001E,C18108_002E",
            "for": "block group:*",
            "in": f"state:{state_fips} county:{county_fips}",
        }, timeout=30, headers={"User-Agent": "EvacuAI/1.0"})
        acs_r.raise_for_status()
        acs_rows = acs_r.json()
        headers = acs_rows[0]
        acs_data = {
            f"{row[headers.index('state')]}{row[headers.index('county')]}{row[headers.index('tract')]}{row[headers.index('block group')]}": row
            for row in acs_rows[1:]
        }

        # Fetch TIGER geometries
        bbox = f"{min_lon},{min_lat},{max_lon},{max_lat}"
        tiger_r = requests.get(TIGER_URL, params={
            "where": f"STATE='{state_fips}' AND COUNTY='{county_fips}'",
            "outFields": "GEOID,STATE,COUNTY,TRACT,BLKGRP",
            "geometryType": "esriGeometryEnvelope",
            "spatialRel": "esriSpatialRelIntersects",
            "inSR": "4326",
            "outSR": "4326",
            "f": "geojson",
            "returnGeometry": "true",
        }, timeout=60, headers={"User-Agent": "EvacuAI/1.0"})
        tiger_r.raise_for_status()
        tiger_data = tiger_r.json()

        features = []
        max_pop = 1
        for feat in tiger_data.get("features", []):
            props = feat.get("properties", {})
            geoid = props.get("GEOID", "")
            geom = feat.get("geometry", {})

            row = acs_data.get(geoid, None)
            if row is None:
                continue

            idx = headers.index
            total_pop = int(row[idx("B01001_001E")] or 0)
            # Elderly: male 65+ (cols 020-025) + female 65+ (cols 044-049)
            elderly_male = sum(int(row[idx(f"B01001_0{c:02d}E")] or 0) for c in range(20, 26))
            elderly_female = sum(int(row[idx(f"B01001_0{c:02d}E")] or 0) for c in range(44, 50))
            elderly = elderly_male + elderly_female
            # Disability: C18108_002E (with disability) out of C18108_001E (total)
            disabled = int(row[idx("C18108_002E")] or 0)
            max_pop = max(max_pop, total_pop)

            elderly_pct = (elderly / total_pop * 100) if total_pop > 0 else 0.0
            disability_pct = (disabled / total_pop * 100) if total_pop > 0 else 0.0

            coords = geom.get("coordinates", [[]])
            c_lat, c_lon = _centroid(coords)

            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "zone_id": geoid,
                    "population": total_pop,
                    "elderly_pct": round(elderly_pct, 2),
                    "disability_pct": round(disability_pct, 2),
                    "evacuation_priority_weight": 1.0,
                    "centroid_lat": round(c_lat, 6),
                    "centroid_lon": round(c_lon, 6),
                },
            })

        result = {"type": "FeatureCollection", "features": features}
        with open(output_path, "w") as f:
            json.dump(result, f)
        logger.info("Zones saved: %s (%d features)", output_path, len(features))
        return result

    except Exception as e:
        logger.warning("Census zones fetch failed: %s", e)
        return _synthetic_zones(min_lat, max_lat, min_lon, max_lon, output_path)


def _synthetic_zones(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float,
    output_path: Path,
) -> dict:
    logger.warning("Using synthetic zones (DEGRADED DATA)")
    lat_mid = (min_lat + max_lat) / 2
    lon_mid = (min_lon + max_lon) / 2
    features = []
    for i, (clat, clon) in enumerate([
        (lat_mid - 0.05, lon_mid - 0.05),
        (lat_mid - 0.05, lon_mid + 0.05),
        (lat_mid + 0.05, lon_mid - 0.05),
        (lat_mid + 0.05, lon_mid + 0.05),
    ]):
        d = 0.04
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [clon - d, clat - d], [clon + d, clat - d],
                    [clon + d, clat + d], [clon - d, clat + d],
                    [clon - d, clat - d],
                ]],
            },
            "properties": {
                "zone_id": f"zone_{i+1:03d}",
                "population": 2000 + i * 500,
                "elderly_pct": 15.0 + i * 2,
                "disability_pct": 8.0 + i,
                "evacuation_priority_weight": 1.0,
                "centroid_lat": clat,
                "centroid_lon": clon,
            },
        })
    result = {"type": "FeatureCollection", "features": features}
    with open(output_path, "w") as f:
        json.dump(result, f)
    return result
