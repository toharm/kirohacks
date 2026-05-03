import { defaultWind, paradiseCenter } from "../services/mockData";
import type {
  ScenarioPreset,
  SimulationProgress,
  SimulationResponse,
  WindConditions,
} from "../types/api";

export type WindMode = "live" | "manual";
export type RunStatus = "idle" | "loading" | "running" | "complete" | "error";
export type PanelSide = "controls" | "results";

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

export interface SimulationState {
  scenarios: ScenarioPreset[];
  selectedScenarioName: string;
  ignition: {
    lat: number;
    lon: number;
  };
  selectIgnitionMode: boolean;
  wind: WindConditions;
  windMode: WindMode;
  numRuns: number;
  maxTimesteps: number;
  status: RunStatus;
  progress: SimulationProgress | null;
  result: SimulationResponse | null;
  previousResult: SimulationResponse | null;
  selectedZoneId: string | null;
  selectedRouteId: string | null;
  fieldErrors: Record<string, string>;
  apiError: string | null;
  layers: LayerState;
  burnOpacity: number;
  terrainExaggeration: number;
  demoMode: boolean;
  modifiedWind: boolean;
  panels: {
    controls: boolean;
    results: boolean;
  };
  animation: AnimationState;
}

export type SimulationAction =
  | { type: "scenariosLoaded"; scenarios: ScenarioPreset[] }
  | { type: "scenarioSelected"; scenario: ScenarioPreset }
  | { type: "ignitionSet"; lat: number; lon: number }
  | { type: "selectIgnitionModeSet"; enabled: boolean }
  | { type: "windModeSet"; mode: WindMode }
  | { type: "windSet"; wind: WindConditions; modified?: boolean }
  | { type: "windFieldSet"; field: keyof WindConditions; value: number }
  | { type: "numRunsSet"; value: number }
  | { type: "runStarted"; previousResult?: SimulationResponse | null }
  | { type: "runProgressed"; progress: SimulationProgress }
  | { type: "runCompleted"; result: SimulationResponse; modifiedWind?: boolean }
  | { type: "runFailed"; message: string }
  | { type: "fieldErrorsSet"; errors: Record<string, string> }
  | { type: "layerSet"; layer: keyof LayerState; value: boolean }
  | { type: "burnOpacitySet"; value: number }
  | { type: "terrainExaggerationSet"; value: number }
  | { type: "zoneSelected"; zoneId: string | null }
  | { type: "routeSelected"; routeId: string | null; zoneId?: string }
  | { type: "demoModeSet"; enabled: boolean }
  | { type: "panelSet"; panel: PanelSide; open: boolean }
  | { type: "animationSet"; animation: Partial<AnimationState> };

export const initialSimulationState: SimulationState = {
  scenarios: [],
  selectedScenarioName: "Custom scenario",
  ignition: paradiseCenter,
  selectIgnitionMode: false,
  wind: defaultWind,
  windMode: "manual",
  numRuns: 500,
  maxTimesteps: 180,
  status: "idle",
  progress: null,
  result: null,
  previousResult: null,
  selectedZoneId: null,
  selectedRouteId: null,
  fieldErrors: {},
  apiError: null,
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
  demoMode: false,
  modifiedWind: false,
  panels: {
    controls: true,
    results: true,
  },
  animation: {
    playing: false,
    timestep: 0,
    speed: 1,
  },
};

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case "scenariosLoaded":
      return { ...state, scenarios: action.scenarios };
    case "scenarioSelected":
      return {
        ...state,
        selectedScenarioName: action.scenario.name,
        ignition: {
          lat: action.scenario.ignition_lat,
          lon: action.scenario.ignition_lon,
        },
        wind: {
          wind_speed_mph: action.scenario.wind_speed_mph,
          wind_direction_deg: action.scenario.wind_direction_deg,
          wind_gust_mph: action.scenario.wind_gust_mph,
          relative_humidity: action.scenario.relative_humidity,
        },
        modifiedWind: false,
        fieldErrors: {},
      };
    case "ignitionSet":
      return {
        ...state,
        ignition: { lat: action.lat, lon: action.lon },
        selectIgnitionMode: false,
        fieldErrors: clearFields(state.fieldErrors, ["ignition_lat", "ignition_lon"]),
      };
    case "selectIgnitionModeSet":
      return { ...state, selectIgnitionMode: action.enabled };
    case "windModeSet":
      return { ...state, windMode: action.mode };
    case "windSet":
      return {
        ...state,
        wind: action.wind,
        modifiedWind: action.modified ?? state.modifiedWind,
        fieldErrors: clearFields(state.fieldErrors, [
          "wind_speed_mph",
          "wind_direction_deg",
          "wind_gust_mph",
          "relative_humidity",
        ]),
      };
    case "windFieldSet":
      return {
        ...state,
        wind: { ...state.wind, [action.field]: action.value },
        modifiedWind: true,
        fieldErrors: clearFields(state.fieldErrors, [action.field]),
      };
    case "numRunsSet":
      return {
        ...state,
        numRuns: action.value,
        fieldErrors: clearFields(state.fieldErrors, ["num_runs"]),
      };
    case "runStarted":
      return {
        ...state,
        status: "running",
        progress: {
          completedRuns: 0,
          totalRuns: state.numRuns,
          elapsedSec: 0,
          etaSec: 0,
          phase: "queued",
        },
        previousResult: action.previousResult ?? state.previousResult,
        apiError: null,
        fieldErrors: {},
      };
    case "runProgressed":
      return { ...state, status: "running", progress: action.progress };
    case "runCompleted":
      return {
        ...state,
        status: "complete",
        progress: null,
        result: action.result,
        selectedZoneId: action.result.zone_results[0]?.zone_id ?? null,
        selectedRouteId: action.result.zone_results[0]?.optimized_route?.route_id ?? null,
        modifiedWind: action.modifiedWind ?? state.modifiedWind,
      };
    case "runFailed":
      return { ...state, status: "error", apiError: action.message, progress: null };
    case "fieldErrorsSet":
      return { ...state, fieldErrors: action.errors, status: "error" };
    case "layerSet":
      return { ...state, layers: { ...state.layers, [action.layer]: action.value } };
    case "burnOpacitySet":
      return { ...state, burnOpacity: action.value };
    case "terrainExaggerationSet":
      return { ...state, terrainExaggeration: action.value };
    case "zoneSelected":
      return { ...state, selectedZoneId: action.zoneId };
    case "routeSelected":
      return {
        ...state,
        selectedRouteId: action.routeId,
        selectedZoneId: action.zoneId ?? state.selectedZoneId,
      };
    case "demoModeSet":
      return {
        ...state,
        demoMode: action.enabled,
        selectedScenarioName: action.enabled ? "Camp Fire Fast Wind Shift" : state.selectedScenarioName,
      };
    case "panelSet":
      return { ...state, panels: { ...state.panels, [action.panel]: action.open } };
    case "animationSet":
      return { ...state, animation: { ...state.animation, ...action.animation } };
    default:
      return state;
  }
}

function clearFields(errors: Record<string, string>, fields: string[]) {
  const next = { ...errors };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}
