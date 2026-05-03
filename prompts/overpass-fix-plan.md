# Overpass API — Error Handling Fix Plan

## Alternatives Assessment

There are **no free drop-in alternatives** to the public Overpass API for querying OSM roads and shelters by bounding box. The options considered:

| Alternative | Viable? | Why not |
|---|---|---|
| Self-hosted Overpass | Possible but heavy | Requires 50GB+ disk, Docker setup, ongoing maintenance |
| Geofabrik extracts + osmium | Offline only | Not an API; requires downloading regional PBF files and local processing |
| ohsome API | Different purpose | Focused on historical OSM analysis, different query syntax, not a 1:1 replacement |
| Native OSM API | Too limited | 0.6 req/s rate limit, no spatial bbox filtering, returns raw XML |
| Overpass Ultra | Same backend | Just a different frontend for the same Overpass API |

**Conclusion:** Stick with `overpass-api.de`. The public instance allows ~10,000 queries/day with no API key. The existing `OverpassClient` already implements rate-limiting and retry logic. The problems are in error propagation, not the API choice.

---

## Problems Found

### Problem 1 — Shelter coordinate extraction has no type guard

**File:** `backend/data/ingest/shelters.py`, line ~55  
**Severity:** 🟡 Latent bug

```python
for el in data.get("elements", []):
    tags = el.get("tags", {})
    lat, lon = el["lat"], el["lon"]  # ← KeyError if el is a way/relation
```

The Overpass query only requests `node` elements, so `el["lat"]` and `el["lon"]` should always exist. However, if the query is ever changed to include `way` or `relation` types, or if Overpass returns unexpected element types, this will raise a `KeyError` that propagates as an unhandled exception.

**Fix:** Add a type check before accessing coordinates:

```python
for el in data.get("elements", []):
    if el.get("type") != "node":
        continue
    tags = el.get("tags", {})
    lat, lon = el["lat"], el["lon"]
```

### Problem 2 — Ingest failures are invisible to the frontend

**File:** `backend/api/routes.py`, `/api/ingest` endpoint  
**Severity:** 🔴 Broken UX

The `/api/ingest` endpoint returns HTTP 202 immediately, then runs `generate_seed_data()` in a background task. The `_run()` closure catches `IngestError` and logs it, but there is **no mechanism** for the frontend to discover whether the ingest succeeded or failed.

Current flow:
```
Frontend → POST /api/ingest → 202 {"status": "generating"}
                                    ↓ (background)
                              generate_seed_data() → success or IngestError
                                    ↓
                              logger.info() or logger.exception()
                                    ↓
                              (nothing returned to frontend)
```

The response says "Poll GET /api/regions for completion" but:
- If ingest fails, the region never appears in `/api/regions` — the frontend polls forever
- There's no error message, no failure status, no way to distinguish "still running" from "failed"

**Fix:** Add an in-memory ingest status store and a polling endpoint:

```python
# In routes.py — add a simple status dict
_ingest_jobs: dict[str, dict] = {}

@router.post("/ingest", status_code=202)
def ingest_region(req: IngestRequest, background_tasks: BackgroundTasks):
    job_id = f"{req.lat:.4f},{req.lon:.4f}"
    _ingest_jobs[job_id] = {"status": "running", "error": None}

    def _run():
        try:
            generate_seed_data(...)
            _ingest_jobs[job_id] = {"status": "complete", "error": None}
        except IngestError as e:
            _ingest_jobs[job_id] = {"status": "failed", "error": str(e)}

    background_tasks.add_task(_run)
    return {"status": "running", "job_id": job_id}

@router.get("/ingest/status")
def ingest_status(job_id: str):
    job = _ingest_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    return job
```

### Problem 3 — Orchestrator error propagation is actually fine

After reading the code carefully, the orchestrator **does** propagate `IngestError` correctly:

1. `fetch_road_network()` and `fetch_shelters()` raise `IngestError` on failure
2. These propagate up through `generate_seed_data()` (no try/except around them)
3. The `_run()` closure in `routes.py` catches `IngestError` and logs it

The error chain works. The only issue is that the caught error goes nowhere useful (just to the log). This is addressed by Problem 2's fix.

---

## Task List

| # | Task | File(s) | Status |
|---|---|---|---|
| 1 | Add `if el.get("type") != "node": continue` guard in shelter extraction loop | `backend/data/ingest/shelters.py` | TODO |
| 2 | Add `_ingest_jobs` dict and update `_run()` to track success/failure | `backend/api/routes.py` | TODO |
| 3 | Add `GET /api/ingest/status?job_id=...` polling endpoint | `backend/api/routes.py` | TODO |
| 4 | Add `ingestStatus()` method to `LiveApiClient` | `frontend/src/services/liveApiClient.ts` | TODO |
| 5 | Update `ingest()` in `LiveApiClient` to return `job_id` and poll status | `frontend/src/services/liveApiClient.ts` | TODO |

---

## Non-issues (confirmed working)

- **OverpassClient rate limiting** — Implemented via `_last_duration` tracking and `threading.Lock`. Retries 3× on HTTP 429 with exponential backoff.
- **User-Agent header** — Set to `EvacuAI/1.0` on all Overpass requests.
- **Overpass query correctness** — Road query filters by highway type correctly. Shelter query targets `node` elements with appropriate amenity/emergency/building tags.
- **Error propagation chain** — `IngestError` flows from Overpass → roads/shelters → orchestrator → routes.py `_run()` correctly.
