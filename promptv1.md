Build a hackathon-winning, submission-ready application called **EvacuAI** for the Cal Poly Kiro hackathon.

---

# Core Requirement: Computation-First Runnable Application

EvacuAI must be a **runnable, computation-first Python application** with a strong scientific and algorithmic core. It must not feel like a frontend-heavy website or a UI mockup with shallow logic.

The project must be built around a **serious simulation and optimization engine** using:

* NumPy
* SciPy
* NetworkX

The interface exists only to **control, visualize, and explain** the computation.

The core idea:

**EvacuAI simulates wildfire spread under uncertainty using Monte Carlo methods and evaluates evacuation route viability before it is too late.**

---

# Hackathon Context

Judging criteria:

* **Implementation (20 pts)** — depth of AI/Kiro usage, technical rigor, thoughtful development strategy
* **Innovation & Design (20 pts)** — originality, clarity, polish
* **Social Good (20 pts)** — real-world impact, scalability, equity

The project must be:

* demo-ready
* stable and runnable
* technically credible
* visually polished enough for a strong demo
* clearly useful in a real-world emergency context

---

# Target User

**First responders and evacuation planners**

Primary task:

> simulate a wildfire spreading under current conditions and evaluate evacuation route viability before it's too late

---

# Core User Flow (MUST be implemented)

1. Select ignition point on map
2. Wind data auto-fetches from NWS (or allow manual override)
3. Set uncertainty parameters
4. Run simulation → **~500 Monte Carlo runs**
5. View:

   * route viability scores
   * zone cutoff times
   * recommended evacuation order
6. Adjust a variable → re-run → compare results

This flow must be fast, clear, and demo-friendly.

---

# System Architecture (STRICT)

## Mandatory Separation for Team Parallelization

This project must enforce a **strict separation between backend and frontend** to support parallel work across 4 team members and avoid git conflicts.

### Backend (Python Engine)

* Lives in `/backend` or `/engine`
* Contains ALL:

  * wildfire simulation
  * Monte Carlo logic
  * evacuation optimization
  * data processing
* Must be runnable independently via:

  * CLI (`python main.py`)
  * or API (FastAPI)

### Frontend / Interface

* Lives in `/frontend`
* Contains ONLY:

  * visualization
  * controls
  * UI
* Must NEVER implement simulation or optimization logic

### Communication Contract

* Interaction via:

  * REST API (FastAPI preferred)
* Define strict schemas (Pydantic)
* Lock schemas early to prevent breaking changes

### Parallel Development Strategy

* Backend team:

  * simulation engine
  * Monte Carlo system
  * optimization algorithms
  * API endpoints
* Frontend team:

  * dashboard
  * map
  * charts
  * UI interactions

Frontend should use **mocked API responses first**, then integrate later.

### Git Conflict Rules

* No shared files between frontend/backend
* No mixing logic layers
* Only shared:

  * API schema definitions
  * docs

---

# Scientific Computing Requirements

You MUST use:

* **NumPy** → grid simulation, vectorized updates
* **SciPy** → probability distributions, sampling, numerical modeling
* **NetworkX** → road graph + routing

Code must demonstrate:

* vectorized operations
* real stochastic modeling
* meaningful cost functions
* clear separation of model and data
* explainable outputs

---

# Simulation Engine (CRITICAL)

## Fire Spread Model

Use a **simplified Rothermel fire spread model** with published USFS coefficients.

Requirements:

* grid-based simulation (NumPy arrays)
* discrete time steps
* probabilistic spread
* wind-influenced propagation
* fuel/dryness influence

Each cell:

* fuel level
* burn state
* ignition time
* spread probability modifier

Spread must:

* favor downwind direction
* vary based on fuel/dryness
* evolve spatially in a believable way

---

## Monte Carlo Engine

Run ~500 simulations per scenario.

Sample:

* wind speed
* wind direction
* spread variability

