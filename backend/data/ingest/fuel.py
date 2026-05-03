import json
import logging
import tempfile
import time
from pathlib import Path

import numpy as np
import requests

from backend.data.ingest.overpass import IngestError

try:
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.warp import reproject
    _RASTERIO = True
except ImportError:
    _RASTERIO = False

log = logging.getLogger(__name__)

_BASE = "https://lfps.usgs.gov/arcgis/rest/services/LandfireProductService/GPServer/LandfireProductService"

FBFM40 = {
    91: 0.0, 92: 0.0, 93: 0.0, 98: 0.0, 99: 0.0,
    1: 0.3, 2: 0.4, 3: 0.5, 4: 0.6, 5: 0.5, 6: 0.4, 7: 0.5, 8: 0.3, 9: 0.4, 10: 0.6,
    101: 0.4, 102: 0.5, 103: 0.6, 104: 0.8,
    105: 0.8, 106: 0.9, 107: 1.0, 108: 1.1, 109: 1.2,
    121: 0.5, 122: 0.6, 123: 0.7, 124: 0.9,
    141: 0.6, 142: 0.7, 143: 0.7, 144: 0.8, 145: 0.8, 146: 0.9, 147: 0.9, 148: 1.0, 149: 1.1,
    161: 0.5, 162: 0.6, 163: 0.7, 164: 0.8, 165: 0.9,
    181: 0.3, 182: 0.3, 183: 0.4, 184: 0.4, 185: 0.5, 186: 0.5, 187: 0.6, 188: 0.6, 189: 0.7,
    201: 0.8, 202: 1.0, 203: 1.2, 204: 1.5,
}


def _map_codes(arr: np.ndarray) -> np.ndarray:
    out = np.full(arr.shape, 0.5, dtype=np.float32)
    for code, rate in FBFM40.items():
        out[arr == code] = rate
    return out


def _synthetic(grid_rows: int, grid_cols: int) -> np.ndarray:
    rng = np.random.default_rng()
    return np.clip(rng.normal(0.6, 0.2, (grid_rows, grid_cols)), 0.0, 1.5).astype(np.float32)


def fetch_fuel_grid(
    bbox: tuple[float, float, float, float],
    grid_rows: int,
    grid_cols: int,
    output_path: Path,
    timeout: int = 300,
) -> None:
    min_lon, min_lat, max_lon, max_lat = bbox
    try:
        if not _RASTERIO:
            raise IngestError("rasterio not available")

        aoi = json.dumps({
            "xmin": min_lon, "ymin": min_lat, "xmax": max_lon, "ymax": max_lat,
            "spatialReference": {"wkid": 4326},
        })
        resp = requests.post(
            f"{_BASE}/submitJob",
            data={"Layer_List": "FBFM40", "Area_of_Interest": aoi, "Output_Format": "GeoTIFF", "f": "json"},
            timeout=60,
        )
        resp.raise_for_status()
        job_id = resp.json()["jobId"]

        deadline = time.time() + timeout
        while time.time() < deadline:
            status = requests.get(f"{_BASE}/jobs/{job_id}?f=json", timeout=30).json()
            js = status.get("jobStatus", "")
            if js == "esriJobSucceeded":
                break
            if "Failed" in js or "Cancelled" in js:
                raise IngestError(f"LANDFIRE job {job_id} ended with status {js}")
            time.sleep(5)
        else:
            raise IngestError(f"LANDFIRE job {job_id} timed out after {timeout}s")

        result = requests.get(f"{_BASE}/jobs/{job_id}/results/Output_File?f=json", timeout=30).json()
        tif_url = result["value"]["url"]

        with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            with requests.get(tif_url, stream=True, timeout=120) as dl:
                dl.raise_for_status()
                for chunk in dl.iter_content(65536):
                    tmp.write(chunk)

        with rasterio.open(tmp_path) as src:
            dst_transform = rasterio.transform.from_bounds(min_lon, min_lat, max_lon, max_lat, grid_cols, grid_rows)
            dst_arr = np.empty((grid_rows, grid_cols), dtype=np.int32)
            reproject(
                source=rasterio.band(src, 1),
                destination=dst_arr,
                src_crs=src.crs,
                dst_transform=dst_transform,
                dst_crs="EPSG:4326",
                resampling=Resampling.nearest,
            )

        tmp_path.unlink(missing_ok=True)
        grid = _map_codes(dst_arr)

    except Exception as exc:
        log.warning("LANDFIRE fetch failed (%s); using synthetic fuel grid", exc)
        grid = _synthetic(grid_rows, grid_cols)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(output_path, grid)
