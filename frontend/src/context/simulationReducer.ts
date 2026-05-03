/**
 * Simulation State Reducer
 *
 * Pure reducer function for managing simulation state with discriminated union actions.
 * Follows React useReducer patterns with exhaustive switch handling.
 */

import type { SimulationResults, WindData } from '../types/api';

// ============================================================================
// Wind Parameters Type
// ============================================================================

export interface WindParameters {
  speed: number;
  direction: number;
  gust: number;
  humidity: number;
  source: 'nws' | 'fallback' | 'manual';
}

// ============================================================================
// Visible Layers Type
// ============================================================================

export interface VisibleLayers {
  burnHeatmap: boolean;
  routes: boolean;
  zones: boolean;
  elevation: boolean;
  shelters: boolean;
  perimeter: boolean;
}

// ============================================================================
// Simulation State Interface
// ============================================================================

export interface SimulationState {
  ignitionPoint: { lat: number; lon: number } | null;
  windParams: WindParameters;
  monteCarloRuns: number;
  selectedScenario: string | null;
  jobId: string | null;
  jobStatus: 'idle' | 'running' | 'complete' | 'error';
  progress: { completed: number; total: number } | null;
  currentResults: SimulationResults | null;
  previousResults: SimulationResults | null;
  selectedZoneId: string | null;
  selectedRegion: string | null;
  animationTimestep: number;
  isAnimating: boolean;
  terrainExaggeration: number;
  visibleLayers: VisibleLayers;
  error: string | null;
}

// ============================================================================
// Action Types (Discriminated Union)
// ============================================================================

export type SimulationAction =
  | { type: 'SET_IGNITION'; payload: { lat: number; lon: number } | null }
  | { type: 'SET_REGION'; payload: string | null }
  | { type: 'SET_WIND'; payload: Partial<WindParameters> }
  | { type: 'SET_SCENARIO'; payload: string | null }
  | { type: 'SET_MC_RUNS'; payload: number }
  | { type: 'SUBMIT_SIMULATION' }
  | { type: 'UPDATE_PROGRESS'; payload: { completed: number; total: number } }
  | { type: 'SET_RESULTS'; payload: SimulationResults }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_ZONE'; payload: string | null }
  | { type: 'SET_ANIMATION_TIMESTEP'; payload: number }
  | { type: 'TOGGLE_ANIMATION' }
  | { type: 'TOGGLE_LAYER'; payload: keyof VisibleLayers }
  | { type: 'SET_TERRAIN_EXAGGERATION'; payload: number }
  | { type: 'STORE_PREVIOUS_RESULTS' }
  | { type: 'RESET_SIMULATION' };

// ============================================================================
// Initial State
// ============================================================================

export const DEFAULT_WIND_PARAMS: WindParameters = {
  speed: 14,
  direction: 225,
  gust: 22,
  humidity: 18,
  source: 'fallback',
};

export const DEFAULT_VISIBLE_LAYERS: VisibleLayers = {
  burnHeatmap: true,
  routes: true,
  zones: true,
  elevation: true,
  shelters: true,
  perimeter: true,
};

export const INITIAL_STATE: SimulationState = {
  ignitionPoint: null,
  windParams: DEFAULT_WIND_PARAMS,
  monteCarloRuns: 500,
  selectedScenario: null,
  jobId: null,
  jobStatus: 'idle',
  progress: null,
  currentResults: null,
  previousResults: null,
  selectedZoneId: null,
  selectedRegion: null,
  animationTimestep: 0,
  isAnimating: false,
  terrainExaggeration: 1.0,
  visibleLayers: DEFAULT_VISIBLE_LAYERS,
  error: null,
};

// ============================================================================
// Reducer Function
// ============================================================================

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction
): SimulationState {
  switch (action.type) {
    case 'SET_IGNITION':
      return { ...state, ignitionPoint: action.payload, error: null };

    case 'SET_REGION':
      return { ...state, selectedRegion: action.payload, ignitionPoint: null, error: null };

    case 'SET_WIND':
      return { ...state, windParams: { ...state.windParams, ...action.payload }, error: null };

    case 'SET_SCENARIO':
      return { ...state, selectedScenario: action.payload, error: null };

    case 'SET_MC_RUNS':
      return { ...state, monteCarloRuns: Math.max(50, Math.min(1000, action.payload)), error: null };

    case 'SUBMIT_SIMULATION':
      return { ...state, jobStatus: 'running', progress: { completed: 0, total: state.monteCarloRuns }, error: null };

    case 'UPDATE_PROGRESS':
      return { ...state, progress: action.payload };

    case 'SET_RESULTS':
      return { ...state, jobStatus: 'complete', currentResults: action.payload, progress: null, animationTimestep: 0, isAnimating: false };

    case 'SET_ERROR':
      return { ...state, jobStatus: action.payload ? 'error' : state.jobStatus, error: action.payload, progress: null };

    case 'SELECT_ZONE':
      return { ...state, selectedZoneId: action.payload };

    case 'SET_ANIMATION_TIMESTEP':
      return { ...state, animationTimestep: Math.max(0, action.payload) };

    case 'TOGGLE_ANIMATION':
      return { ...state, isAnimating: !state.isAnimating };

    case 'TOGGLE_LAYER':
      return { ...state, visibleLayers: { ...state.visibleLayers, [action.payload]: !state.visibleLayers[action.payload] } };

    case 'SET_TERRAIN_EXAGGERATION':
      return { ...state, terrainExaggeration: Math.max(1.0, Math.min(3.0, action.payload)) };

    case 'STORE_PREVIOUS_RESULTS':
      return { ...state, previousResults: state.currentResults };

    case 'RESET_SIMULATION':
      return { ...INITIAL_STATE, visibleLayers: state.visibleLayers, terrainExaggeration: state.terrainExaggeration };

    default:
      return action satisfies never;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function windDataToParams(windData: WindData): WindParameters {
  return {
    speed: windData.wind_speed,
    direction: windData.wind_direction,
    gust: windData.wind_gust,
    humidity: windData.relative_humidity,
    source: windData.source,
  };
}
