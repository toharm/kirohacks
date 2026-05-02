# Design Document

## Overview

This design specifies the EvacuAI frontend — a dark command-center dashboard for wildfire evacuation planning. The frontend is a React/TypeScript SPA that consumes the EvacuAI FastAPI backend via REST, renders geospatial simulation results on a WebGL map, and presents Monte Carlo outputs through operational data visualizations. The design prioritizes: (1) spatial clarity for first responders, (2) fast parameter iteration for what-if analysis, (3) visual credibility for hackathon judges, and (4) strict separation from backend computation.

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────┐
│                    EvacuAI Frontend                       │
│  React 18 + TypeScript + Vite                            │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Control   │  │ Map View │  │ Results  │               │
│  │ Panel     │  │ (Deck.gl │  │ Panel    │               │
│  │           │  │  /Mapbox)│  │          │               │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘               │
│        │             │              │                     │
│  ┌─────▼─────────────▼──────────────▼─────┐              │
│  │         SimulationContext               │              │
│  │  (React Context + useReducer)           │              │
│  └─────────────────┬──────────────────────┘              │
│                    │                                      │
│  ┌─────────────────▼──────────────────────┐              │
│  │         API Service Layer               │              │
│  │  (ApiClient ↔ MockApiClient)            │              │
│  └─────────────────┬──────────────────────┘              │
└────────────────────┼──────────────────────────────────────┘
                     │ HTTP/REST
                     ▼
┌────────────────────────────────────────────┐
│         EvacuAI Backend (FastAPI)           │
│  POST /api/simulate                        │
│  GET  /api/results/{job_id}                │
│  GET  /api/wind?lat=&lon=                  │
│  GET  /api/scenarios                       │
└────────────────────────────────────────────┘
```

### Component Tree

```
<App>
  <SimulationProvider>              ← React Context wrapping entire app
    <CommandCenter>                 ← Full-viewport flex layout
      <HeaderBar>                  ← 48px top bar
        <Logo />
        <ScenarioLabel />
        <SimulationStatus />
        <WindRose />
      </HeaderBar>
      <MainContent>                ← Flex row, fills remaining height
        <ControlPanel>             ← 320px left sidebar, collapsible
          <IgnitionSection />
          <WindSection />
          <ScenarioSelector />
          <MonteCarloSlider />
          <RunButton />
          <DemoStepIndicator />    ← Only visible in Demo Mode
        </ControlPanel>
        <MapView>                  ← Flex-grow center
          <DeckGLMap />
          <BurnHeatmapLayer />
          <RouteOverlayLayer />
          <ZoneChoroplethLayer />
          <ShelterMarkers />
          <PerimeterOutline />
          <LayerToggleControl />
          <AnimationTimeline />
          <IgnitionMarker />
        </MapView>
        <ResultsPanel>             ← 380px right sidebar, collapsible
          <KeyMetricCard />        ← "Route A survives in 82%..."
          <ComparisonView>
            <StrategyColumn strategy="baseline" />
            <StrategyColumn strategy="optimized" />
          </ComparisonView>
          <ZoneEvacuationTable />
          <EvacuationOrdering />
          <SummaryStatistics />
        </ResultsPanel>
      </MainContent>
    </CommandCenter>
    <ToastContainer />
  </SimulationProvider>
