# Implementation Tasks

## Task 1: Project Scaffolding and Tailwind Design System
- [x] Initialize Vite + React + TypeScript project in `/frontend` with `npm create vite@latest frontend -- --template react-ts`
- [x] Configure `tsconfig.json` with `strict: true` and path alias `@/*` → `src/*`
- [x] Install Tailwind CSS: `npm install -D tailwindcss @tailwindcss/vite` and configure `vite.config.ts` with the Tailwind plugin
- [x] Create `tailwind.config.ts` with the full custom theme from the design doc: surface colors, fire spectrum, route/zone/elevation semantics, font families (Inter, JetBrains Mono), custom spacing (header, control-panel, results-panel), box shadows (glow-fire, glow-safe), and animations (pulse-slow, fade-in, glow)
- [x] Create `src/index.css` with `@import "tailwindcss"` and `@layer base` directives for font-face imports (Inter from Google Fonts, JetBrains Mono), html/body dark background (`bg-surface-base text-gray-100`), and custom scrollbar styling
- [x] Install utility: `npm install clsx tailwind-merge` and create `src/lib/cn.ts` exporting a `cn()` helper combining clsx + twMerge
- [x] Install map dependencies: `npm install deck.gl @deck.gl/react @deck.gl/layers @deck.gl/geo-layers mapbox-gl react-map-gl`
- [x] Create `.env.example` with `VITE_API_MODE=mock`, `VITE_API_BASE_URL=http://localhost:8000`, `VITE_MAPBOX_TOKEN=`
- [x] Verify dev server starts, dark background renders, Tailwind classes apply, and custom theme colors work

## Task 2: TypeScript API Types and Service Layer
- [x] Create `src/types/api.ts` with all interfaces mirroring backend Pydantic schemas: `SimulateRequest`, `SimulateResponse`, `SimulationProgress`, `GridBounds`, `BurnProbabilityMap`, `ArrivalTimeStats`, `RouteSegment`, `EvacuationRoute`, `ZoneResult`, `SimulationResults`, `WindData`, `ScenarioPreset`
- [x] Create `src/services/api.ts` defining the `EvacuAIApi` interface with methods `simulate()`, `getResults()`, `getWind()`, `getScenarios()` and a factory function returning `MockApiClient` or `LiveApiClient` based on `VITE_API_MODE`
- [x] Create `src/services/liveApiClient.ts` implementing `EvacuAIApi` with fetch-based HTTP calls, handling 422 (parse field errors), 202 (return progress), and network errors (throw typed error)
- [x] Create `src/services/mockApiClient.ts` implementing `EvacuAIApi` with realistic mock data and simulated delays (100ms for wind/scenarios, 3s progressive for simulation with progress callbacks)
- [x] Create `src/assets/mock/simulationResults.json` with realistic mock output for the demo region including burn grid, routes, zones, and summary
- [x] Create `src/assets/mock/windData.json` with mock NWS wind response (14 mph SW, 22 gust, 18% humidity)
- [x] Create `src/assets/mock/scenarios.json` with three presets: Fast Wind Shift, Night Evacuation, School Zone

## Task 3: State Management (SimulationContext)
- [x] Create `src/context/simulationReducer.ts` with `SimulationState` interface, discriminated union action types (`SET_IGNITION`, `SET_WIND`, `SET_SCENARIO`, `SET_MC_RUNS`, `SUBMIT_SIMULATION`, `UPDATE_PROGRESS`, `SET_RESULTS`, `SET_ERROR`, `TOGGLE_DEMO_MODE`, `SET_DEMO_STEP`, `SELECT_ZONE`, `SET_ANIMATION_TIMESTEP`, `TOGGLE_LAYER`, `TOGGLE_ANIMATION`, `SET_TERRAIN_EXAGGERATION`, `STORE_PREVIOUS_RESULTS`), and pure reducer function
- [x] Create `src/context/SimulationContext.tsx` with React.createContext, Provider wrapping useReducer, and initial state (idle, null results, default wind, all layers visible)
- [x] Create `src/hooks/useSimulation.ts` consuming context, exposing typed dispatch helpers (`setIgnition()`, `setWind()`, `runSimulation()`, etc.) and memoized selectors
- [x] Create `src/hooks/usePolling.ts` — generic hook accepting async fn + interval + stop condition, with cleanup on unmount
- [x] Create `src/hooks/useKeyboardShortcuts.ts` for Ctrl+D (demo mode toggle)
- [x] Wire `SimulationProvider` into `App.tsx`

