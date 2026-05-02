# EvacuAI Backend

Wildfire spread simulation and evacuation route optimization backend. Runs Monte Carlo simulations using a simplified Rothermel fire model and computes evacuation routes over a road network.

Owned by Tohar, Vinayak, Leon & Sai

---

## What's Implemented

| Component                                        | Status     | Notes                                                          |
| ------------------------------------------------ | ---------- | -------------------------------------------------------------- |
| Pydantic schemas (`models/schemas.py`)           | ✅ Done    | All request/response models, worldwide lat/lon validation      |
| Fire spread engine (`simulation/fire_spread.py`) | ✅ Done    | Rothermel model, NumPy vectorized, 8-neighbor spread           |
| Seed data files (`data/seed/paradise-ca/`)       | ✅ Done    | Synthetic Paradise, CA dataset                                 |
| Data loader (`data/loader.py`)                   | ✅ Done    | Region-agnostic, validates all required files                  |
| Evacuation router (`evacuation/router.py`)       | ✅ Done    | Dijkstra baseline routing, disconnected graph handling         |
| NWS wind client (`data/wind_client.py`)          | ✅ Done    | Live fetch + fallback + manual override                        |
| Monte Carlo engine (`monte_carlo/engine.py`)     | ✅ Done    | Stochastic sampling, burn probability maps, arrival time stats |
| CLI entry point (`main.py`)                      | 🔲 Stub    | Task 10 — argument parsing done, pipeline not wired            |
| FastAPI app (`api/app.py`, `api/routes.py`)      | 🔲 Stub    | Task 12 — not yet implemented                                  |
| Optimized routing                                | 🔲 Planned | Task 13 — depends on Monte Carlo                               |
| Viability scoring                                | 🔲 Planned | Task 15 — depends on optimized routing                         |

---

## Setup

### Prerequisites

- Python 3.11+
- A virtual environment (`.venv` is already present in the repo)

### Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

pip install -r backend/requirements.txt
```

> **Note:** `pytest` is not in `requirements.txt` yet. Install it separately for now:
>
> ```bash
> pip install pytest pytest-cov hypothesis
> ```

---

## Running the Code

### CLI (stub — pipeline not yet wired)

The CLI parses arguments and prints a summary, but does not yet run the full simulation pipeline (Monte Carlo engine is not implemented).

```bash
python backend/main.py --help

python backend/main.py \
  --lat 39.8103 --lon -121.4377 \
  --wind-speed 14 --wind-dir 225 --humidity 18 \
  --runs 500 \
  --seed-dir backend/data/seed/paradise-ca/ \
  --output results/
```

### Fire Spread Engine (usable directly)

```python
import numpy as np
from backend.data.loader import SeedDataLoader
from backend.simulation.fire_spread import FireSpreadEngine

loader = SeedDataLoader()  # defaults to paradise-ca
data = loader.load_all()

engine = FireSpreadEngine(data.fuel_grid, data.grid_bounds)
result = engine.run(
    ignition_point=(39.8103, -121.4377),
    wind_speed_mph=14.0,
    wind_direction_deg=225.0,
    relative_humidity=18.0,
    max_timesteps=180,
)
print(f"Cells burned: {result.cells_burned}")
print(f"Burn mask shape: {result.burn_mask.shape}")
```

### Data Loader

```python
from backend.data.loader import SeedDataLoader

# Load the bundled Paradise, CA dataset
loader = SeedDataLoader()
data = loader.load_all()

print(data.region_config.region_name)   # "Paradise, CA"
print(data.fuel_grid.shape)             # (50, 50)
print(len(data.zones))                  # 4
print(len(data.shelters))               # 3
print(len(data.scenario_presets))       # 3

# Load a custom region dataset
loader = SeedDataLoader(seed_dir="path/to/my-region/")
data = loader.load_all()
```

### Evacuation Router

```python
from backend.evacuation.router import EvacuationRouter

router = EvacuationRouter(data.road_graph, data.zones, data.shelters)
routes = router.compute_baseline_routes()

for zone_id, result in routes.items():
    print(f"{zone_id} → {result.shelter_id}: {result.total_travel_time:.1f} min")
