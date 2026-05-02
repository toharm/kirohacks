# Requirements Document

## Introduction

EvacuAI Frontend is a dark-themed command-center interface for first responders and evacuation planners to control, visualize, and interpret wildfire spread simulations and evacuation route optimization. The frontend consumes the EvacuAI FastAPI backend exclusively via REST API, renders geospatial data on an interactive map, and presents Monte Carlo simulation results through purpose-built data visualizations. It lives entirely in `/frontend`, contains zero simulation logic, and communicates through strict Pydantic-validated API schemas.

The interface must feel serious, operational, and scientifically credible — not flashy or gimmicky. It exists to expose the computation, not to replace it.

**Skills Reference:** design-ui-designer (visual design system, component library, dark theme), design-ux-researcher (user flow validation, first-responder task analysis), design-ux-architect (CSS architecture, layout framework, responsive strategy).

**API Contract Reference:** #[[file:prompts/dataspec.md]]
**Backend Spec Reference:** #[[file:.kiro/specs/evacuai-backend-prototype/requirements.md]]

## Glossary

- **Command_Center**: The primary full-screen dashboard layout with map, controls panel, and results panels arranged for operational decision-making.
- **Map_View**: The interactive Mapbox GL JS or Leaflet map component centered on the Paradise, CA demo region, supporting layer toggling, click-to-ignite, and animated overlays.
- **Control_Panel**: The left-side collapsible panel containing ignition selection, wind parameters, scenario presets, uncertainty settings, and the simulation run button.
- **Results_Panel**: The right-side panel displaying simulation outputs: zone evacuation table, route comparison cards, and aggregate metrics.
- **Burn_Heatmap_Layer**: A map overlay rendering the Burn_Probability_Map as a continuous color gradient from transparent (0.0) through yellow/orange to deep red (1.0).
- **Route_Overlay_Layer**: Map polylines showing evacuation routes colored by viability score — cyan/blue for high viability, orange/red for low viability.
- **Zone_Choropleth_Layer**: Map polygons showing census block groups colored by evacuation priority score and cutoff time urgency.
- **Wind_Rose**: A compact directional indicator showing current wind speed, direction, and gust values with a visual compass rose.
- **Simulation_Progress**: A progress indicator showing Monte Carlo run completion (e.g., "342 / 500 runs") with estimated time remaining.
- **Comparison_View**: A split or tabbed view showing baseline vs. optimized evacuation strategy metrics side-by-side for the same scenario.
- **Scenario_Selector**: A dropdown or card-based selector for pre-configured scenario presets (Fast Wind Shift, Night Evacuation, School Zone).
- **Metric_Card**: A compact display component showing a single key metric with label, value, unit, and optional trend/confidence indicator.
- **Toast_Notification**: A transient notification for system events (wind fetch complete, simulation started, API error fallback).
- **Mock_API_Client**: A frontend service layer that can switch between live backend API calls and local mock JSON responses for parallel development.

## Requirements

### Requirement 1: Command Center Layout

**User Story:** As an evacuation planner, I want a full-screen operational dashboard with map, controls, and results visible simultaneously, so that I can make decisions without switching between views.

#### Acceptance Criteria

1. THE Command_Center SHALL render as a full-viewport dark-themed layout with three primary regions: Control_Panel (left, 320px default width, collapsible), Map_View (center, fills remaining space), and Results_Panel (right, 380px default width, collapsible).
2. THE Command_Center SHALL use CSS custom properties for all colors, spacing, and typography to enable consistent theming across all components.
3. THE layout SHALL be responsive: on viewports below 1024px, the Control_Panel and Results_Panel SHALL collapse to overlay drawers accessible via toggle buttons on the map edges.
4. THE Command_Center SHALL include a top header bar (48px height) displaying the EvacuAI logo/wordmark, current scenario name, simulation status indicator, and a compact Wind_Rose showing live wind conditions.
5. THE Command_Center SHALL maintain a minimum color contrast ratio of 4.5:1 for all text against background surfaces per WCAG AA.
6. ALL interactive elements SHALL have visible focus indicators for keyboard navigation and meet a minimum touch target size of 44×44px.

