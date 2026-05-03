"""
Test script to verify NLCD WCS API works for Paradise, CA bounding box.
Run: python backend/tests/test_nlcd_api.py
"""
import io
import sys
import requests

BBOX = {
    "min_lat": 39.65, "max_lat": 39.90,
    "min_lon": -121.75, "max_lon": -121.40,
}

def test_nlcd_wcs():
    """Test NLCD 2021 Land Cover WCS endpoint."""
    url = "https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wcs"
    params = {
        "SERVICE": "WCS",
        "VERSION": "2.0.1",
        "REQUEST": "GetCoverage",
        "COVERAGEID": "NLCD_2021_Land_Cover_L48",
        "FORMAT": "image/tiff",
        "SUBSET": f"Long({BBOX['min_lon']},{BBOX['max_lon']})",
        "SUBSET": f"Lat({BBOX['min_lat']},{BBOX['max_lat']})",
        "SUBSETTINGCRS": "http://www.opengis.net/def/crs/EPSG/0/4326",
    }
    # WCS SUBSET needs two separate params with same key — use list of tuples
    params_list = [
        ("SERVICE", "WCS"),
        ("VERSION", "2.0.1"),
        ("REQUEST", "GetCoverage"),
        ("COVERAGEID", "NLCD_2021_Land_Cover_L48"),
        ("FORMAT", "image/tiff"),
        ("SUBSET", f"Long({BBOX['min_lon']},{BBOX['max_lon']})"),
        ("SUBSET", f"Lat({BBOX['min_lat']},{BBOX['max_lat']})"),
        ("SUBSETTINGCRS", "http://www.opengis.net/def/crs/EPSG/0/4326"),
    ]
    print("Testing NLCD WCS API...")
    try:
        r = requests.get(url, params=params_list, timeout=30, headers={"User-Agent": "EvacuAI/1.0"})
        print(f"  Status: {r.status_code}")
        print(f"  Content-Type: {r.headers.get('Content-Type', 'unknown')}")
        print(f"  Content-Length: {len(r.content)} bytes")
        if r.status_code == 200 and len(r.content) > 1000:
            print("  ✅ NLCD WCS: OK")
            return True
        else:
            print(f"  ❌ NLCD WCS: unexpected response")
            print(f"  Body preview: {r.text[:300]}")
            return False
    except Exception as e:
        print(f"  ❌ NLCD WCS: {e}")
        return False


def test_nlcd_capabilities():
    """Test NLCD WCS GetCapabilities to confirm service is up."""
    url = "https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wcs"
    params = [("SERVICE", "WCS"), ("VERSION", "2.0.1"), ("REQUEST", "GetCapabilities")]
    print("Testing NLCD WCS GetCapabilities...")
    try:
        r = requests.get(url, params=params, timeout=15, headers={"User-Agent": "EvacuAI/1.0"})
        print(f"  Status: {r.status_code}")
        if r.status_code == 200 and "WCS_Capabilities" in r.text or "Capabilities" in r.text:
            print("  ✅ NLCD Capabilities: OK")
            return True
        else:
            print(f"  ❌ NLCD Capabilities: unexpected response")
            print(f"  Body preview: {r.text[:300]}")
            return False
    except Exception as e:
        print(f"  ❌ NLCD Capabilities: {e}")
        return False


def test_nifc_historical():
    """Test NIFC historical fire perimeters endpoint for Camp Fire."""
    url = (
        "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
        "WFIGS_Interagency_Perimeters/FeatureServer/0/query"
    )
    params = {
        "where": "IncidentName LIKE '%Camp%' AND EXTRACT(YEAR FROM DiscoveryAcres) = 2018",
        "outFields": "IncidentName,GISAcres",
        "f": "json",
        "resultRecordCount": 3,
    }
    # Simpler query first
    params = {
        "where": "IncidentName LIKE '%Camp%'",
        "outFields": "IncidentName,GISAcres,FireDiscoveryDateTime",
        "orderByFields": "GISAcres DESC",
        "resultRecordCount": 5,
        "f": "json",
    }
    print("Testing NIFC historical perimeters (Camp Fire)...")
    try:
        r = requests.get(url, params=params, timeout=15, headers={"User-Agent": "EvacuAI/1.0"})
        print(f"  Status: {r.status_code}")
        data = r.json()
        features = data.get("features", [])
        print(f"  Features returned: {len(features)}")
        for f in features[:3]:
            attrs = f.get("attributes", {})
            print(f"    - {attrs.get('IncidentName')} | {attrs.get('GISAcres')} acres | {attrs.get('FireDiscoveryDateTime')}")
        if r.status_code == 200 and features:
            print("  ✅ NIFC historical: OK")
            return True
        else:
            print("  ❌ NIFC historical: no features or error")
            return False
    except Exception as e:
        print(f"  ❌ NIFC historical: {e}")
        return False


def test_nifc_geojson():
    """Test NIFC with geojson output and geometry for Camp Fire."""
    url = (
        "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
        "WFIGS_Interagency_Perimeters/FeatureServer/0/query"
    )
    params = [
        ("where", "IncidentName LIKE '%Camp%'"),
        ("outFields", "IncidentName,GISAcres"),
        ("orderByFields", "GISAcres DESC"),
        ("resultRecordCount", "1"),
        ("returnGeometry", "true"),
        ("outSR", "4326"),
        ("f", "geojson"),
    ]
    print("Testing NIFC GeoJSON with geometry...")
    try:
        r = requests.get(url, params=params, timeout=15, headers={"User-Agent": "EvacuAI/1.0"})
        print(f"  Status: {r.status_code}")
        data = r.json()
        features = data.get("features", [])
        print(f"  Features returned: {len(features)}")
        if features:
            geom_type = features[0].get("geometry", {}).get("type", "none")
            print(f"  Geometry type: {geom_type}")
            print(f"  ✅ NIFC GeoJSON: OK")
            return True
        else:
            print(f"  ❌ NIFC GeoJSON: no features")
            print(f"  Body: {r.text[:300]}")
            return False
    except Exception as e:
        print(f"  ❌ NIFC GeoJSON: {e}")
        return False


if __name__ == "__main__":
    results = []
    results.append(test_nlcd_capabilities())
    results.append(test_nlcd_wcs())
    results.append(test_nifc_historical())
    results.append(test_nifc_geojson())

    print(f"\n{'='*40}")
    passed = sum(results)
    print(f"Results: {passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)