## Task 4: Command Center Layout Shell
- [x] Create `src/App.tsx` rendering `<SimulationProvider>` → `<CommandCenter />` → `<ToastContainer />`
- [x] Create `src/components/CommandCenter.tsx`: `div.h-screen flex flex-col bg-surface-base` containing HeaderBar + MainContent (`div.flex flex-1 overflow-hidden`)
- [x] Create `src/components/HeaderBar.tsx`: `header.h-12 bg-surface-raised border-b border-surface-border flex items-center px-4 gap-4` with Logo, ScenarioLabel (`text-sm text-gray-400`), SimulationStatus, and WindRose
- [x] Create `src/components/SimulationStatus.tsx`: colored dot (`w-2 h-2 rounded-full`) — `bg-gray-500` idle, `bg-accent-primary animate-pulse` running, `bg-accent-success` complete, `bg-accent-error` error — plus status text in `text-xs font-mono`
- [x] Create stub `src/features/controls/ControlPanel.tsx`: `aside.w-80 shrink-0 bg-surface-raised border-r border-surface-border overflow-y-auto p-4 space-y-4 hidden lg:flex lg:flex-col`
- [x] Create stub `src/features/map/MapView.tsx`: `div.flex-1 relative bg-surface-base`
- [x] Create stub `src/features/results/ResultsPanel.tsx`: `aside.w-96 shrink-0 bg-surface-raised border-l border-surface-border overflow-y-auto p-4 space-y-4 hidden lg:flex lg:flex-col`
- [x] Implement mobile drawer behavior: panels use `fixed inset-y-0 z-20 transform transition-transform duration-300` with translate toggle, plus backdrop overlay `fixed inset-0 bg-black/50 z-10`
- [x] Add toggle buttons on map edges for mobile: `absolute top-1/2 left-0 z-10` and `right-0` with chevron icons
- [x] Verify 3-column layout at xl, narrower at lg, drawers at md and below

## Task 5: Interactive Map with Base Layers and Elevation
- [x] Implement `src/features/map/MapView.tsx` with `<DeckGL>` + `<Map>` from react-map-gl, dark style (`mapbox://styles/mapbox/dark-v11`), centered on demo region, zoom 12
- [x] Implement click-to-ignite: `onClick` handler dispatches `SET_IGNITION` with `{lat, lon}` from pick info
- [x] Create `src/features/map/IgnitionMarker.tsx`: Deck.gl `ScatterplotLayer` with `radiusScale` animation (pulsing via `getRadius` + requestAnimationFrame), `getFillColor: [255, 107, 53, 200]`
- [x] Create `src/features/map/ElevationLayer.tsx`: configure Mapbox `addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1' })`, `map.setTerrain({ source: 'mapbox-dem', exaggeration })`, and hillshade layer
- [x] Add terrain exaggeration slider in LayerToggle: `input[type=range]` min=1 max=3 step=0.5, styled with `accent-accent-primary`, dispatches `SET_TERRAIN_EXAGGERATION`
- [x] Create `src/features/map/PerimeterOutline.tsx`: `GeoJsonLayer` with dashed orange stroke (`getLineColor: [255, 107, 53, 180]`, `getDashArray: [8, 4]`)
- [x] Create `src/features/map/ShelterMarkers.tsx`: `IconLayer` or `ScatterplotLayer` with distinct blue markers, text labels for capacity
- [x] Create `src/components/LayerToggle.tsx`: floating panel `absolute top-4 right-4 z-10 bg-surface-overlay/90 backdrop-blur-sm border border-surface-border rounded-lg p-3 space-y-2` with labeled checkboxes for each layer
- [x] Wire layer toggles to `visibleLayers` in SimulationContext
- [x] Graceful fallback: if `VITE_MAPBOX_TOKEN` is empty, use OSM tiles, disable elevation toggle with `opacity-50 cursor-not-allowed` and tooltip