</App>
```

## Design Decisions

### Decision 1: Deck.gl over Leaflet for Map Rendering

**Choice:** Deck.gl with Mapbox GL JS basemap

**Rationale:** The Burn_Probability_Map is a large 2D raster (potentially 250×350 cells at 100m resolution). Deck.gl's `HeatmapLayer` and `BitmapLayer` use WebGL for GPU-accelerated rendering, which is critical for smooth animation of fire spread across 500+ timesteps. Leaflet's canvas/SVG rendering would struggle with this data volume. Deck.gl also provides `PathLayer` for route overlays and `GeoJsonLayer` for zone polygons, giving us a unified rendering pipeline.

**Trade-off:** Deck.gl has a steeper learning curve and larger bundle size (~200KB gzipped). For a hackathon, this is acceptable because the visual quality difference is dramatic and directly impacts judge perception.

### Decision 2: React Context + useReducer over Zustand/Redux

**Choice:** React Context with useReducer for simulation state

**Rationale:** The simulation state is relatively simple: current parameters, job status, and results. There are no deeply nested updates or high-frequency state changes that would cause re-render performance issues. Context + useReducer keeps the dependency count low, is familiar to all React developers, and avoids introducing another library for a hackathon project. The state shape is:

```typescript
interface SimulationState {
  // Input parameters
  ignitionPoint: { lat: number; lon: number } | null;
  windParams: WindParameters;
  monteCarloRuns: number;
  selectedScenario: string | null;

  // Job tracking
  jobId: string | null;
  jobStatus: 'idle' | 'submitting' | 'running' | 'complete' | 'error';
  progress: { completed: number; total: number } | null;

  // Results
  currentResults: SimulationResults | null;
  previousResults: SimulationResults | null;  // For comparison

  // UI state
  demoMode: boolean;
  demoStep: number;
  apiMode: 'live' | 'mock';
  selectedZoneId: string | null;
  animationTimestep: number;
  isAnimating: boolean;
  visibleLayers: {
    burnHeatmap: boolean;
    routes: boolean;
    zones: boolean;
    shelters: boolean;
    perimeter: boolean;
  };
}
```

### Decision 3: CSS Custom Properties Design Token System

**Choice:** Single `design-tokens.css` file with CSS custom properties, no CSS-in-JS

**Rationale:** CSS custom properties provide runtime theming capability, zero JavaScript overhead, and work with any component styling approach. For a hackathon, this avoids the complexity of styled-components or Emotion while still providing a systematic design foundation. All components reference tokens rather than hardcoded values.

### Decision 4: Mock API Client with Environment Toggle

**Choice:** Parallel `ApiClient` and `MockApiClient` classes implementing the same interface, switched via `VITE_API_MODE` env var

**Rationale:** The backend and frontend teams work in parallel. The mock client returns realistic data matching the exact Pydantic schemas, with simulated delays. This means the frontend can be fully developed and demo'd before the backend is complete. The switch is a single env var change — no code modifications needed for integration.

```typescript
// services/api.ts
interface EvacuAIApi {
  simulate(params: SimulateRequest): Promise<{ jobId: string }>;
  getResults(jobId: string): Promise<SimulationResults | { status: 'running'; progress: Progress }>;
  getWind(lat: number, lon: number): Promise<WindData>;
  getScenarios(): Promise<ScenarioPreset[]>;
}

// Instantiation based on env
const api: EvacuAIApi = import.meta.env.VITE_API_MODE === 'mock'
  ? new MockApiClient()
  : new LiveApiClient(import.meta.env.VITE_API_BASE_URL);
