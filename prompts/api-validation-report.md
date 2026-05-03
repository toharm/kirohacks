# Kirohacks API Validation Report

## Summary Table

| API                       | Status         | Critical Issues                                                     | Questions                                                 |
| ------------------------- | -------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| US Census / TIGER         | 🟡 UNVALIDATED | No error handling on ACS 422/403; no key validation                 | Does the TIGER ACS2023 layer match the ACS 2022 vintage?  |
| Overpass (Roads/Shelters) | 🟡 UNVALIDATED | Shelter query confirmed; no fallback if 0 shelters found            | None — query is explicit and readable                     |
| USGS LANDFIRE             | 🟡 UNVALIDATED | Full URL confirmed; rasterio optional dep silently falls back       | Is the GPServer endpoint still active for FBFM40 in 2025? |
| NIFC / WFIGS ArcGIS       | ✅ WIRED       | None critical — full URL present, correct params                    | None                                                      |
| Nominatim Geocoding       | 🟡 UNVALIDATED | User-Agent set ✅; format=json missing; bare except swallows errors | None                                                      |

---

## US Census / TIGER — Detailed Findings

**Backend Route:** `backend/data/ingest/zones.py` → `fetch_zones()` (called from orchestrator, triggered by POST `/api/ingest`)

**Constructed URLs:**

TIGER Web:

```
GET https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/10/query
  ?geometry={min_lon},{min_lat},{max_lon},{max_lat}
  &geometryType=esriGeometryEnvelope
  &outFields=GEOID,STATE,COUNTY,BLKGRP
  &f=geojson
  &outSR=4326
  &inSR=4326
  &spatialRel=esriSpatialRelIntersects
```

ACS:

```
GET https://api.census.gov/data/2022/acs/acs5
  ?get=B01001_001E,B01001_020E,...,B18101_007E
  &for=block group:*
  &in=state:{state} county:{county}
  [&key={CENSUS_API_KEY}]
```

**Error Handling:** Partial — a bare `except Exception` wraps the entire TIGER + ACS fetch block and falls back to synthetic zones. Individual HTTP errors (`raise_for_status()`) are present on both requests, but the fallback means failures are silent in production.

**Frontend Wiring:**

- The `/api/ingest` endpoint is called from `LiveApiClient.ingest()` in `frontend/src/services/liveApiClient.ts`
- The ingest call is fire-and-forget (returns 202); the frontend does not consume zone data directly from this endpoint
- Zone geometry and properties arrive via `/api/simulate` → `SimulationResponse.zone_results[].geometry` and `properties`
- Rendered in the map via `ZoneFeatureCollection` → `zones.features` in `SimulationResults`
- Loading/error state: handled by `useSimulation` hook's `jobStatus` and `error` fields

**Data Shape Match:** Yes — `zone_id`, `population`, `elderly_pct`, `disability_pct`, `evacuation_priority_weight`, `centroid_lat/lon` are written to GeoJSON and loaded by `SeedDataLoader`. The frontend receives these via `ZoneResult.properties`.

### Issues Found

- 🟡 UNVALIDATED — The TIGER service uses the `ACS2023` vintage in the URL path but the ACS API call fetches `2022/acs/acs5`. These are different vintages. If TIGER returns GEOIDs from 2023 block groups that don't exist in the 2022 ACS dataset, `acs_data.get(geoid, {})` silently returns empty dicts, producing zones with `population=0`.
- 🟡 UNVALIDATED — No Census API key validation. If `CENSUS_API_KEY` is absent, the ACS call is made without a key. The Census API allows keyless requests but rate-limits them aggressively (500 req/day). No warning is logged when the key is missing.
- 🟡 UNVALIDATED — The bare `except Exception` fallback means any network error, JSON parse error, or key error silently produces synthetic zones. The log message is `WARNING` level only; there is no way for the caller to know real data was not used.

### Open Questions

- ⚪ QUESTION — Does `tigerWMS_ACS2023/MapServer/10` refer to block groups specifically? Layer 10 is assumed to be block groups, but this is not confirmed from the code alone. If it is a different layer (e.g., tracts), the GEOID construction `state+county+tract+block group` would be wrong.

---

## Overpass (Roads/Shelters) — Detailed Findings

**Backend Route:** `backend/data/ingest/roads.py` → `fetch_road_network()` and `backend/data/ingest/shelters.py` → `fetch_shelters()` (called serially from orchestrator)

**Constructed URL:**

