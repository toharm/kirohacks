# EvacuAI Frontend — Critical Analysis & Task Breakdown

## Part 1: Critical Analysis of Requirements

### Issue 1: Mapping Library Ambiguity (Requirements 2, 9)

**Problem:** Requirement 2.1 specifies "Mapbox GL JS **or** Leaflet," Requirement 2.3 demands "WebGL-accelerated raster overlay," and Requirement 9.4 requires "Deck.gl or Mapbox GL JS." These are not interchangeable.

- Leaflet is **not WebGL-accelerated** by default and cannot satisfy 2.3 without significant plugin work.
- Requirement 2.6 specifies "Mapbox Terrain-DEM" for the Elevation_Layer, which is a Mapbox-proprietary tileset. Leaflet cannot consume it natively.
- Requirement 9.4 omits Leaflet entirely, contradicting 2.1.
- Requirement 2.10's 3D terrain exaggeration is only practical with Mapbox GL JS or comparable WebGL renderers.

**Recommendation:** Lock the stack to **Mapbox GL JS + Deck.gl**. Remove Leaflet from 2.1.

---

### Issue 2: Color Token Inconsistency (Requirements 2, 8)

**Problem:** The accent palette defined in 8.1 does not match the colors specified for map encodings.

- Requirement 2.4 uses cyan `#00E5FF`, yellow `#FFD600`, red `#FF1744` for routes.
- Requirement 8.1 defines safe routes as `#00E5FF → #06B6D4`, warning as `#F59E0B`, critical as `#EF4444`.
- The yellow `#FFD600` (Material yellow) and red `#FF1744` (Material red A400) are **not in the design system**.

**Recommendation:** Reconcile route colors to design tokens: `#00E5FF` (high), `#F59E0B` (medium), `#EF4444` (low). Document a single source of truth for color encoding.

---

### Issue 3: Polling Contract Underspecified (Requirements 3, 7)

**Problem:** Requirement 3.7 says polling continues "until status is no longer 202," and 7.5 says "until receiving HTTP 200." Neither specifies:

- Maximum poll duration / total timeout.
- Backoff strategy if the backend returns 5xx mid-poll.
- Behavior if `job_id` returns 404.
- Whether the user can cancel a running simulation.

**Recommendation:** Add an explicit polling contract: 60-second total timeout, 1s interval, abort button surfaced in Control_Panel, 404 surfaces a Toast_Notification, 5xx triggers a single retry with exponential backoff before failing.

---

### Issue 4: Animation Data Source Unspecified (Requirement 5)

**Problem:** Requirement 5.1 says the animation steps through "the mean arrival time grid," implying the backend returns a 2D grid of arrival times per cell. However:

- Requirement 7.1 references the four endpoints but does not specify whether `/api/results/{job_id}` includes this grid.
- The dataspec.md is referenced but not embedded; the requirements are not self-contained on this point.
- Requirement 5.6's "minimum 15 fps" performance target depends on grid resolution, which is undefined.

**Recommendation:** Block animation work pending dataspec.md confirmation. Verify the response schema includes `arrival_time_grid` (or equivalent), document expected dimensions, and define an upper bound for cell count.

---

### Issue 5: Click-to-Ignite UX Conflict (Requirements 2, 3)

**Problem:** Requirement 2.2 says clicking the map places an ignition marker. Requirement 3.1 says a "Select on Map" button "activates click-to-ignite mode."

These conflict: is click-to-ignite **always on**, or only after pressing the button? If always on, users will accidentally re-ignite when panning or hovering zones (which 2.9 already requires for tooltips).

**Recommendation:** Resolve to **modal**: click-to-ignite is only active after pressing "Select on Map," indicated by a crosshair cursor and a dismissible banner. Default click behavior is pan/inspect. Esc cancels the mode.

---

### Issue 6: Responsive Breakpoint Gap (Requirement 1)