```

### Decision 5: Animation via Timestep Interpolation

**Choice:** Pre-compute arrival time grid, animate by filtering cells where `arrival_time <= currentTimestep`

**Rationale:** Rather than re-rendering the full burn grid at each frame, we use the mean arrival time per cell from the Monte Carlo results. The animation scrubber controls `currentTimestep`, and the Deck.gl layer filters to show only cells ignited by that time. This is computationally trivial on the frontend (a single comparison per cell) and produces smooth 30+ FPS animation. The color encodes time-since-ignition: bright orange for freshly ignited, dark red for long-burned.

## Detailed Design

### Design Tokens (CSS Custom Properties)

```css
:root {
  /* Surface colors — dark command center palette */
  --surface-base: #0A0E17;        /* Deepest background */
  --surface-raised: #111827;       /* Panel backgrounds */
  --surface-overlay: #1F2937;      /* Cards, tooltips, dropdowns */
  --surface-border: #374151;       /* Subtle borders */
  --surface-hover: #2D3748;        /* Hover states */

  /* Text colors */
  --text-primary: #F9FAFB;         /* Primary text, headings */
  --text-secondary: #D1D5DB;       /* Body text */
  --text-muted: #9CA3AF;           /* Labels, captions */
  --text-disabled: #6B7280;        /* Disabled states */

  /* Semantic data colors — fire spectrum */
  --fire-low: #FCD34D;             /* Low burn probability (yellow) */
  --fire-medium: #F97316;          /* Medium burn probability (orange) */
  --fire-high: #DC2626;            /* High burn probability (red) */
  --fire-extreme: #991B1B;         /* Extreme / fully burned (dark red) */
  --fire-active: #FF6B35;          /* Active fire front (bright orange) */

  /* Semantic data colors — evacuation */
  --route-safe: #00E5FF;           /* High viability route (cyan) */
  --route-caution: #FFD600;        /* Medium viability (yellow) */
  --route-danger: #FF1744;         /* Low viability (red) */
  --zone-safe: #10B981;            /* Zone safe (green) */
  --zone-warning: #F59E0B;         /* Zone warning (amber) */
  --zone-critical: #EF4444;        /* Zone critical (red) */

  /* UI accent colors */
  --accent-primary: #3B82F6;       /* Primary actions, links */
  --accent-primary-hover: #2563EB; /* Primary hover */
  --accent-success: #10B981;       /* Success states */
  --accent-warning: #F59E0B;       /* Warning states */
  --accent-error: #EF4444;         /* Error states */

  /* Typography */
  --font-ui: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-xs: 0.75rem;              /* 12px — labels, captions */
  --text-sm: 0.875rem;             /* 14px — secondary text */
  --text-base: 1rem;               /* 16px — body text */
  --text-lg: 1.125rem;             /* 18px — subheadings */
  --text-xl: 1.25rem;              /* 20px — section titles */
  --text-2xl: 1.5rem;              /* 24px — panel titles */
  --text-3xl: 1.875rem;            /* 30px — key metrics */
  --text-4xl: 2.25rem;             /* 36px — hero metric */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing (4px base grid) */
  --space-1: 0.25rem;              /* 4px */
  --space-2: 0.5rem;               /* 8px */
  --space-3: 0.75rem;              /* 12px */
  --space-4: 1rem;                 /* 16px */
  --space-5: 1.25rem;              /* 20px */
  --space-6: 1.5rem;               /* 24px */
  --space-8: 2rem;                 /* 32px */
  --space-10: 2.5rem;              /* 40px */
  --space-12: 3rem;                /* 48px */
  --space-16: 4rem;                /* 64px */

  /* Layout */
  --header-height: 48px;
  --control-panel-width: 320px;
  --results-panel-width: 380px;
  --panel-padding: var(--space-4);
  --card-radius: 8px;
  --card-border: 1px solid var(--surface-border);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow-fire: 0 0 20px rgba(255, 107, 53, 0.3);
  --shadow-glow-safe: 0 0 20px rgba(0, 229, 255, 0.2);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
  --transition-slow: 500ms ease;

  /* Z-index layers */
  --z-panel: 10;
  --z-overlay: 20;
  --z-tooltip: 30;
  --z-toast: 40;
  --z-modal: 50;
}
```

### Layout Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ HeaderBar (48px)                                              │
│ [Logo] [Scenario: Camp Fire] [Status: ● Running 342/500] [🌬️]│
├────────────┬─────────────────────────────┬───────────────────┤
│ Control    │                             │ Results           │
│ Panel      │        Map View             │ Panel             │
│ (320px)    │     (flex-grow: 1)          │ (380px)           │
│            │                             │                   │
│ ┌────────┐ │  ┌─────────────────────┐    │ ┌──────────────┐ │
│ │Ignition│ │  │                     │    │ │ KEY METRIC   │ │
│ │ Point  │ │  │   Deck.gl Map       │    │ │ Route A: 82% │ │
│ └────────┘ │  │   + Layers          │    │ └──────────────┘ │
│ ┌────────┐ │  │                     │    │ ┌──────────────┐ │
│ │ Wind   │ │  │   [Layer Toggles]   │    │ │ Comparison   │ │
│ │ Params │ │  │                     │    │ │ Base │ Optim │ │
│ └────────┘ │  │                     │    │ └──────────────┘ │
│ ┌────────┐ │  └─────────────────────┘    │ ┌──────────────┐ │
│ │Scenario│ │  ┌─────────────────────┐    │ │ Zone Table   │ │
│ │Selector│ │  │ Animation Timeline  │    │ │ (sortable)   │ │
│ └────────┘ │  │ ▶ ━━━━━●━━━━━━━━━━ │    │ │              │ │
│ ┌────────┐ │  │ t=23min  [1x][2x]  │    │ └──────────────┘ │
│ │MC Runs │ │  └─────────────────────┘    │ ┌──────────────┐ │
│ │ [500]  │ │                             │ │ Evac Order   │ │
│ └────────┘ │                             │ │ 1. Zone A 🔴 │ │
│            │                             │ │ 2. Zone B 🟡 │ │
│ [▶ RUN   ] │                             │ └──────────────┘ │
│ SIMULATION │                             │                   │
└────────────┴─────────────────────────────┴───────────────────┘
```