## Task 6: Control Panel — Full Implementation
- [x] Implement `src/features/controls/IgnitionSection.tsx`: section with `text-xs uppercase tracking-wider text-gray-500 mb-2` label, lat/lon display in `font-mono text-sm`, "Select on Map" button (`bg-surface-overlay hover:bg-surface-hover border border-surface-border rounded-md px-3 py-2 text-sm`), clear button
- [x] Implement `src/features/controls/WindSection.tsx`: 2×2 grid of labeled numeric inputs (`bg-surface-base border border-surface-border rounded-md px-3 py-2 font-mono text-sm text-gray-200 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30`), "Fetch Live Wind" button, Live/Manual toggle using segmented control
- [x] Wire "Fetch Live Wind" to `api.getWind()`, populate fields, show toast on success/fallback
- [x] Implement `src/features/controls/ScenarioSelector.tsx`: fetch from `api.getScenarios()`, render as cards (`bg-surface-overlay hover:bg-surface-hover border border-surface-border rounded-lg p-3 cursor-pointer transition-colors`) with name + description, selected state with `ring-2 ring-accent-primary`
- [x] Implement `src/features/controls/MonteCarloSlider.tsx`: `input[type=range]` with `accent-fire-active`, min=50 max=1000 step=50, numeric display in `font-mono text-lg font-bold text-gray-200`
- [x] Implement `src/features/controls/RunButton.tsx`: full-width button with fire glow, disabled state, progress overlay bar during run (inner div with `bg-fire-active/30` width transitioning)
- [x] Client-side validation: wind speed 0–100, direction 0–360, gust 0–150, humidity 0–100, ignition required — invalid fields get `border-accent-error` + error text in `text-xs text-accent-error`
- [x] Wire RunButton → `SUBMIT_SIMULATION` → `api.simulate()` → `usePolling` → `UPDATE_PROGRESS` / `SET_RESULTS`

## Task 7: Burn Heatmap and Fire Animation
- [ ] Implement `src/features/map/BurnHeatmapLayer.tsx`: Deck.gl `HeatmapLayer` or custom `BitmapLayer` rendering burn probability grid with color ramp (transparent → `fire-low` → `fire-medium` → `fire-high` → `fire-extreme`)
- [ ] Add opacity slider in LayerToggle for burn heatmap: `input[type=range]` min=0.1 max=1.0 step=0.1
- [ ] Implement `src/features/map/AnimationTimeline.tsx`: bottom bar `absolute bottom-0 left-80 right-96 z-10 bg-surface-overlay/90 backdrop-blur-sm border-t border-surface-border p-3 flex items-center gap-3` with play/pause (`w-8 h-8 rounded-full bg-fire-active`), scrubber (`flex-1`), step buttons, speed selector (0.5×/1×/2×/4× as `text-xs` buttons)
- [ ] Implement animation logic: `requestAnimationFrame` loop advancing `animationTimestep`, Deck.gl layer filters cells where `arrival_time <= currentTimestep`, color by `currentTimestep - arrival_time` (bright orange → dark red)
- [ ] Add cutoff time markers on timeline: small vertical ticks with zone ID labels in `text-[10px] text-gray-500`
- [ ] Respect `prefers-reduced-motion`: use `motion-safe:animate-*` variants, show static heatmap if reduced motion preferred
- [ ] Verify ≥15 FPS with full grid + terrain enabled

## Task 8: Route and Zone Visualization Layers
- [ ] Implement `src/features/map/RouteOverlayLayer.tsx`: Deck.gl `PathLayer`, color by viability (`route-safe` >80%, `route-caution` 50–80%, `route-danger` <50%), `getWidth` proportional to capacity, baseline routes dashed (`getDashArray: [6, 3]`), optimized solid
- [ ] Implement `src/features/map/ZoneChoroplethLayer.tsx`: Deck.gl `GeoJsonLayer`, fill color by cutoff urgency (`zone-safe` >30min, `zone-warning` 15–30, `fire-medium` 5–15, `zone-critical` <5), `opacity: 0.4`, stroke `1px surface-border`
- [ ] Implement zone hover tooltip: Deck.gl `onHover` → render `div.absolute z-30 bg-surface-overlay border border-surface-border rounded-lg p-3 shadow-lg text-sm pointer-events-none` with zone_id, population, cutoff, priority, failure risk
- [ ] Implement zone click: dispatch `SELECT_ZONE`, `map.fitBounds()` to zone, highlight polygon with `ring-2 ring-accent-primary`, show both routes
- [ ] Selected zone routes: baseline in dashed `route-caution`, optimized in solid `route-safe`, with animated dash offset for visual distinction

## Task 9: Results Panel — Metrics and Comparison
- [ ] Implement `src/components/MetricCard.tsx`: reusable component accepting `label`, `value`, `unit`, `color`, `delta` props, using Tailwind classes from design doc pattern
- [ ] Implement `src/features/results/ResultsPanel.tsx`: scrollable `space-y-4` layout
- [ ] Key metric card at top: largest MetricCard showing "Route [name] survives in [X]% of scenarios" with `text-4xl font-bold font-mono text-route-safe`
- [ ] Implement `src/features/results/ComparisonView.tsx`: `grid grid-cols-2 gap-3` with Baseline and Optimized columns, each containing MetricCards for avg viability, avg time, failure risk; improvement percentage highlighted in `text-accent-success`
- [ ] Implement `src/features/results/ZoneEvacuationTable.tsx`: `<table className="w-full text-left">` with `<thead>` using `text-xs uppercase tracking-wider text-gray-500 border-b border-surface-border`, sortable columns (click header → `aria-sort` + sort state), `<tbody>` rows with hover/click behavior
- [ ] Table row click → `SELECT_ZONE` dispatch
- [ ] Implement `src/features/results/EvacuationOrdering.tsx`: ordered list `ol.space-y-2`, each item `flex items-center gap-3 p-2 rounded-md bg-surface-overlay` with rank number, zone ID, population, priority score, urgency badge (`w-2.5 h-2.5 rounded-full` + color)
- [ ] Implement `src/features/results/SummaryStatistics.tsx`: `grid grid-cols-2 gap-3` of MetricCards: total pop at risk, critical zones count, improvement %, confidence interval
- [ ] Implement `src/features/results/RouteCard.tsx`: `bg-surface-overlay border border-surface-border rounded-lg p-3` with route name, viability score, travel time, "Show on Map" button

