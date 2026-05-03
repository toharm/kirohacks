import json
import logging
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

_NIFC_URL = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services"
    "/WFIGS_Interagency_Perimeters/FeatureServer/0/query"
)


def fetch_perimeters(
    bbox: tuple[float, float, float, float],
    output_dir: Path,
) -> bool:
    """Returns True if perimeters were found and written, False otherwise."""
    min_lon, min_lat, max_lon, max_lat = bbox
    try:
        resp = requests.get(
            _NIFC_URL,
            params={
                "geometry": f"{min_lon},{min_lat},{max_lon},{max_lat}",
                "geometryType": "esriGeometryEnvelope",
                "spatialRel": "esriSpatialRelIntersects",
                "outFields": "*",
                "f": "geojson",
                "outSR": "4326",
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("features"):
            return False

        perimeter_path = output_dir / "fire_perimeter.geojson"
        perimeter_path.write_text(json.dumps(data))

        config_path = output_dir / "region_config.json"
        config = json.loads(config_path.read_text())
        config["fire_perimeter_file"] = "fire_perimeter.geojson"
        config_path.write_text(json.dumps(config, indent=2))
        return True
    except Exception as exc:
        logger.warning("NIFC perimeter fetch failed: %s", exc)
        return False