```
POST https://overpass-api.de/api/interpreter
  data=[out:json][timeout:60];
  (
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"]
    ({min_lat},{min_lon},{max_lat},{max_lon});
  );
  out body;
  >;
  out skel qt;
```

Shelter query:

```
POST https://overpass-api.de/api/interpreter
  data=[out:json][timeout:30];
  (
    node["amenity"~"^(shelter|community_centre|place_of_worship|school)$"]
      ({min_lat},{min_lon},{max_lat},{max_lon});
    node["emergency"="assembly_point"]
      ({min_lat},{min_lon},{max_lat},{max_lon});
    node["building"="civic"]
      ({min_lat},{min_lon},{max_lat},{max_lon});
  );
  out body;
```

**Error Handling:** Present — `OverpassClient` retries 3× on HTTP 429, raises `IngestError` on other failures. `User-Agent: EvacuAI/1.0` header is set. Rate-limiting between requests is implemented via `_last_duration` tracking.

**Frontend Wiring:**

- Road graph and shelters are written to `road_graph.json` and `shelters.json` in the seed directory
- They are loaded by `SeedDataLoader` and consumed by `EvacuationRouter` during `/api/simulate`
- Shelter list is also exposed via `GET /api/shelters` → `LiveApiClient.getShelters()`
- Frontend renders shelters via `ShelterData[]` type; no explicit shelter rendering component was found in the traced files, but the type is defined in `types/api.ts`

**Data Shape Match:** Yes — `shelter_id`, `name`, `lat`, `lon`, `capacity`, `accessible` match the `ShelterData` interface in `types/api.ts` and the `Shelter` Pydantic schema.

### Issues Found

