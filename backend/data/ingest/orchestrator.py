import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from backend.data.ingest.overpass import IngestError, OverpassClient
from backend.data.ingest.region import generate_region_config
from backend.data.ingest.fuel import fetch_fuel_grid
from backend.data.ingest.roads import fetch_road_network
from backend.data.ingest.zones import fetch_zones
from backend.data.ingest.shelters import fetch_shelters
from backend.data.ingest.perimeters import fetch_perimeters
from backend.data.ingest.scenarios import generate_scenarios
from backend.data.loader import SeedDataLoader, SeedDataError

logger = logging.getLogger(__name__)


def generate_seed_data(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    cell_size_m: float = 100.0,
    census_api_key: str | None = None,
) -> Path:
    """Generate a complete seed data directory for the given location.
    Returns the path to the generated seed directory.
    Raises IngestError on failure.
    """
    if not (18 <= lat <= 72) or not (-180 <= lon <= -65):
        raise IngestError(f"Coordinates ({lat}, {lon}) are outside US bounds.")

    logger.info("Generating region config for (%.4f, %.4f)", lat, lon)
    bbox, grid_rows, grid_cols, seed_dir = generate_region_config(lat, lon, radius_km, cell_size_m)

    logger.info("Running parallel batch 1 (fuel, zones, scenarios)")
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(fetch_fuel_grid, bbox, grid_rows, grid_cols, seed_dir / "fuel_grid.npy"),
            executor.submit(fetch_zones, bbox, seed_dir / "zones.geojson", census_api_key),
            executor.submit(generate_scenarios, bbox, lat, lon, seed_dir / "scenario_presets.json"),
        ]
        for f in futures:
            f.result()

    logger.info("Running serial batch 2 (roads, shelters)")
    client = OverpassClient()
    fetch_road_network(bbox, seed_dir / "road_graph.json", overpass_client=client)
    fetch_shelters(bbox, seed_dir / "shelters.json", overpass_client=client)

    logger.info("Fetching fire perimeters")
    fetch_perimeters(bbox, seed_dir)

    logger.info("Validating generated seed data")
    try:
        SeedDataLoader(str(seed_dir)).load_all()
    except SeedDataError as e:
        raise IngestError(f"Seed data validation failed: {e}") from e

    logger.info("Seed data generated at %s", seed_dir)
    return seed_dir