**Problem:** Requirement 1.3 specifies behavior below 1024px (drawers), but says nothing about:

- Tablet portrait (768–1023px) where the map is cramped with two drawers.
- Mobile (<768px) — supported or not? Touch targets in 1.6 imply yes.
- Wind_Rose behavior in the 48px header at narrow widths.

**Recommendation:** For a hackathon demo, **explicitly de-scope <1024px** and require a desktop browser at 1280×800 or larger. Or define breakpoints at 1024/1280/1440 with specific behavior at each.

---

### Issue 7: "Modified Wind" Badge State Management (Requirement 6)

**Problem:** Requirement 6.4 says results show a "Modified Wind" badge when wind is changed and the simulation is re-run. But:

- What is the baseline for "modified"? The last fetched live wind, or the active scenario preset's wind?
- If the user toggles back to live mode and values happen to match, does the badge disappear?
- Does the badge persist across multiple re-runs?

**Recommendation:** Define "modified" as **"differs from the most recent `/api/wind` response or the active scenario preset's wind values."** The badge attaches to the result object at submission time, not the live UI state, so it persists with the run.

---

### Issue 8: Mock Client Schema Drift Risk (Requirements 7, 9)

**Problem:** Requirement 7.1 says mock responses must match "the exact Pydantic schemas defined in the backend spec." Requirement 9.5 establishes `types/api.ts` as the frontend source of truth. There is no mechanism to keep these in sync.

**Recommendation:** Generate `types/api.ts` from the backend's OpenAPI schema via `openapi-typescript`, and add a runtime validator (Zod) that validates mock and live responses against the TypeScript types. Without this, mocks will silently drift.

---

### Issue 9: Demo Mode Scope Creep (Requirement 10)

**Problem:** Requirement 10.4 says the Camp Fire perimeter loads "at startup as a reference layer, even before any simulation is run." But Requirement 1.4 references "current scenario name" in the header, implying scenarios drive default state. If Camp Fire is hardcoded at startup, what happens when the user picks a different scenario?

**Recommendation:** The startup perimeter should be **scenario-driven**, not hardcoded. Each scenario in `/api/scenarios` should optionally include a `reference_perimeter_geojson` field. If absent, no perimeter is drawn.

---

### Issue 10: Accessibility vs. Color-Only Encoding (Requirements 2, 4, 8)

**Problem:** Requirements 2.4, 2.5, and 4.6 encode critical information **purely through color** (route viability, zone urgency, priority badges). This fails WCAG 1.4.1 (Use of Color) for colorblind users. Requirement 1.5 addresses contrast but not color independence.

**Recommendation:** Add redundant encoding: line patterns (solid/dashed/dotted) for routes, icons (✓/⚠/✕) for zones, text labels on badges.

---

### Issue 11: Missing Error and Empty States

**Problem:** No requirement defines UI behavior when:

- The map fails to load (Mapbox token invalid/expired).
- `/api/scenarios` returns empty or fails.
- A simulation run completes with **zero viable routes**.
- The polling job result indicates simulation failure rather than slow progress.

**Recommendation:** Add an explicit "Error and Empty States" requirement covering these.

---

### Issue 12: Performance Budget Undefined

**Problem:** Requirement 5.6 sets 15 fps for animation, but no other performance targets exist. Burn_Heatmap_Layer (2.3) plus terrain (2.6) plus 3D exaggeration (2.10) can easily tank performance on integrated GPUs.

**Recommendation:** Add: time-to-interactive < 3s on demo hardware, map idle frame rate ≥ 30fps with all layers active at default zoom, simulation result rendering < 500ms after data arrives.

---

### Issue 13: State Management Choice Left Open (Requirement 9)

**Problem:** Requirement 9.3 says "React Context + useReducer **or** Zustand." Leaving this open invites inconsistent patterns across features.

**Recommendation:** Lock to **Zustand** — lighter, sliceable per feature (map/controls/results), cleaner devtools than reducer-based context for an operational dashboard.

