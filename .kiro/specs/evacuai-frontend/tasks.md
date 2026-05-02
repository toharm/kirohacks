# Implementation Tasks

## Task 1: Project Scaffolding and Design Token System
- [ ] Initialize Vite + React + TypeScript project in `/frontend` with `npm create vite@latest frontend -- --template react-ts`
- [ ] Configure `tsconfig.json` with `strict: true`, path aliases (`@/` → `src/`)
- [ ] Install core dependencies: `deck.gl`, `@deck.gl/react`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `mapbox-gl`, `react-map-gl`
- [ ] Create `src/styles/design-tokens.css` with all CSS custom properties from the design doc (surfaces, text, fire spectrum, evacuation colors, typography, spacing, layout, shadows, transitions, z-index)
- [ ] Create `src/styles/reset.css` with minimal CSS reset (box-sizing, margin, padding)
- [ ] Create `src/styles/global.css` with body styles (dark background, font-family, scrollbar styling)
- [ ] Create `src/styles/animations.css` with keyframe animations (pulse for ignition marker, fade-in for panels, glow for active fire)
- [ ] Create `.env.example` with `VITE_API_MODE=mock`, `VITE_API_BASE_URL=http://localhost:8000`, `VITE_MAPBOX_TOKEN=`
- [ ] Verify the dev server starts and renders a dark background with the design token system applied

## Task 2: TypeScript API Types and Service Layer
- [ ] Create `src/types/api.ts` with all TypeScript interfaces mirroring backend Pydantic schemas: `SimulateRequest`, `SimulateResponse`, `SimulationProgress`, `GridBounds`, `BurnProbabilityMap`, `ArrivalTimeStats`, `RouteSegment`, `EvacuationRoute`, `ZoneResult`, `SimulationResults`, `WindData`, `ScenarioPreset`
- [ ] Create `src/services/api.ts` defining the `EvacuAIApi` interface with methods: `simulate()`, `getResults()`, `getWind()`, `getScenarios()`, and a factory function that returns `MockApiClient` or `LiveApiClient` based on `VITE_API_MODE`
- [ ] Create `src/services/liveApiClient.ts` implementing `EvacuAIApi` with fetch-based HTTP calls to the backend, including error handling for 422, 202, and network errors
- [ ] Create `src/services/mockApiClient.ts` implementing `EvacuAIApi` with realistic mock data and simulated delays (100ms for wind/scenarios, 3s with progress callbacks for simulation)
- [ ] Create `src/assets/mock/simulationResults.json` with realistic mock simulation output for the Paradise, CA region
- [ ] Create `src/assets/mock/windData.json` with mock NWS wind response
- [ ] Create `src/assets/mock/scenarios.json` with three scenario presets (Fast Wind Shift, Night Evacuation, School Zone)

## Task 3: State Management (SimulationContext)
- [ ] Create `src/context/simulationReducer.ts` defining `SimulationState` interface, action types (`SET_IGNITION`, `SET_WIND`, `SET_SCENARIO`, `SET_MC_RUNS`, `SUBMIT_SIMULATION`, `UPDATE_PROGRESS`, `SET_RESULTS`, `SET_ERROR`, `TOGGLE_DEMO_MODE`, `SET_DEMO_STEP`, `SELECT_ZONE`, `SET_ANIMATION_TIMESTEP`, `TOGGLE_LAYER`, `TOGGLE_ANIMATION`, `STORE_PREVIOUS_RESULTS`), and reducer function
- [ ] Create `src/context/SimulationContext.tsx` with React Context, Provider component wrapping useReducer, and initial state (idle, no results, default wind, all layers visible)
- [ ] Create `src/hooks/useSimulation.ts` custom hook that consumes SimulationContext and exposes typed dispatch helpers and state selectors
- [ ] Create `src/hooks/usePolling.ts` generic polling hook that calls a function at intervals, handles cleanup, and supports stop conditions
- [ ] Create `src/hooks/useKeyboardShortcuts.ts` for Ctrl+D (toggle demo mode) and other shortcuts
- [ ] Wire `SimulationProvider` into `App.tsx` wrapping the entire component tree