Wind sampling:

* centered around live NWS values

Outputs (aggregated):

* burn probability map
* arrival time distributions
* **zone cutoff times**
* **route reliability (%)**
* evacuation success probability
* uncertainty ranges

---

## Evacuation Optimization

Road network:

* pre-fetched OpenStreetMap → NetworkX graph

Edges include:

* travel time
* congestion proxy
* fire risk exposure
* closure probability

### Two strategies:

#### Baseline

* shortest path / nearest shelter

#### Optimized

Minimize:
cost = travel_time + congestion + fire_risk + closure_probability

Outputs:

* route viability score (% success across simulations)
* best route per zone
* failure risk

This comparison must be **clear and central**.

---

# Data Sources (IMPORTANT)

Use **real + pre-bundled data** to ensure demo reliability.

### Live Data

* Wind: `api.weather.gov`

  * fetch on load
  * no API key required
  * allow manual override

### Pre-Bundled Data (NO live dependency)

* Road network:

  * OpenStreetMap (Overpass)
  * stored as NetworkX graph
* Fire perimeter seed:

  * NIFC WFIGS (Camp Fire)
  * GeoJSON
* Fuel/dryness:

  * USGS LANDFIRE
  * processed into NumPy grid
* Population/vulnerability:

  * US Census API
  * pre-fetched and stored as zone weights

Constraint:

> Only ONE live API call (wind). Everything else must be local.

---

# Demo Region

Use:
**Paradise, CA (Camp Fire 2018)**

Why:

* real catastrophic case
* documented evacuation failure
* strong storytelling
* real data available

---

# Interface Requirements (Thin but Polished)

The interface must:

* clearly expose the simulation
* visualize outputs
* look premium

Include:

* ignition selection
* wind display
* parameter controls
* run simulation button
* comparison view

Must display:

* fire spread animation
* burn probability heatmap
* route overlays
* route viability %
* zone cutoff times
* evacuation order

---

# Visual Design

Style:

* dark command center
* fire = orange/red
* safe routes = blue/cyan
* clean, minimal, high contrast

The UI must feel:

* serious
* operational
* not flashy or gimmicky

---

# Demo Requirements

3-minute demo must show:

1. ignition point selection
2. live wind fetch
3. Monte Carlo simulation
4. baseline vs optimized routes
5. key metric:

   * “Route A survives in 82% of scenarios”
6. change wind → rerun → different result

---

# Implementation Constraints

Focus on:

* one region
* one strong scenario
* one excellent comparison

---

# Explicitly Exclude (DO NOT BUILD)

* resource allocation systems
* public-facing consumer UI
* multiple disaster types
* real-time external queries beyond wind
* ML / neural models
* overly complex infrastructure

---

# Kiro Requirements

Project must include:

* `.kiro` directory
* specs
* steering docs
* workflows

Must demonstrate:

* spec-driven development (simulation + optimization)
* structured prompting
* intentional Kiro usage

---

# Build Phases

## Phase 1

* wildfire simulation (NumPy)
* Monte Carlo engine
* CLI runnable system

## Phase 2

* road graph + routing
* baseline vs optimized comparison

## Phase 3

* API layer
* interface
* visualization

## Phase 4

* polish
* demo flow
* docs + README + submission assets

---

# Quality Bar

This must NOT be:

* a UI demo with fake math
* a generic dashboard
* a toy simulation

This must be:

* computationally credible
* scientifically grounded
* visually polished
* clearly impactful
* easy to demo
* easy to understand

Judges should think:

> “This team built a real simulation and optimization system, not just a hackathon UI.”

---

# Final Instruction

Begin by generating:

* full architecture
* module breakdown
* simulation model
* Monte Carlo pipeline
* optimization design
* API contract
* frontend/backend boundary
* `.kiro` structure
* build plan for 1-day execution

Then proceed to implementation in phases.

State all assumptions and ask questions.