---

### Issue 14: Cross-Cutting Concerns Missing Entirely

The requirements do not address:

- **Logging / telemetry:** simulation errors, debug overlay.
- **Keyboard shortcuts:** only Ctrl+D is mentioned (10.1). What about Esc to dismiss drawers, Space to play/pause animation, arrow keys to scrub the timeline?
- **Internationalization:** out of scope for hackathon, but should be stated.
- **Browser support matrix:** WebGL2 requires modern browsers; the demo environment must be specified.
- **Testing strategy:** no testing requirement exists at all.

**Recommendation:** Add a "Cross-Cutting Requirements" section covering these explicitly, even if some are de-scoped.

---

## Part 2: Verdict

The document is **largely sound in spirit and demo-credible**, but has **fourteen specific gaps** that will produce real implementation conflicts if handed to an agent as-is. The most critical are:

1. Mapping library ambiguity (Issue 1)
2. Click-to-ignite UX conflict (Issue 5)
3. Animation data contract (Issue 4)
4. Mock/type drift (Issue 8)

These should be resolved **before** task execution begins. Remaining issues can be addressed within their respective tasks below, with explicit notes.

---

## Part 3: Task Breakdown

Tasks are ordered for parallelizable execution where possible. Each task references the requirement(s) it satisfies. Phase 0 tasks are blocking pre-work and must complete before dependent tasks start.

### Phase 0 — Pre-Work and Decisions (Blocking)

#### Task 0.1 — Lock Architectural Decisions
Document in `/frontend/docs/decisions.md`:
- Mapbox GL JS + Deck.gl as the locked map stack (remove Leaflet).
- Zustand as the locked state library.
- `openapi-typescript` codegen pipeline from backend OpenAPI schema.
- Supported browsers: Chrome/Edge/Safari latest two majors with WebGL2.
- Mobile scope: de-scoped below 1024px for hackathon; minimum supported viewport 1280×800.

*Resolves Issues 1, 6, 13. Touches Reqs 1.3, 2.1, 9.3, 9.4.*

#### Task 0.2 — Confirm Animation API Contract
Cross-reference `prompts/dataspec.md`. Confirm `/api/results/{job_id}` returns the arrival-time grid with documented dimensions, units, and an upper bound on cell count. If absent, file a backend change request before starting Phase 7.

*Resolves Issue 4. Touches Reqs 5.1, 5.6, 7.1.*

#### Task 0.3 — Reconcile Color Tokens
Produce `/frontend/docs/color-encoding.md` mapping every visual encoding (routes, zones, fire, badges) to a single design-token name. Update the canonical color list to use only tokens defined in 8.1.

*Resolves Issue 2. Touches Reqs 2.4, 2.5, 4.6, 8.1.*

#### Task 0.4 — Define Error, Empty, and Performance Specs
Append two new requirement sections to the requirements document (or a supplementary `addenda.md`):
- **Error and empty states:** Mapbox load failure, `/api/scenarios` empty/failed, zero viable routes, simulation failure response, network timeout.
- **Performance budget:** TTI < 3s, idle map ≥ 30fps with all layers, simulation result render < 500ms, animation ≥ 15fps.

*Resolves Issues 11, 12, 14.*

#### Task 0.5 — Define Polling and Cancellation Contract
Document the simulation polling contract: 1s interval, 60s total timeout, single retry with exponential backoff on 5xx, Toast_Notification on 404, user-facing Cancel button that aborts in-flight polling and returns the Control_Panel to idle.

*Resolves Issue 3. Touches Reqs 3.7, 7.5.*

---

### Phase 1 — Project Foundation

#### Task 1.1 — Scaffold the Project
Create `/frontend` with Vite + React 18 + TypeScript strict mode. Configure ESLint, Prettier, Husky pre-commit hooks. Establish the directory structure from Requirement 9.2: `components/`, `features/`, `services/`, `hooks/`, `types/`, `styles/`, `assets/`.