## Task 4: Command Center Layout Shell
- [ ] Create `src/App.tsx` rendering `SimulationProvider` → `CommandCenter` → `ToastContainer`
- [ ] Create `src/components/CommandCenter.tsx` as the full-viewport flex layout with HeaderBar, MainContent (flex row), and responsive behavior
- [ ] Create `src/components/HeaderBar.tsx` with logo/wordmark, scenario label, SimulationStatus, and WindRose placeholder — 48px height, dark surface background
- [ ] Create `src/components/SimulationStatus.tsx` showing job status with colored dot indicator (gray=idle, blue=running, green=complete, red=error) and progress text
- [ ] Create stub `src/features/controls/ControlPanel.tsx` as left sidebar (320px, collapsible) with placeholder sections
- [ ] Create stub `src/features/map/MapView.tsx` as center flex-grow area with dark placeholder
- [ ] Create stub `src/features/results/ResultsPanel.tsx` as right sidebar (380px, collapsible) with placeholder sections
- [ ] Implement responsive collapse behavior: panels become overlay drawers below 1024px with toggle buttons
- [ ] Verify the 3-column layout renders correctly at desktop and tablet breakpoints

## Task 5: Interactive Map with Base Layers
- [ ] Implement `src/features/map/MapView.tsx` with Deck.gl + react-map-gl, dark basemap style, centered on Paradise CA (39.7596, -121.6219, zoom 12)
- [ ] Implement click-to-ignite: on map click, dispatch `SET_IGNITION` with lat/lon, render pulsing marker at click point
- [ ] Create `src/features/map/IgnitionMarker.tsx` as a Deck.gl `ScatterplotLayer` with CSS pulse animation
- [ ] Create `src/features/map/PerimeterOutline.tsx` rendering Camp Fire perimeter as a `GeoJsonLayer` with dashed orange outline (loaded from mock data or API)
- [ ] Create `src/features/map/ShelterMarkers.tsx` rendering shelter locations as `IconLayer` with capacity labels
- [ ] Create `src/features/map/LayerToggle.tsx` as a floating control panel on the map with checkboxes for each layer (burn heatmap, routes, zones, shelters, perimeter)
- [ ] Wire layer visibility toggles to SimulationContext `visibleLayers` state

## Task 6: Control Panel — Full Implementation
- [ ] Implement `src/features/controls/IgnitionSection.tsx` showing selected lat/lon (JetBrains Mono), "Select on Map" button that activates click mode, clear button
- [ ] Implement `src/features/controls/WindSection.tsx` with numeric inputs for speed, direction, gust, humidity, "Fetch Live Wind" button, and Live/Manual toggle
- [ ] Wire "Fetch Live Wind" to `api.getWind()`, populate fields on success, show toast on fallback
- [ ] Implement `src/features/controls/ScenarioSelector.tsx` fetching presets from `api.getScenarios()`, rendering as cards or dropdown, auto-filling parameters on selection
- [ ] Implement `src/features/controls/MonteCarloSlider.tsx` as a range input (50–1000, step 50, default 500) with numeric display
- [ ] Implement `src/features/controls/RunButton.tsx` as a prominent button that submits simulation, disables during run, shows progress bar overlay during execution
- [ ] Implement client-side validation: wind speed 0–100, direction 0–360, gust 0–150, humidity 0–100, ignition point required
- [ ] Wire RunButton to dispatch `SUBMIT_SIMULATION`, call `api.simulate()`, start polling with `usePolling`, dispatch `UPDATE_PROGRESS` and `SET_RESULTS`

## Task 7: Burn Heatmap and Fire Animation
- [ ] Implement `src/features/map/BurnHeatmapLayer.tsx` as a Deck.gl `HeatmapLayer` or `BitmapLayer` rendering the burn probability grid with the fire color ramp (transparent → yellow → orange → red → dark red)
- [ ] Add opacity slider control for the burn heatmap layer
- [ ] Implement `src/features/map/AnimationTimeline.tsx` with play/pause button, timeline scrubber (t=0 to t=max), step forward/backward buttons, and speed controls (0.5×, 1×, 2×, 4×)
- [ ] Implement fire spread animation: use arrival time mean grid, filter cells where `arrival_time <= currentTimestep`, color by time-since-ignition (bright orange → dark red)
- [ ] Add cutoff time markers on the timeline labeled with zone IDs
- [ ] Implement `prefers-reduced-motion` check: if enabled, show static burn probability heatmap instead of animation
- [ ] Verify animation runs at ≥15 FPS on the target grid resolution