### TypeScript API Types

```typescript
// types/api.ts — mirrors backend Pydantic schemas exactly

export interface SimulateRequest {
  ignition_point: { lat: number; lon: number };
  wind_speed: number;          // mph
  wind_direction: number;      // degrees 0-360
  wind_gust: number;           // mph
  relative_humidity: number;   // 0-100
  num_runs: number;            // 50-1000
  scenario_preset?: string;    // optional preset name
}

export interface SimulateResponse {
  job_id: string;
}

export interface SimulationProgress {
  status: 'running';
  completed_runs: number;
  total_runs: number;
  elapsed_seconds: number;
}

export interface GridBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  cell_size_m: number;
  grid_rows: number;
  grid_cols: number;
}

export interface BurnProbabilityMap {
  grid: number[][];            // 2D array, values 0.0–1.0
  grid_bounds: GridBounds;
}

export interface ArrivalTimeStats {
  mean: number[][];
  median: number[][];
  p10: number[][];
  p90: number[][];
  grid_bounds: GridBounds;
}

export interface RouteSegment {
  lat: number;
  lon: number;
}

export interface EvacuationRoute {
  route_id: string;
  zone_id: string;
  segments: RouteSegment[];
  viability_score: number;     // 0.0–1.0
  travel_time_minutes: number;
  strategy: 'baseline' | 'optimized';
}

export interface ZoneResult {
  type: 'Feature';
  geometry: GeoJSON.Polygon;
  properties: {
    zone_id: string;
    population: number;
    cutoff_time: number;       // minutes
    evacuation_priority_score: number;
    best_baseline_route_id: string;
    best_optimized_route_id: string;
    baseline_viability: number;
    optimized_viability: number;
    failure_risk_percentage: number;
  };
}

export interface SimulationResults {
  status: 'complete';
  job_id: string;
  burn_probability: BurnProbabilityMap;
  arrival_times: ArrivalTimeStats;
  routes: EvacuationRoute[];
  zones: {
    type: 'FeatureCollection';
    features: ZoneResult[];
  };
  evacuation_ordering: Array<{
    zone_id: string;
    priority_score: number;
    population: number;
    cutoff_time: number;
  }>;
  summary: {
    total_population_at_risk: number;
    zones_critical_count: number;       // cutoff < 10 min
    baseline_avg_viability: number;
    optimized_avg_viability: number;
    improvement_percentage: number;
    confidence_interval_95: [number, number];
  };
}

export interface WindData {
  wind_speed: number;
  wind_direction: number;
  wind_gust: number;
  relative_humidity: number;
  forecast_text: string;
  source: 'nws' | 'fallback' | 'manual';
}

export interface ScenarioPreset {
  name: string;
  description: string;
  ignition_point: { lat: number; lon: number };
  wind_speed: number;
  wind_direction: number;
  wind_gust: number;
  relative_humidity: number;
}
```