*Satisfies Reqs 9.1, 9.2.*

#### Task 1.2 — Implement Design Tokens
Create `src/styles/design-tokens.css` containing CSS custom properties for: dark surface palette, semantic accent colors, fire and route encoding colors, Inter and JetBrains Mono font stacks, 4px-based spacing scale, transition timings, and z-index scale.

*Satisfies Reqs 8.1, 8.2, 8.4, 8.6, 8.7. Resolves Issue 2.*

#### Task 1.3 — Build Base Component Library
Implement primitive components: `Button`, `IconButton`, `Slider`, `NumericInput`, `Select`, `Toggle`, `Badge`, `Card`, `Tooltip`, `MetricCard`, `Toast`. All consume design tokens. All meet 44×44px touch target and contrast requirements.

*Satisfies Reqs 1.5, 1.6, 8.3.*

#### Task 1.4 — Set Up State Management
Initialize Zustand stores sliced by feature: `useSimulationStore` (job state, results, parameters), `useMapStore` (layer toggles, viewport, selected zone, ignite mode), `useScenarioStore` (active scenario, presets), `useUIStore` (panel collapse state, toasts, demo mode).

*Satisfies Req 9.3.*

#### Task 1.5 — Generate API Types from OpenAPI
Configure `openapi-typescript` to generate `src/types/api.ts` from the backend's OpenAPI document. Add a Zod schema layer (`src/types/schemas.ts`) for runtime validation. Wire into the npm scripts so `npm run gen:api` updates types.

*Satisfies Req 9.5. Resolves Issue 8.*

---

### Phase 2 — API Layer

#### Task 2.1 — Build the API Client
Implement `src/services/apiClient.ts` exporting typed functions for `postSimulate`, `getResults`, `getWind`, `getScenarios`. Use `fetch` with AbortController support, Zod-validate every response, surface 422 field errors as a structured error type.

*Satisfies Reqs 7.4, 7.5, 7.6.*

#### Task 2.2 — Implement Polling Logic
Create `src/services/pollResults.ts` implementing the polling contract from Task 0.5: 1s interval, 60s total timeout, single 5xx retry with exponential backoff, AbortController wired to the simulation store's cancel action.

*Satisfies Req 7.5. Resolves Issue 3.*

#### Task 2.3 — Build the Mock API Client
Implement `src/services/mockClient.ts` returning realistic fixture responses for all four endpoints, validated by the same Zod schemas as the live client. Simulate timing: 100ms for wind/scenarios, 2–5s for simulation with intermediate 202 responses.

*Satisfies Reqs 7.1, 7.3.*

#### Task 2.4 — Wire Mode Switching
Add `VITE_API_MODE=mock|live` switch in `src/services/index.ts` exporting a unified client. Document in `README.md`.

*Satisfies Req 7.2.*

#### Task 2.5 — Build Toast Notification System
Implement `useToast` hook and `<ToastHost>` component, wired into the UI store. Used by API client for fallback, network errors, validation failures, and 404 polling responses.

*Satisfies Reqs 3.3, 7.4, 7.6.*

---

### Phase 3 — Layout Shell

#### Task 3.1 — Implement Command Center Layout
Build `src/features/layout/CommandCenter.tsx` with three-region grid: Control_Panel (320px, collapsible), Map_View (flex), Results_Panel (380px, collapsible). All dimensions and transitions use design tokens.

*Satisfies Reqs 1.1, 1.2.*

#### Task 3.2 — Implement Header Bar
Build `src/features/layout/HeaderBar.tsx` (48px height) with logo/wordmark, current scenario name from store, simulation status indicator, and Wind_Rose mount point.

*Satisfies Req 1.4.*

#### Task 3.3 — Implement Panel Collapse Behavior
Add toggle buttons on map edges. Animate collapse with 200ms ease transitions. At <1024px viewports, panels overlay the map as drawers; show a viewport-too-small banner below 1024px (per Task 0.1 mobile de-scope).