### Requirement 2: Interactive Map with Geospatial Layers

**User Story:** As an evacuation planner, I want an interactive map of the Paradise, CA region with toggleable data layers, so that I can visualize fire spread, routes, and zones spatially.

#### Acceptance Criteria

1. THE Map_View SHALL render an interactive map using Mapbox GL JS (with free tier token) or Leaflet with a dark basemap style, centered on the Paradise, CA demo region (39.7596°N, -121.6219°W) at zoom level 12.
2. THE Map_View SHALL support click-to-select ignition point, placing a pulsing marker at the clicked coordinates and populating the Control_Panel ignition fields with the selected lat/lon.
3. THE Map_View SHALL render the Burn_Heatmap_Layer as a WebGL-accelerated raster overlay using a sequential color ramp: transparent (0.0) → yellow (0.3) → orange (0.6) → red (0.8) → deep crimson (1.0), with an opacity slider control.
4. THE Map_View SHALL render the Route_Overlay_Layer as polylines with color encoding viability score: cyan (#00E5FF) for scores above 80%, yellow (#FFD600) for 50–80%, and red (#FF1744) for below 50%, with line width proportional to road capacity.
5. THE Map_View SHALL render the Zone_Choropleth_Layer as semi-transparent polygons with fill color encoding evacuation urgency: green (cutoff > 30 min) → yellow (15–30 min) → orange (5–15 min) → red (< 5 min).
6. THE Map_View SHALL provide a layer toggle control allowing the user to independently show/hide the Burn_Heatmap_Layer, Route_Overlay_Layer, Zone_Choropleth_Layer, shelter markers, and the Camp Fire perimeter outline.
7. THE Map_View SHALL render shelter locations as distinct markers with capacity labels and accessibility icons.
8. WHEN the user hovers over a zone polygon, THE Map_View SHALL display a tooltip showing zone_id, population, cutoff_time, evacuation_priority_score, and failure_risk_percentage.

### Requirement 3: Simulation Control Panel

**User Story:** As an evacuation planner, I want to configure simulation parameters and launch Monte Carlo runs from a clear control interface, so that I can test different scenarios quickly.

#### Acceptance Criteria

1. THE Control_Panel SHALL display an ignition point section showing the selected lat/lon coordinates with a "Select on Map" button that activates click-to-ignite mode on the Map_View.
2. THE Control_Panel SHALL display a wind parameters section with numeric inputs for wind speed (mph), wind direction (degrees), wind gust (mph), and relative humidity (%), pre-populated with values fetched from the `GET /api/wind` endpoint.
3. THE Control_Panel SHALL include a "Fetch Live Wind" button that calls `GET /api/wind?lat={lat}&lon={lon}` and populates the wind fields with the response, showing a Toast_Notification on success or fallback.
4. THE Control_Panel SHALL include a Scenario_Selector populated from the `GET /api/scenarios` endpoint, where selecting a preset auto-fills the ignition point and wind parameters with the preset values.
5. THE Control_Panel SHALL include a Monte Carlo runs slider (range: 50–1000, default: 500, step: 50) with a numeric display of the selected value.
6. THE Control_Panel SHALL include a prominent "Run Simulation" button that submits a `POST /api/simulate` request with the configured parameters and transitions to a loading/progress state.
7. WHEN a simulation is running, THE Control_Panel SHALL disable the "Run Simulation" button and display a Simulation_Progress indicator showing completed runs out of total, updated by polling `GET /api/results/{job_id}` until status is no longer 202.
8. ALL numeric inputs SHALL validate ranges client-side: wind speed 0–100 mph, direction 0–360°, gust 0–150 mph, humidity 0–100%.

### Requirement 4: Results Display and Route Comparison

**User Story:** As an evacuation planner, I want to see simulation results with a clear comparison between baseline and optimized evacuation strategies, so that I can recommend the safest approach.

#### Acceptance Criteria

1. THE Results_Panel SHALL display a Comparison_View with two columns: "Baseline (Shortest Path)" and "Optimized (Multi-Factor)", each showing aggregate metrics including average Route_Viability_Score, average evacuation time, and overall failure risk percentage.
2. THE Results_Panel SHALL display a sortable zone evacuation table with columns: Zone ID, Population, Cutoff Time, Priority Score, Baseline Viability %, Optimized Viability %, Failure Risk %, and a status indicator (safe/warning/critical based on cutoff time).
3. THE Results_Panel SHALL highlight the key demo metric prominently: "Route [name] survives in [X]% of scenarios" as a large-format Metric_Card at the top of the panel.
4. THE Results_Panel SHALL display per-zone route cards showing the best baseline route and best optimized route with their respective viability scores, travel times, and a "Show on Map" button that highlights the route on the Map_View.
5. WHEN the user clicks a zone row in the evacuation table, THE Map_View SHALL zoom to that zone, highlight its polygon, and display its baseline and optimized routes.
6. THE Results_Panel SHALL display an evacuation ordering list showing zones sorted by descending priority score with visual urgency indicators (red/orange/yellow/green badges).
7. THE Results_Panel SHALL include a summary statistics section showing: total population at risk, number of zones with cutoff < 10 minutes, percentage improvement from baseline to optimized strategy, and Monte Carlo confidence interval.

### Requirement 5: Fire Spread Visualization and Animation

**User Story:** As an evacuation planner, I want to see fire spread animated over time on the map, so that I can understand the temporal progression and urgency of the threat.

#### Acceptance Criteria

1. THE Map_View SHALL support an animated fire spread mode that steps through simulation timesteps, rendering the mean arrival time grid as an expanding fire front on the map.
2. THE animation SHALL include a timeline scrubber control (range: t=0 to t=max_timestep) with play/pause, step forward, step backward, and playback speed controls (0.5×, 1×, 2×, 4×).
3. DURING animation playback, THE Map_View SHALL update the fire front overlay at each timestep, showing newly ignited cells in bright orange transitioning to dark red for fully burned cells.
4. DURING animation playback, THE Results_Panel SHALL update zone status indicators in real-time to show which zones have passed their cutoff time at the current animation timestep.
5. THE animation timeline SHALL display markers at each zone's cutoff time, labeled with the zone ID, so the user can see when evacuation windows close.
6. THE animation SHALL render at a minimum of 15 frames per second for smooth visual playback on the target grid resolution.

### Requirement 6: Wind Display and Override

**User Story:** As an evacuation planner, I want to see current wind conditions clearly and override them for what-if analysis, so that I can test how different wind scenarios affect evacuation viability.

#### Acceptance Criteria

1. THE header bar SHALL display a compact Wind_Rose component showing wind direction as a rotated arrow, wind speed in mph, gust speed, and relative humidity as numeric labels.
2. THE Wind_Rose SHALL update immediately when the user modifies wind parameters in the Control_Panel or when live wind data is fetched.
3. THE Control_Panel wind section SHALL include a toggle between "Live (NWS)" and "Manual Override" modes, where Live mode auto-fetches and disables manual editing, and Manual mode enables all wind input fields.
4. WHEN the user changes any wind parameter and re-runs the simulation, THE Results_Panel SHALL clearly indicate that results reflect the modified wind conditions with a visible "Modified Wind" badge.

### Requirement 7: API Integration and Mock Data Support

**User Story:** As a frontend developer, I want to develop against mock API responses before the backend is ready, so that frontend and backend teams can work in parallel.

#### Acceptance Criteria

1. THE frontend SHALL implement a Mock_API_Client service that returns realistic mock JSON responses matching the exact Pydantic schemas defined in the backend spec for all four endpoints: `POST /api/simulate`, `GET /api/results/{job_id}`, `GET /api/wind`, and `GET /api/scenarios`.
2. THE frontend SHALL support switching between mock and live API modes via an environment variable (`VITE_API_MODE=mock|live`) without code changes.
3. THE Mock_API_Client SHALL simulate realistic response timing: 100ms for wind and scenarios, 2–5 seconds (with progress polling) for simulation results.
4. THE live API client SHALL handle HTTP 422 validation errors by displaying field-level error messages in the Control_Panel.
5. THE live API client SHALL handle HTTP 202 (simulation in progress) by continuing to poll `GET /api/results/{job_id}` at 1-second intervals until receiving HTTP 200 with complete results.
6. THE live API client SHALL handle network errors and timeouts gracefully with Toast_Notifications and retry options.

### Requirement 8: Visual Design System

**User Story:** As a demo presenter, I want the interface to look premium and operational, so that judges and viewers take the application seriously.

#### Acceptance Criteria

1. THE design system SHALL use a dark command-center palette: background surfaces (#0A0E17, #111827, #1F2937), text (white #F9FAFB, muted #9CA3AF), and accent colors for data encoding (fire: #FF6B35 → #DC2626, safe routes: #00E5FF → #06B6D4, warning: #F59E0B, critical: #EF4444, success: #10B981).
2. THE design system SHALL use Inter as the primary UI font and JetBrains Mono as the monospace font for numeric data, coordinates, and metric values.
3. ALL Metric_Cards SHALL use a consistent format: label (12px, muted), value (24–32px, bold, white or semantic color), unit (14px, muted), with a subtle dark card background (#1F2937) and 1px border (#374151).
4. THE design system SHALL define a 4px base spacing grid with scale: 4, 8, 12, 16, 24, 32, 48, 64px.
5. ALL map overlays SHALL use semi-transparent fills (opacity 0.3–0.7) to maintain basemap readability beneath data layers.
6. THE interface SHALL include subtle CSS transitions (150–300ms ease) on panel collapses, button states, and layer toggles for a polished feel.
7. THE design system SHALL be implemented as CSS custom properties in a single `design-tokens.css` file importable by all components.

### Requirement 9: Technology Stack and Project Structure

**User Story:** As a team member, I want a clear frontend project structure with modern tooling, so that multiple developers can work in parallel without conflicts.

#### Acceptance Criteria

1. THE frontend SHALL be built with React 18+ and TypeScript in strict mode, using Vite as the build tool.
2. THE frontend SHALL organize code under `/frontend/src/` with directories: `components/` (UI components), `features/` (feature modules: map, controls, results), `services/` (API client, mock client), `hooks/` (custom React hooks), `types/` (TypeScript interfaces matching backend Pydantic schemas), `styles/` (design tokens and global styles), and `assets/` (static assets).
3. THE frontend SHALL use a lightweight state management approach (React Context + useReducer or Zustand) for simulation state, avoiding heavy frameworks.
4. THE frontend SHALL use Deck.gl or Mapbox GL JS for high-performance WebGL map rendering with large raster overlays.
5. THE frontend SHALL include a `types/api.ts` file defining TypeScript interfaces that mirror every Pydantic request/response schema from the backend, serving as the single source of truth for API contracts on the frontend side.
6. THE frontend SHALL NOT contain any simulation logic, mathematical models, or data processing beyond what is needed for visualization (color mapping, coordinate transforms, sorting).

### Requirement 10: Demo Flow and Presentation Mode

**User Story:** As a demo presenter, I want a guided demo flow that showcases the full simulation pipeline in under 3 minutes, so that the hackathon presentation is smooth and compelling.

#### Acceptance Criteria

1. THE frontend SHALL include a "Demo Mode" toggle (accessible via keyboard shortcut Ctrl+D) that pre-loads the Camp Fire scenario with default parameters and auto-fetches wind data on activation.
2. IN Demo Mode, THE Control_Panel SHALL display a step indicator showing the demo flow: (1) Select Ignition → (2) Fetch Wind → (3) Run Simulation → (4) Compare Routes → (5) Adjust & Re-run.
3. THE frontend SHALL support a "Quick Compare" action that re-runs the simulation with a single parameter change (e.g., wind direction +45°) and displays results side-by-side with the previous run.
4. THE frontend SHALL pre-load the Camp Fire perimeter outline on the map at startup as a reference layer, even before any simulation is run.
5. THE frontend SHALL display a loading state during simulation that feels purposeful: showing a progress bar with run count, elapsed time, and a subtle fire-spread preview animation rather than a generic spinner.