## Task 8: Route and Zone Visualization Layers
- [ ] Implement `src/features/map/RouteOverlayLayer.tsx` as Deck.gl `PathLayer` rendering evacuation routes colored by viability score (cyan >80%, yellow 50–80%, red <50%), line width proportional to capacity
- [ ] Implement `src/features/map/ZoneChoroplethLayer.tsx` as Deck.gl `GeoJsonLayer` rendering zone polygons with fill color by cutoff urgency (green >30min, yellow 15–30, orange 5–15, red <5)
- [ ] Implement zone hover tooltip showing zone_id, population, cutoff_time, priority_score, failure_risk
- [ ] Implement zone click: dispatch `SELECT_ZONE`, zoom map to zone bounds, highlight polygon, show baseline + optimized routes for that zone
- [ ] Differentiate baseline routes (dashed line) from optimized routes (solid line) visually

## Task 9: Results Panel — Metrics and Comparison
- [ ] Implement `src/components/MetricCard.tsx` with label (12px muted uppercase), value (32px bold semantic color), unit (14px muted), optional delta indicator, dark card background
- [ ] Implement `src/features/results/ResultsPanel.tsx` layout with scrollable content area
- [ ] Implement key metric card at top: "Route [name] survives in [X]% of scenarios" using the highest-viability optimized route
- [ ] Implement `src/features/results/ComparisonView.tsx` with two columns (Baseline / Optimized) showing avg viability, avg evac time, overall failure risk, with improvement percentage highlighted
- [ ] Implement `src/features/results/ZoneEvacuationTable.tsx` as a sortable table with columns: Zone ID, Population, Cutoff Time, Priority Score, Baseline Viability %, Optimized Viability %, Failure Risk %, Status badge
- [ ] Implement table row click → dispatch `SELECT_ZONE` to highlight zone on map
- [ ] Implement `src/features/results/EvacuationOrdering.tsx` as an ordered list of zones by priority score with urgency badges (🔴🟡🟢)
- [ ] Implement `src/features/results/SummaryStatistics.tsx` showing total population at risk, critical zones count, improvement percentage, confidence interval
- [ ] Implement `src/features/results/RouteCard.tsx` showing route details with "Show on Map" button

## Task 10: Wind Rose and Header Components
- [ ] Implement `src/components/WindRose.tsx` as a compact compass rose with rotated arrow for wind direction, speed label, gust label, humidity label — updates reactively from SimulationContext wind state
- [ ] Style WindRose with subtle glow effect and smooth rotation transitions on direction change
- [ ] Update HeaderBar to show "Modified Wind" badge when wind params differ from last NWS fetch
- [ ] Implement `src/components/ToastContainer.tsx` with auto-dismissing toast notifications (success=green, warning=amber, error=red), positioned top-right, z-index above all content

## Task 11: Demo Mode and Presentation Flow
- [ ] Implement `src/features/controls/DemoStepIndicator.tsx` showing 5-step flow: Select Ignition → Fetch Wind → Run Simulation → Compare Routes → Adjust & Re-run, with current step highlighted
- [ ] Wire Ctrl+D keyboard shortcut to toggle demo mode: pre-loads Camp Fire scenario, auto-fetches wind, shows step indicator
- [ ] Implement "Quick Compare" action: button that re-runs simulation with wind direction +45°, stores previous results, and displays side-by-side comparison
- [ ] Ensure Camp Fire perimeter outline loads on app startup as a reference layer before any simulation
- [ ] Implement purposeful loading state during simulation: progress bar with run count, elapsed time, and subtle animated fire-spread preview
- [ ] Add "MOCK DATA" badge in header when `VITE_API_MODE=mock`

## Task 12: Polish, Accessibility, and Performance
- [ ] Audit all components for WCAG AA compliance: 4.5:1 contrast ratios, focus indicators, aria-labels, keyboard navigation
- [ ] Ensure zone table uses semantic `<table>` markup with `aria-sort` on sortable columns
- [ ] Add `aria-live="polite"` region for simulation status updates (screen reader announces progress)
- [ ] Verify all interactive elements meet 44×44px minimum touch target
- [ ] Implement CSS transitions on panel collapse/expand (300ms ease), button hover states (150ms), layer toggle (150ms)
- [ ] Optimize bundle: verify gzipped size < 500KB, lazy-load mock data, tree-shake unused Deck.gl layers
- [ ] Test responsive behavior at 1280px, 1024px, 768px, and 375px breakpoints
- [ ] Verify map renders and animates at ≥15 FPS with full burn heatmap on target grid
- [ ] Add `<meta>` tags for viewport, theme-color (#0A0E17), and description
- [ ] Final visual QA: verify all design tokens are applied consistently, no hardcoded colors, spacing matches 4px grid