### Key Component Specifications

#### MetricCard Component

```
┌─────────────────────────────┐
│ ROUTE VIABILITY              │  ← label: 12px, muted, uppercase
│ 82%                          │  ← value: 32px, bold, semantic color
│ of scenarios                 │  ← unit: 14px, muted
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  ← optional: thin progress bar
│ ▲ +14% vs baseline           │  ← optional: comparison delta
└─────────────────────────────┘
Background: var(--surface-overlay)
Border: var(--card-border)
Border-radius: var(--card-radius)
Padding: var(--space-4)
```

#### Zone Evacuation Table Row

```
┌──────┬──────┬────────┬──────┬──────────┬──────────┬────────┬──────┐
│ Zone │ Pop  │Cutoff  │Prior │ Base Via │ Opt Via  │ Fail % │Status│
│ ID   │      │ (min)  │Score │    (%)   │   (%)    │        │      │
├──────┼──────┼────────┼──────┼──────────┼──────────┼────────┼──────┤
│ BG-12│ 2,340│  8 min │ 0.87 │   64%    │   82%    │  18%   │  🔴  │
│ BG-07│ 1,890│ 22 min │ 0.65 │   78%    │   91%    │   9%   │  🟡  │
│ BG-03│   940│ 45 min │ 0.42 │   92%    │   97%    │   3%   │  🟢  │
└──────┴──────┴────────┴──────┴──────────┴──────────┴────────┴──────┘
Font: JetBrains Mono for numeric columns
Row hover: var(--surface-hover)
Click: selects zone, highlights on map
Status: 🔴 cutoff<10min, 🟡 10-30min, 🟢 >30min
```

#### Burn Heatmap Color Ramp

```
Probability:  0.0    0.2    0.4    0.6    0.8    1.0
Color:        trans   #FCD34D #F97316 #DC2626 #991B1B #7F1D1D
              parent  yellow  orange  red     dark    darkest
Opacity:      0.0    0.3    0.5    0.6    0.7    0.8
```

### File Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env                          # VITE_API_MODE=mock, VITE_API_BASE_URL, VITE_MAPBOX_TOKEN
├── .env.example
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                  # Entry point, renders <App />
│   ├── App.tsx                   # SimulationProvider + CommandCenter
│   ├── styles/
│   │   ├── design-tokens.css     # All CSS custom properties
│   │   ├── reset.css             # Minimal CSS reset
│   │   ├── global.css            # Body, typography, scrollbar styles
│   │   └── animations.css        # Keyframe animations (pulse, fade, glow)
│   ├── types/
│   │   └── api.ts                # TypeScript interfaces mirroring Pydantic schemas
│   ├── services/
│   │   ├── api.ts                # EvacuAIApi interface + factory
│   │   ├── liveApiClient.ts      # Fetch-based live API client
│   │   └── mockApiClient.ts      # Mock client with realistic delays + data
│   ├── context/
│   │   ├── SimulationContext.tsx  # Context + Provider + useReducer
│   │   └── simulationReducer.ts  # Reducer actions and state transitions
│   ├── hooks/
│   │   ├── useSimulation.ts      # Hook wrapping context for components
│   │   ├── usePolling.ts         # Generic polling hook for job status
│   │   └── useKeyboardShortcuts.ts # Demo mode Ctrl+D, etc.
│   ├── components/
│   │   ├── HeaderBar.tsx
│   │   ├── WindRose.tsx
│   │   ├── MetricCard.tsx
│   │   ├── SimulationStatus.tsx
│   │   ├── ToastContainer.tsx
│   │   └── LayerToggle.tsx
│   ├── features/
│   │   ├── controls/
│   │   │   ├── ControlPanel.tsx
│   │   │   ├── IgnitionSection.tsx
│   │   │   ├── WindSection.tsx
│   │   │   ├── ScenarioSelector.tsx
│   │   │   ├── MonteCarloSlider.tsx
│   │   │   ├── RunButton.tsx
│   │   │   └── DemoStepIndicator.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── BurnHeatmapLayer.tsx
│   │   │   ├── RouteOverlayLayer.tsx
│   │   │   ├── ZoneChoroplethLayer.tsx
│   │   │   ├── ShelterMarkers.tsx
│   │   │   ├── PerimeterOutline.tsx
│   │   │   ├── IgnitionMarker.tsx
│   │   │   └── AnimationTimeline.tsx
│   │   └── results/
│   │       ├── ResultsPanel.tsx
│   │       ├── ComparisonView.tsx
│   │       ├── ZoneEvacuationTable.tsx
│   │       ├── EvacuationOrdering.tsx
│   │       ├── RouteCard.tsx
│   │       └── SummaryStatistics.tsx
│   └── assets/
│       ├── logo.svg
│       └── mock/
│           ├── simulationResults.json
│           ├── windData.json
│           └── scenarios.json
```

### Data Flow

```
User clicks "Run Simulation"
  │
  ▼
