import { create } from "zustand";
import { defaultWind, paradiseCenter } from "../services/mockData";
import type {
  ScenarioPreset,
  SimulationProgress,
  SimulationResponse,
  WindConditions,
} from "../types/api";

export type WindMode = "live" | "manual";
export type RunStatus = "idle" | "loading" | "running" | "complete" | "error";

export interface LayerState {
  burnHeatmap: boolean;
  routes: boolean;
  zones: boolean;
  elevation: boolean;
  shelters: boolean;
  perimeter: boolean;
}

export interface AnimationState {
  playing: boolean;
  timestep: number;
  speed: number;
}

export interface SimulationStore {
  // Scenario
  scenarios: ScenarioPreset[];
  selectedScenarioName: string;
  setScenarios: (scenarios: ScenarioPreset[]) => void;
  selectScenario: (scenario: ScenarioPreset) => void;

  // Ignition
  ignition: { lat: number; lon: number };
  selectIgnitionMode: boolean;
  setIgnition: (lat: number, lon: number) => void;
  setSelectIgnitionMode: (enabled: boolean) => void;

  // Wind
  wind: WindConditions;
  windMode: WindMode;
  modifiedWind: boolean;
  setWindMode: (mode: WindMode) => void;
  setWind: (wind: WindConditions, modified?: boolean) => void;
  setWindField: (field: keyof WindConditions, value: number) => void;

  // Simulation params
  numRuns: number;
  maxTimesteps: number;
  setNumRuns: (value: number) => void;

  // Run state
  status: RunStatus;
  progress: SimulationProgress | null;
  result: SimulationResponse | null;
  previousResult: SimulationResponse | null;
  fieldErrors: Record<string, string>;
  apiError: string | null;
  cancelController: AbortController | null;
  startRun: (previousResult?: SimulationResponse | null) => AbortController;
  progressRun: (progress: SimulationProgress) => void;
  completeRun: (result: SimulationResponse, modifiedWind?: boolean) => void;
  failRun: (message: string) => void;
  cancelRun: () => void;
  setFieldErrors: (errors: Record<string, string>) => void;

  // Selection
  selectedZoneId: string | null;
  selectedRouteId: string | null;
  selectZone: (zoneId: string | null) => void;
  selectRoute: (routeId: string | null, zoneId?: string) => void;

  // Layers
  layers: LayerState;
  burnOpacity: number;
  terrainExaggeration: number;
  setLayer: (layer: keyof LayerState, value: boolean) => void;
  setBurnOpacity: (value: number) => void;
  setTerrainExaggeration: (value: number) => void;

  // UI
  demoMode: boolean;
  panels: { controls: boolean; results: boolean };
  setDemoMode: (enabled: boolean) => void;
  setPanel: (panel: "controls" | "results", open: boolean) => void;

  // Animation
  animation: AnimationState;
  setAnimation: (animation: Partial<AnimationState>) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  scenarios: [],
  selectedScenarioName: "Custom scenario",
  setScenarios: (scenarios) => set({ scenarios }),
  selectScenario: (scenario) =>
    set({
      selectedScenarioName: scenario.name,
      ignition: { lat: scenario.ignition_lat, lon: scenario.ignition_lon },
      wind: {
        wind_speed_mph: scenario.wind_speed_mph,
        wind_direction_deg: scenario.wind_direction_deg,
        wind_gust_mph: scenario.wind_gust_mph,
        relative_humidity: scenario.relative_humidity,
      },
      modifiedWind: false,
      fieldErrors: {},
    }),

  ignition: paradiseCenter,
  selectIgnitionMode: false,
  setIgnition: (lat, lon) =>
    set((s) => ({
      ignition: { lat, lon },
      selectIgnitionMode: false,
      fieldErrors: clearFields(s.fieldErrors, ["ignition_lat", "ignition_lon"]),
    })),
  setSelectIgnitionMode: (enabled) => set({ selectIgnitionMode: enabled }),

  wind: defaultWind,
  windMode: "manual",
  modifiedWind: false,
  setWindMode: (mode) => set({ windMode: mode }),
  setWind: (wind, modified) =>
    set((s) => ({
      wind,
      modifiedWind: modified ?? s.modifiedWind,
      fieldErrors: clearFields(s.fieldErrors, [
        "wind_speed_mph",
        "wind_direction_deg",
        "wind_gust_mph",
        "relative_humidity",
      ]),
    })),
  setWindField: (field, value) =>
    set((s) => ({
      wind: { ...s.wind, [field]: value },
      modifiedWind: true,
      fieldErrors: clearFields(s.fieldErrors, [field]),
    })),

  numRuns: 10,
  maxTimesteps: 180,
  setNumRuns: (value) =>
    set((s) => ({ numRuns: value, fieldErrors: clearFields(s.fieldErrors, ["num_runs"]) })),

  status: "idle",
  progress: null,
  result: null,
  previousResult: null,
  fieldErrors: {},
  apiError: null,
  cancelController: null,
  startRun: (previousResult) => {
    const controller = new AbortController();
    set((s) => ({
      status: "running",
      progress: {
        completedRuns: 0,
        totalRuns: s.numRuns,
        elapsedSec: 0,
        etaSec: 0,
        phase: "queued",
      },
      previousResult: previousResult ?? s.previousResult,
      apiError: null,
      fieldErrors: {},
      cancelController: controller,
    }));
    return controller;
  },
  progressRun: (progress) => set({ status: "running", progress }),
  completeRun: (result, modifiedWind) =>
    set((s) => ({
      status: "complete",
      progress: null,
      result,
      selectedZoneId: result.zone_results[0]?.zone_id ?? null,
      selectedRouteId: result.zone_results[0]?.optimized_route?.route_id ?? result.zone_results[0]?.baseline_route.route_id ?? null,
      modifiedWind: modifiedWind ?? s.modifiedWind,
      cancelController: null,
    })),
  failRun: (message) => set({ status: "error", apiError: message, progress: null, cancelController: null }),
  cancelRun: () =>
    set((s) => {
      s.cancelController?.abort();
      return { status: "idle", progress: null, apiError: null, cancelController: null };
    }),
  setFieldErrors: (errors) => set({ fieldErrors: errors, status: "error" }),

  selectedZoneId: null,
  selectedRouteId: null,
  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),
  selectRoute: (routeId, zoneId) =>
    set((s) => ({
      selectedRouteId: routeId,
      selectedZoneId: zoneId ?? s.selectedZoneId,
    })),

  layers: {
    burnHeatmap: true,
    routes: true,
    zones: true,
    elevation: true,
    shelters: true,
    perimeter: true,
  },
  burnOpacity: 0.62,
  terrainExaggeration: 1.6,
  setLayer: (layer, value) => set((s) => ({ layers: { ...s.layers, [layer]: value } })),
  setBurnOpacity: (value) => set({ burnOpacity: value }),
  setTerrainExaggeration: (value) => set({ terrainExaggeration: value }),

  demoMode: false,
  panels: { controls: true, results: true },
  setDemoMode: (enabled) =>
    set((s) => ({
      demoMode: enabled,
      selectedScenarioName: enabled ? s.selectedScenarioName : "Custom scenario",
    })),
  setPanel: (panel, open) => set((s) => ({ panels: { ...s.panels, [panel]: open } })),

  animation: { playing: false, timestep: 0, speed: 1 },
  setAnimation: (animation) => set((s) => ({ animation: { ...s.animation, ...animation } })),
}));

function clearFields(errors: Record<string, string>, fields: string[]) {
  const next = { ...errors };
  for (const field of fields) delete next[field];
  return next;
}
