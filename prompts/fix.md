You are conducting a structured API validation and code review for a wildfire situational
awareness application. Do NOT fix anything yet. Do NOT make assumptions about whether
any API works. Your only job is to read, trace, and report.

---

## STACK CONTEXT

**Backend:** Python FastAPI
**Frontend:** React 19 + TypeScript + Vite 8 + Tailwind v4 + Mapbox GL JS

**Known Good (SKIP):** weather.gov — this API and its wiring are confirmed working.
Do not include it in the report.

---

## YOUR TASK

For each API listed below, perform the following four-step trace in order:

### Step 1 — Backend Route Discovery

- Find the FastAPI route(s) that call this external API
- Record the exact file path, function name, and HTTP method
- Record the full URL being constructed (including query params)
- Note any request headers, auth tokens, or timeouts being set

### Step 2 — Request Validation

- Does the URL match the real external API's documented endpoint?
- Are required parameters present and correctly formatted?
- Is error handling present? (try/except, status code checks, fallback behavior)
- Is there any response validation before data is returned to the frontend?

### Step 3 — Frontend Wiring Trace

- Find where this API's data is fetched from the FastAPI backend in the React codebase
- Trace: which component triggers the call → what hook or function handles it →
  where the response is stored (state/context) → where it is rendered
- Is there a loading state? An error state? What happens if the response is null or malformed?
- Is the data shape the backend returns what the frontend actually expects?

### Step 4 — Issue Classification

For every problem found, classify it as one of:

- 🔴 BROKEN — call will fail or already is failing
- 🟡 UNVALIDATED — call may work but has no confirmation or error handling
- 🟠 MISMATCH — backend and frontend disagree on data shape or field names
- ⚪ QUESTION — something cannot be determined from code alone; state the question explicitly

---

## APIs TO REVIEW

### API 2 — US Census API / TIGER Web

Purpose: Population block groups and demographics around a fire impact point
Base URL: https://api.census.gov or https://tigerweb.geo.census.gov
Validity: UNKNOWN — treat as unvalidated until proven otherwise
Special instruction: Confirm which Census dataset and vintage year is being queried.
Confirm TIGER layer name and geometry format returned.

---

### API 3 — OpenStreetMap Overpass API

Purpose: Roads and shelters
Base URL: https://overpass-api.de/api/interpreter
⚠️ CRITICAL INSTRUCTION: Do NOT assume this API is wired correctly or returns shelter data.
Trace the exact Overpass QL query being sent. If you cannot confirm what query is being
sent or what the response shape is, DO NOT guess — write an explicit question instead.
Flag anything about shelter coordinate extraction as a high-priority item.

---

### API 4 — USGS LANDFIRE Product Service

Purpose: Fuel grid / vegetation fire fuel model
Base URL: https://lfps.usgs.gov/
Note: The exact endpoint path is partial (/LandfireProductService).
Find the full constructed URL in the backend code and record it exactly.
If you cannot find the full URL, flag it as 🔴 BROKEN — incomplete endpoint.

---

### API 5 — NIFC / WFIGS ArcGIS REST API

Purpose: Fire perimeter data
Base URL: https://services3.arcgis.com/.../WFIGS_Interagency_Perimeters
Note: The full service URL path is unknown from context.
Find it in the backend code. If it uses a wildcard or incomplete path, flag as 🔴 BROKEN.
Check if the correct ArcGIS REST query parameters are present
(where clause, outFields, f=geojson, etc.)

---

### API 6 — Nominatim / OpenStreetMap Reverse Geocoding

Purpose: Region name from lat/lon
Base URL: https://nominatim.openstreetmap.org/reverse
Check: Is the required User-Agent header being set?
Nominatim's usage policy requires it — absence will cause silent failures or rate limiting.
Check: Is the format param set to json? Is lat/lon being passed correctly?

---

## OUTPUT FORMAT

Produce a single markdown file structured exactly as follows:

# Kirohacks API Validation Report

## Summary Table

| API                       | Status | Critical Issues | Questions |
| ------------------------- | ------ | --------------- | --------- |
| US Census / TIGER         | ...    | ...             | ...       |
| Overpass (Roads/Shelters) | ...    | ...             | ...       |
| USGS LANDFIRE             | ...    | ...             | ...       |
| NIFC / WFIGS ArcGIS       | ...    | ...             | ...       |
| Nominatim Geocoding       | ...    | ...             | ...       |

---

## [API Name] — Detailed Findings

**Backend Route:** `file/path.py` → `function_name()` (GET/POST)
**Constructed URL:** (exact URL with params)
**Error Handling:** Present / Missing / Partial
**Frontend Wiring:** Component → hook → state → render location
**Data Shape Match:** Yes / No / Unknown

### Issues Found

(one entry per issue, classified with emoji)

### Open Questions

(explicit questions that cannot be answered from code alone)

---

Repeat the Detailed Findings section for each API.
Do not combine APIs. Do not skip sections.
If a section cannot be filled in, write "NOT FOUND IN CODEBASE" and flag as 🔴.