ControlPanel dispatches SUBMIT_SIMULATION action
  │
  ▼
SimulationContext reducer → status: 'submitting'
  │
  ▼
useSimulation hook calls api.simulate(params)
  │
  ▼
API returns { job_id: "abc-123" }
  │
  ▼
Reducer → status: 'running', jobId: "abc-123"
  │
  ▼
usePolling hook starts polling api.getResults("abc-123") every 1s
  │
  ├── HTTP 202 → update progress (completed/total)
  │   └── Reducer → progress: { completed: 342, total: 500 }
  │
  └── HTTP 200 → full results received
      │
      ▼
Reducer → status: 'complete', currentResults: data
  │
  ├── MapView re-renders with burn heatmap, routes, zones
  ├── ResultsPanel populates comparison, table, ordering
  └── HeaderBar updates status indicator to "Complete ✓"
```

### Responsive Behavior

| Breakpoint | Layout Change |
|---|---|
| ≥ 1280px | Full 3-column layout: Control (320px) + Map + Results (380px) |
| 1024–1279px | Narrower panels: Control (280px) + Map + Results (320px) |
| 768–1023px | Panels collapse to overlay drawers, map fills viewport, toggle buttons on edges |
| < 768px | Single column: map fills viewport, panels as bottom sheets |

### Accessibility Specifications

- All interactive elements have `aria-label` or visible text labels
- Zone table is a proper `<table>` with `<thead>`, `<tbody>`, sortable column headers with `aria-sort`
- Map layers have screen-reader-accessible summary text describing current state
- Color is never the sole indicator — all status uses color + icon + text
- Focus management: Tab through Control Panel → Run Button → Results Panel
- Animation respects `prefers-reduced-motion`: disables fire animation, shows static heatmap instead
- Minimum 4.5:1 contrast ratio verified for all text/background combinations in the dark theme

### Performance Budget

| Metric | Target |
|---|---|
| Initial bundle (gzipped) | < 500KB |
| Time to interactive | < 3 seconds |
| Map render (burn heatmap) | < 500ms for 250×350 grid |
| Animation frame rate | ≥ 15 FPS during fire spread playback |
| API polling overhead | < 1KB per poll request |
| Memory (peak during animation) | < 200MB |

### Error Handling Strategy

| Error | User Experience |
|---|---|
| Wind API fails | Toast: "Wind data unavailable, using defaults (10 mph SW)". Fields populated with fallback. |
| Simulation submit fails (422) | Field-level validation errors shown inline in Control Panel. |
| Simulation submit fails (500/network) | Toast: "Simulation failed. Check connection and retry." Retry button. |
| Polling timeout (>60s no progress) | Toast: "Simulation taking longer than expected." Continue polling with backoff. |
| Mapbox token invalid | Fallback to OpenStreetMap tile layer with degraded styling. |
| Mock mode active | Subtle "MOCK DATA" badge in header bar during development. |