*Satisfies Req 1.3.*

#### Task 3.4 — Implement Keyboard Navigation
Add focus-visible outlines for all interactive elements using design tokens. Define and implement keyboard shortcuts: Ctrl+D (demo mode), Esc (cancel ignite mode / dismiss drawers), Space (play/pause animation), arrow keys (timeline scrub).

*Satisfies Reqs 1.5, 1.6, 10.1. Addresses Issue 14.*

---

### Phase 4 — Map View Foundation

#### Task 4.1 — Mount Mapbox GL JS Map
Initialize Mapbox GL JS in `src/features/map/MapView.tsx` with dark basemap, default viewport set from active scenario, configurable token via env var. Handle load failures with a fallback error panel (per Task 0.4).

*Satisfies Req 2.1.*

#### Task 4.2 — Build Layer Toggle Control
Implement `LayerControl` component listing Burn_Heatmap, Routes, Zones, Elevation, Shelters, Fire Perimeter. Each toggle binds to `useMapStore`. Includes an opacity slider for the burn heatmap.

*Satisfies Reqs 2.3, 2.7.*

#### Task 4.3 — Implement Click-to-Ignite Mode
Implement modal ignite mode: activated by "Select on Map" button in Control_Panel, indicated by crosshair cursor and a dismissible banner. Click places a pulsing marker and updates `useSimulationStore`. Esc cancels.

*Satisfies Reqs 2.2, 3.1. Resolves Issue 5.*

#### Task 4.4 — Implement Zone Hover Tooltips
On hover over a zone polygon, display a tooltip with `zone_id`, `population`, `cutoff_time`, `evacuation_priority_score`, `failure_risk_percentage`. Use the existing `Tooltip` primitive.

*Satisfies Req 2.9.*

---

### Phase 5 — Map Layers

#### Task 5.1 — Implement Burn_Heatmap_Layer
Render burn probability as a Deck.gl `BitmapLayer` or Mapbox raster source with the gradient defined in 2.3 and Task 0.3. Bind opacity to the LayerControl slider.

*Satisfies Req 2.3.*

#### Task 5.2 — Implement Route_Overlay_Layer
Render routes as polylines color-encoded by viability per the reconciled color tokens, with line width proportional to road capacity. Add line patterns (solid/dashed/dotted) as redundant encoding for accessibility.

*Satisfies Req 2.4. Resolves Issue 10.*

#### Task 5.3 — Implement Zone_Choropleth_Layer
Render zones as semi-transparent polygons fill-encoded by cutoff urgency per the reconciled color tokens. Add icon overlays (✓/⚠/✕) per zone for redundant encoding.

*Satisfies Reqs 2.5, 8.5. Resolves Issue 10.*

#### Task 5.4 — Implement Elevation_Layer
Add Mapbox Terrain-DEM source with hillshade. Add 3D exaggeration toggle (1×–3× factor) bound to the LayerControl. Falls back gracefully if DEM tiles fail.

*Satisfies Reqs 2.6, 2.10.*

#### Task 5.5 — Implement Shelter Markers
Render shelter locations as distinct icon markers with capacity labels and accessibility icons. Click opens a popup with full details.

*Satisfies Req 2.8.*

#### Task 5.6 — Implement Fire Perimeter Reference Layer
Render scenario-provided `reference_perimeter_geojson` as an outlined polygon. If the active scenario lacks a perimeter, hide the layer. Loaded at startup based on the default scenario.

*Satisfies Req 10.4. Resolves Issue 9.*

---

### Phase 6 — Control Panel

#### Task 6.1 — Build Ignition Section
Display selected lat/lon in JetBrains Mono. "Select on Map" button activates ignite mode (Task 4.3).

*Satisfies Req 3.1.*