## Task 10: Wind Rose and Header Components
- [ ] Implement `src/components/WindRose.tsx`: compact `w-10 h-10 relative` compass with SVG arrow rotated via `style={{ transform: rotate(${direction}deg) }}`, speed/gust/humidity as `text-[10px] font-mono text-gray-400` labels, smooth `transition-transform duration-500`
- [ ] Add subtle glow: `shadow-glow-safe` on the WindRose container when wind data is live
- [ ] HeaderBar "Modified Wind" badge: `bg-accent-warning/20 text-accent-warning text-[10px] font-medium px-2 py-0.5 rounded-full` shown when wind differs from last NWS fetch
- [ ] Implement `src/components/ToastContainer.tsx`: `fixed top-4 right-4 z-50 space-y-2`, each toast `flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in` with color variants (success: `bg-accent-success/10 border border-accent-success/30 text-accent-success`, warning: amber, error: red), auto-dismiss after 5s with `transition-opacity`

## Task 11: Demo Mode and Presentation Flow
- [ ] Implement `src/features/controls/DemoStepIndicator.tsx`: `flex items-center gap-1` with 5 steps, each `flex items-center gap-1.5 text-xs`, active step `text-accent-primary font-semibold`, completed `text-accent-success`, upcoming `text-gray-600`, connected by `w-4 h-px bg-surface-border`
- [ ] Wire Ctrl+D → `TOGGLE_DEMO_MODE`: pre-loads default scenario, auto-fetches wind, shows step indicator, sets `demoStep: 1`
- [ ] "Quick Compare" button in ResultsPanel: `STORE_PREVIOUS_RESULTS` → modify wind direction +45° → re-run → display side-by-side with previous results in ComparisonView
- [ ] Fire perimeter loads on startup as reference layer (always visible in `visibleLayers`)
- [ ] Purposeful loading state: replace RunButton content with progress bar (`div.h-1 bg-fire-active rounded-full transition-all` width based on progress), run count in `font-mono text-xs`, elapsed time, subtle `animate-pulse` on the map overlay
- [ ] "MOCK DATA" badge in header: `bg-accent-warning/20 text-accent-warning text-[10px] px-2 py-0.5 rounded-full` when `VITE_API_MODE=mock`

## Task 12: Polish, Accessibility, and Performance
- [ ] Audit all interactive elements for `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary`
- [ ] Verify zone table: semantic `<table>`, `<th scope="col">`, `aria-sort="ascending|descending|none"` on sortable headers
- [ ] Add `aria-live="polite"` on SimulationStatus for screen reader progress announcements
- [ ] Verify all buttons/inputs: `min-h-[44px] min-w-[44px]` touch targets
- [ ] "Flatten" button for 3D terrain: `motion-reduce:` variant disables terrain by default, explicit button for manual flatten
- [ ] Verify `motion-safe:` / `motion-reduce:` on all animations (fire pulse, fade-in, glow, timeline playback)
- [ ] Panel transitions: `transition-transform duration-300 ease-in-out` on drawer open/close
- [ ] Button hover: `transition-colors duration-150`
- [ ] Run `npx tailwindcss --minify` build and verify CSS output < 15KB gzipped
- [ ] Verify total bundle < 500KB gzipped (check with `npx vite build && ls -la dist/assets/`)
- [ ] Test responsive: xl (1280+), lg (1024), md (768), sm (375) — verify layout, drawers, touch targets
- [ ] Verify map + animation ≥ 15 FPS with burn heatmap + terrain (Chrome DevTools Performance tab)
- [ ] Add `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="theme-color" content="#0A0E17">`, `<meta name="description">`
- [ ] Final QA: no hardcoded colors (search for `#` in tsx files — all should be Tailwind classes), spacing consistent with 4px grid, all text uses `font-ui` or `font-mono`