- 🔴 BROKEN — `fetch_shelters()` raises `IngestError("No shelter locations found...")` if 0 shelters are returned. This is correct behavior, but the orchestrator does **not** catch `IngestError` from `fetch_shelters` — it only catches it from `fetch_road_network`. If a region has no OSM shelter nodes, the entire ingest fails with an unhandled exception in the background task, logged only as `logger.exception(...)`. The frontend receives no error signal (the 202 was already returned).
- 🟡 UNVALIDATED — Shelter coordinate extraction: `el["lat"]` and `el["lon"]` are accessed directly without checking that the element type is `node`. If Overpass returns a `way` or `relation` (which don't have top-level `lat`/`lon`), this raises a `KeyError`. The query only requests `node` types, so this is unlikely but not impossible if the Overpass server returns unexpected elements.

### Open Questions

None — the Overpass QL queries are explicit and the response shape (`elements[].lat/lon/tags`) is standard.

---

## USGS LANDFIRE — Detailed Findings

**Backend Route:** `backend/data/ingest/fuel.py` → `fetch_fuel_grid()` (called from orchestrator batch 1)

**Constructed URLs (exact):**

Submit job:

```
POST https://lfps.usgs.gov/arcgis/rest/services/LandfireProductService/GPServer/LandfireProductService/submitJob
  Layer_List=FBFM40
  Area_of_Interest={"xmin":...,"ymin":...,"xmax":...,"ymax":...,"spatialReference":{"wkid":4326}}
  Output_Format=GeoTIFF
  f=json
```

Poll status:

```
GET https://lfps.usgs.gov/arcgis/rest/services/LandfireProductService/GPServer/LandfireProductService/jobs/{job_id}?f=json
```

Get result:

```
GET https://lfps.usgs.gov/arcgis/rest/services/LandfireProductService/GPServer/LandfireProductService/jobs/{job_id}/results/Output_File?f=json
```

Download TIF: URL from `result["value"]["url"]` (dynamic, from LANDFIRE response)

**Error Handling:** Partial — `resp.raise_for_status()` on submit. Job failure states (`"Failed"`, `"Cancelled"`) are checked. Timeout after 300s. A bare `except Exception` wraps the entire block and falls back to a synthetic random fuel grid. `rasterio` is an optional dependency; if absent, the code immediately falls back to synthetic data without attempting the API call.

**Frontend Wiring:**

- `fuel_grid.npy` is written to the seed directory and loaded by `SeedDataLoader`
- Used by `FireSpreadEngine` during simulation; not directly exposed to the frontend
- The frontend receives fire spread results as `burn_probability_map` and `arrival_time_stats` in `SimulationResults`

**Data Shape Match:** N/A — fuel grid is internal to the simulation engine; not directly surfaced in the API response.

### Issues Found

- 🟡 UNVALIDATED — `rasterio` is listed as an optional dependency. If not installed, the code silently falls back to a synthetic random fuel grid (`_synthetic()`). The log message is `WARNING` level. There is no indication in the API response or seed data that synthetic fuel was used instead of real LANDFIRE data.
- 🟡 UNVALIDATED — The `result["value"]["url"]` extraction assumes a specific response shape from the LANDFIRE GPServer. If the response structure changes (e.g., `result["value"]` is a list), this raises a `TypeError` that is caught by the bare `except` and silently falls back to synthetic data.
- 🟡 UNVALIDATED — The polling loop uses `time.sleep(5)` with no exponential backoff. For large AOIs, LANDFIRE jobs can take several minutes; the 300s timeout may be insufficient.

### Open Questions

- ⚪ QUESTION — Is the LANDFIRE GPServer endpoint (`lfps.usgs.gov/arcgis/rest/services/LandfireProductService/GPServer/LandfireProductService`) still the active production endpoint as of 2025? USGS has migrated some LANDFIRE services. This cannot be confirmed from code alone.

---

## NIFC / WFIGS ArcGIS — Detailed Findings

**Backend Route:** `backend/data/ingest/perimeters.py` → `fetch_perimeters()` (called from orchestrator after batch 1 and 2)

**Constructed URL (exact):**

```
GET https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query
  ?geometry={min_lon},{min_lat},{max_lon},{max_lat}
  &geometryType=esriGeometryEnvelope
  &spatialRel=esriSpatialRelIntersects
  &outFields=*
  &f=geojson
  &outSR=4326
```

**Error Handling:** Present — `resp.raise_for_status()` is called. A bare `except Exception` catches all failures and returns `False` (no perimeter written). This is acceptable since perimeters are optional (`fire_perimeter_file` defaults to `None` in `region_config.json`).

**Frontend Wiring:**

- `fire_perimeter.geojson` is written to the seed directory if perimeters are found
- Referenced in `region_config.json` as `fire_perimeter_file`
- Loaded by `SeedDataLoader` if the file exists
- Not directly surfaced in the current `SimulationResponse` schema; the frontend does not render fire perimeters from this data

**Data Shape Match:** Yes — the ArcGIS REST API returns GeoJSON when `f=geojson` is specified. The response is written directly to disk without transformation.

### Issues Found

None critical. The full service URL is present and correct. All required ArcGIS REST query parameters (`where` is omitted but defaults to `1=1` which returns all features, `outFields=*`, `f=geojson`, `outSR=4326`) are present.

### Open Questions

None.

---

## Nominatim Geocoding — Detailed Findings

**Backend Route:** `backend/data/ingest/region.py` → `_region_name()` (called from `generate_region_config()`, triggered by POST `/api/ingest`)

**Constructed URL:**

```
GET https://nominatim.openstreetmap.org/reverse
  ?lat={lat}
  &lon={lon}
  &format=json
```

**Error Handling:** Partial — a bare `except Exception` catches all failures and returns a fallback string `"{lat:.2f}N, {abs(lon):.2f}W"`. `resp.raise_for_status()` is called. The `User-Agent: EvacuAI/1.0` header is set ✅ (Nominatim usage policy requires this).

**Frontend Wiring:**

- The result is used only to generate the `region_name` field in `region_config.json`
- `region_name` is returned in `SimulationResponse.region_name`
- Displayed in the frontend as a label; no component was found that renders it prominently, but it is available in `SimulationResults` via the backend response

**Data Shape Match:** Yes — `data.get("display_name")` returns a string; the fallback chain `data["address"].get("city") or data["address"].get("county", "")` is reasonable.

### Issues Found

- 🟡 UNVALIDATED — `format=json` is passed as a query parameter ✅, but the code accesses `data["address"]` without checking if the `address` key exists in the response. For some coordinates (e.g., ocean, international), Nominatim may return a response without an `address` key, causing a `KeyError`. This is caught by the bare `except Exception` and falls back gracefully, but the error is silently swallowed.
- 🟡 UNVALIDATED — The bare `except Exception` means HTTP errors, JSON parse errors, and key errors all produce the same fallback. There is no logging of the failure, so it is impossible to diagnose Nominatim issues in production.
- ⚪ QUESTION — Nominatim's usage policy limits requests to 1 per second. The current code has no rate limiting. For bulk ingest operations (multiple regions in quick succession), this could result in HTTP 429 responses that are silently swallowed.