#### Task 6.2 — Build Wind Parameters Section
Numeric inputs for wind speed, direction, gust, humidity with client-side range validation. "Live (NWS) / Manual Override" toggle gates editability. "Fetch Live Wind" button calls `getWind` and populates fields.

*Satisfies Reqs 3.2, 3.3, 3.8, 6.3.*

#### Task 6.3 — Build Scenario_Selector
Card-based selector populated from `getScenarios`. Selecting a scenario updates ignition, wind, viewport, and reference perimeter via the scenario store.

*Satisfies Req 3.4.*

#### Task 6.4 — Build Monte Carlo Runs Slider
Range 5–15, step 1, default 10, with numeric display. Bound to simulation store.

*Satisfies Req 3.5.*

#### Task 6.5 — Build Run Simulation Button and Progress
Submits `postSimulate`, transitions to loading state with Simulation_Progress indicator (`X / Y runs`, elapsed time). Disables itself during runs. Includes Cancel button per Task 0.5.

*Satisfies Reqs 3.6, 3.7, 10.5.*

#### Task 6.6 — Surface 422 Field Errors
Map structured 422 errors from the API client to inline error messages on the corresponding wind / ignition / runs fields.

*Satisfies Req 7.4.*

---

### Phase 7 — Wind Display

#### Task 7.1 — Build Wind_Rose Component
Compact directional indicator: rotated arrow for direction, numeric labels for speed/gust/humidity. Subscribes to wind state in the simulation store.

*Satisfies Reqs 6.1, 6.2.*

#### Task 7.2 — Implement Modified Wind Badge
Compute `wind_modified` flag at simulation submission time by diffing against the most recent live wind fetch or active scenario preset. Attach to the result object so it persists with the run.

*Satisfies Req 6.4. Resolves Issue 7.*

---

### Phase 8 — Results Panel

#### Task 8.1 — Build Headline Metric Card
Large-format card at top of Results_Panel: "Route [name] survives in [X]% of scenarios." Computes the leading metric from optimized results.

*Satisfies Req 4.3.*

#### Task 8.2 — Build Comparison_View
Two-column layout: Baseline (Shortest Path) vs. Optimized (Multi-Factor). Each column shows average viability score, average evacuation time, overall failure risk.

*Satisfies Req 4.1.*

#### Task 8.3 — Build Zone Evacuation Table
Sortable table: Zone ID, Population, Cutoff Time, Priority Score, Baseline Viability %, Optimized Viability %, Failure Risk %, status indicator. Status uses redundant encoding (color + icon).

*Satisfies Reqs 4.2, 4.5. Resolves Issue 10.*

#### Task 8.4 — Build Per-Zone Route Cards
For each zone, show best baseline route and best optimized route with viability scores, travel times, and "Show on Map" button that flies the camera and highlights the route.

*Satisfies Req 4.4.*

#### Task 8.5 — Build Evacuation Ordering List
Zones sorted by descending priority score with red/orange/yellow/green badges that include text labels (CRITICAL/HIGH/MEDIUM/LOW) for color-independence.

*Satisfies Req 4.6. Resolves Issue 10.*

#### Task 8.6 — Build Summary Statistics Section
Display: total population at risk, zones with cutoff < 10 min, percentage improvement baseline → optimized, Monte Carlo confidence interval.

*Satisfies Req 4.7.*

#### Task 8.7 — Wire Zone Row Interaction
Clicking a zone row in the table triggers the map to fly to the zone, highlight its polygon, and render its baseline + optimized routes.

*Satisfies Req 4.5.*

---

### Phase 9 — Animation

*Blocked on Task 0.2.*

#### Task 9.1 — Build Animation Timeline Scrubber
Range t=0 to t=max_timestep, with play/pause, step forward/back, playback speed selector (0.5×, 1×, 2×, 4×). Space-bar and arrow-key shortcuts wired per Task 3.4.

*Satisfies Req 5.2.*