```

### NWS Wind Client

```python
from backend.data.wind_client import NWSWindClient
from backend.models.schemas import WindConditions

client = NWSWindClient()

# Fetch live wind (US coordinates only; non-US returns fallback)
wind = client.fetch(lat=39.76, lon=-121.62)
print(wind.wind_speed_mph, wind.wind_direction_deg)

# Use manual override (skips API call)
override = WindConditions(wind_speed_mph=20.0, wind_direction_deg=270.0,
                          wind_gust_mph=35.0, relative_humidity=15.0)
wind = client.fetch(lat=39.76, lon=-121.62, override=override)
```

---

## Running Tests

```bash
# From the repo root, with venv activated:
python -m pytest backend/tests/ -q

# With coverage:
python -m pytest backend/tests/ -q --cov=backend --cov-report=term-missing

# Run a specific test file:
python -m pytest backend/tests/test_fire_spread.py -q

# Run a specific test class:
python -m pytest backend/tests/test_loader.py::TestParadiseDataset -q
```

### Current test status

```
92 passed
```

The one failing test (`test_scattered_nonburnable_cells`) has a hardcoded ignition coordinate that randomly lands on a non-burnable cell due to the random fuel grid — it needs a small fix to ensure the ignition cell is burnable before calling `engine.run()`.

### Test coverage by module

| Test file                   | What it covers                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `test_schemas.py`           | All Pydantic models, worldwide lat/lon validation, serialization round-trips                                                       |
| `test_fire_spread.py`       | Spread rate formula, downwind bias, non-burnable invariant, ignition time consistency, lat/lon conversion, edge cases              |
| `test_evacuation_router.py` | Dijkstra correctness, travel time sum, nearest shelter selection, disconnected graphs, no-path handling                            |
| `test_loader.py`            | Paradise dataset loading, configurable seed_dir, missing file errors, malformed data errors                                        |
| `test_monte_carlo.py`       | Deterministic reproducibility, burn probability map correctness, arrival time stats, zone aggregation, road closures, run metadata |

---

## Region Dataset Format

Any region can be simulated by providing a directory with these files:

```
my-region/
├── region_config.json       # region name, bounding box, default ignition point
├── fuel_grid.npy            # float32 array, values 0.0–1.5 (spread rate multipliers)
├── grid_bounds.json         # bounding box + cell resolution metadata
├── road_graph.json          # NetworkX node-link format with travel_time + capacity edges
├── zones.geojson            # census zones with population, elderly_pct, disability_pct
├── shelters.json            # shelter locations with capacity and accessibility
├── scenario_presets.json    # named scenario configurations
└── fire_perimeter.geojson   # optional — filename referenced in region_config.json
```

See `backend/data/seed/paradise-ca/` for a complete example.

---

## Project Structure

```
backend/
├── main.py                  # CLI entry point (stub)
├── requirements.txt
├── simulation/
│   └── fire_spread.py       # Rothermel fire spread engine ✅
├── monte_carlo/
│   └── engine.py            # Monte Carlo orchestrator ✅
├── evacuation/
│   └── router.py            # Baseline Dijkstra routing ✅
├── data/
│   ├── loader.py            # Region dataset loader ✅
│   ├── wind_client.py       # NWS wind API client ✅
│   └── seed/paradise-ca/    # Bundled Paradise, CA dataset ✅
├── api/
│   ├── app.py               # FastAPI app factory 🔲
│   └── routes.py            # API endpoints 🔲
├── models/
│   └── schemas.py           # Pydantic schemas ✅
└── tests/
    ├── test_fire_spread.py
    ├── test_evacuation_router.py
    ├── test_loader.py
    ├── test_monte_carlo.py
    └── test_schemas.py
```

---

## Next Steps (in order)

1. **Task 10** — Wire `backend/main.py` to run the full pipeline end-to-end
2. **Task 12** — Implement FastAPI app and endpoints (`/api/simulate`, `/api/wind`, `/api/scenarios`)
3. **Task 13** — Add optimized cost-function routing to `EvacuationRouter`
4. **Task 15** — Add viability scoring, cutoff times, and evacuation ordering