#### Task 9.2 — Implement Fire Front Animation Layer
Render the arrival-time grid as a Deck.gl layer that updates at each timestep: newly ignited cells in bright orange, transitioning to dark red for fully burned cells. Targets ≥15 fps on demo hardware.

*Satisfies Reqs 5.1, 5.3, 5.6.*

#### Task 9.3 — Animate Zone Status During Playback
At each timestep, update zone status indicators in the Results_Panel to reflect which zones have passed their cutoff. Drives from a single animation clock.

*Satisfies Req 5.4.*

#### Task 9.4 — Render Zone Cutoff Markers on Timeline
Markers on the timeline at each zone's cutoff time, labeled with zone ID. Hover shows full zone details.

*Satisfies Req 5.5.*

---

### Phase 10 — Demo Mode

#### Task 10.1 — Implement Demo Mode Toggle
Ctrl+D activates Demo Mode: pre-loads the Camp Fire scenario, auto-fetches wind, sets default Monte Carlo runs.

*Satisfies Req 10.1.*

#### Task 10.2 — Build Demo Step Indicator
In Demo Mode, Control_Panel shows the 5-step flow: Select Ignition → Fetch Wind → Run Simulation → Compare Routes → Adjust & Re-run. Steps light up as the user advances.

*Satisfies Req 10.2.*

#### Task 10.3 — Implement Quick Compare
"Quick Compare" action re-runs the simulation with a single delta (e.g., wind direction +45°). Stores the prior run and renders a side-by-side comparison in the Results_Panel.

*Satisfies Req 10.3.*

#### Task 10.4 — Build Purposeful Loading State
During simulations, show a progress bar with run count, elapsed time, and a subtle fire-spread preview animation. Replace any generic spinners.

*Satisfies Req 10.5.*

---

### Phase 11 — Cross-Cutting and Hardening

#### Task 11.1 — Implement Error and Empty States
Build dedicated views for: Mapbox token failure, empty/failed scenarios endpoint, zero viable routes returned, simulation failure response, network timeout. Each surfaces a Toast_Notification plus an in-context message.

*Satisfies Task 0.4 addenda. Resolves Issue 11.*

#### Task 11.2 — Verify Performance Budget
Profile on demo hardware: TTI < 3s, idle frame rate ≥ 30fps with all layers active, simulation result render < 500ms, animation ≥ 15fps. Document findings; add layer culling or LOD if budgets are missed.

*Satisfies Task 0.4 addenda. Resolves Issue 12.*

#### Task 11.3 — Accessibility Audit
Run axe-core against all major views. Verify contrast ≥ 4.5:1, all interactive elements keyboard-reachable, focus indicators visible, redundant encoding present everywhere color carries meaning.

*Satisfies Reqs 1.5, 1.6. Resolves Issue 10.*

#### Task 11.4 — Set Up Testing Infrastructure
Vitest for unit tests on services and hooks. Playwright for one end-to-end smoke test covering: load app → select scenario → run mock simulation → verify results render.

*Resolves Issue 14.*

#### Task 11.5 — Write README and Demo Runbook
`/frontend/README.md` covers setup, env vars, mock vs. live mode, architectural decisions reference. `/frontend/docs/demo-runbook.md` provides a 3-minute presentation script aligned with Demo Mode steps.

*Supports Reqs 10.1–10.5.*

---

## Execution Notes

- **Parallelization:** Phase 1 must complete first. Phases 2 (API), 3 (Layout), and 4 (Map foundation) can run in parallel by separate developers. Phases 5 (Map Layers), 6 (Control Panel), and 8 (Results) can run in parallel after their respective foundations land. Phase 9 (Animation) is gated on Task 0.2.
- **Definition of done per task:** code merged with tests, types validated against OpenAPI, no eslint errors, design tokens used (no hardcoded colors), keyboard accessible, Zod-validated at all API boundaries.
- **Risk register:** Animation performance (Phase 9), Mapbox token / quota in demo environment (Phase 4), backend schema lag behind frontend types (Phase 2).
